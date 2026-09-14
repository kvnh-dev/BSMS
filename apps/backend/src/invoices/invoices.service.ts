import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import {
  calcGstBreakup,
  calcInvoiceTotal,
  type CreateInvoiceInput,
  type EditInvoiceLineItemsInput,
  type LineItemInput,
  type Persona,
} from '@bsms/shared';
import { PrismaService } from '../prisma/prisma.service.js';
import { PaymentsService } from '../payments/payments.service.js';

interface ResolvedLine extends LineItemInput {
  description: string;
  inventoryItemId?: string;
  // saleUnitFactor/saleUnit resolved from the InventoryItem (or carried over
  // from a ServicePartUsed snapshot for ticket-derived lines) — populated by
  // attachUnitInfo() before a line is persisted. Money math (qty*unitPrice)
  // never needs this; it only ever affects the stock ledger.
  unitFactor?: number;
  unitLabel?: string | null;
}

@Injectable()
export class InvoicesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly payments: PaymentsService,
  ) {}

  // paidAmount/balanceDue are computed here, not stored on Invoice — see
  // the Payment model's schema comment. A DRAFT (no real total settled yet)
  // always reports 0/0 rather than a misleading balance against a total
  // that can still change.
  async list() {
    const invoices = await this.prisma.invoice.findMany({
      include: { customer: true, lineItems: true },
      orderBy: { createdAt: 'desc' },
    });
    const paidByInvoice = await this.payments.totalsPaidForInvoices(
      invoices.filter((i) => i.status === 'FINAL').map((i) => i.id),
    );
    return invoices.map((invoice) => {
      const paidAmount = paidByInvoice.get(invoice.id) ?? 0;
      return { ...invoice, paidAmount, balanceDue: invoice.status === 'FINAL' ? invoice.total - paidAmount : 0 };
    });
  }

  async get(id: string) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id },
      include: {
        customer: true,
        // Line item's HSN code comes from the linked InventoryItem — a
        // proper tax invoice print needs it per line, so it's joined here
        // rather than only on the InvoiceLineItem itself.
        lineItems: { include: { inventoryItem: { select: { hsnCode: true } } } },
        ticket: true,
        cashier: true,
      },
    });
    if (!invoice) throw new NotFoundException('Invoice not found');
    const paidAmount = invoice.status === 'FINAL' ? await this.payments.totalPaidForInvoice(id) : 0;
    return { ...invoice, paidAmount, balanceDue: invoice.status === 'FINAL' ? invoice.total - paidAmount : 0 };
  }

  // Derives ticket-based line items from the ticket's *actual* recorded
  // work — never from client-supplied lineItems and never from the
  // Estimate (that's only ever shown to the customer up-front). Called both
  // at draft creation (for the cashier's preview) and again at finalize (in
  // case more parts/charges were added to the ticket while the draft sat
  // unfinalized) — see the 2026-09-12 workflow fix in DATABASE_SCHEMA.md.
  private async deriveTicketLines(tx: Prisma.TransactionClient, ticketId: string) {
    const ticket = await tx.serviceTicket.findUnique({
      where: { id: ticketId },
      include: {
        bike: true,
        invoice: true,
        partsUsed: { include: { inventoryItem: true } },
        serviceCharges: true,
      },
    });
    if (!ticket) throw new NotFoundException('Service ticket not found');

    const lines: ResolvedLine[] = [
      ...ticket.partsUsed.map((p) => ({
        description: p.inventoryItem.name,
        qty: p.qty,
        unitPricePaise: p.priceAtUse,
        gstRateBps: p.gstRateAtUse,
        inventoryItemId: p.inventoryItemId,
        unitFactor: p.unitFactor,
        unitLabel: p.unitLabel,
      })),
      ...ticket.serviceCharges.map((c) => ({
        description: c.description,
        qty: 1,
        unitPricePaise: c.amount,
        gstRateBps: c.gstRate,
      })),
    ];
    return { ticket, lines };
  }

  // Resolves saleUnitFactor/saleUnit for any line that doesn't already carry
  // one (ticket-derived lines already do, from ServicePartUsed) — a fresh
  // lookup of the item's *current* settings, used only at the moment a line
  // is newly persisted (create/updateDraft/revise). Once written, a line's
  // own unitFactor is what protects it from later item changes.
  private async attachUnitInfo(tx: Prisma.TransactionClient, lines: ResolvedLine[]): Promise<ResolvedLine[]> {
    return Promise.all(
      lines.map(async (l) => {
        if (l.unitFactor !== undefined) return l;
        if (!l.inventoryItemId) return { ...l, unitFactor: 1, unitLabel: null };
        const item = await tx.inventoryItem.findUnique({ where: { id: l.inventoryItemId } });
        if (!item) throw new NotFoundException(`Inventory item ${l.inventoryItemId} not found`);
        return { ...l, unitFactor: item.saleUnitFactor, unitLabel: item.saleUnit };
      }),
    );
  }

  // Creates a DRAFT — no invoice number, no stock deduction, no ticket
  // status change. None of that happens until finalize() (2026-09-13): a
  // draft is a proposal the cashier/owner can review (and, for a standalone
  // sale, revise) before it becomes a real, sequentially-numbered, issued
  // invoice — see Invoice.invoiceNumber's schema comment.
  async create(cashierId: string, input: CreateInvoiceInput) {
    return this.prisma.$transaction(async (tx) => {
      let customerId = input.customerId;
      let ticketId: string | undefined;
      let lines: ResolvedLine[];

      if (input.ticketId) {
        const { ticket, lines: ticketLines } = await this.deriveTicketLines(tx, input.ticketId);
        if (ticket.invoice) throw new BadRequestException('This ticket has already been billed');
        if (ticket.status !== 'IN_SERVICE') {
          throw new BadRequestException('Ticket must be In Service (with parts/charges recorded) before billing');
        }
        if (ticketLines.length === 0) {
          throw new BadRequestException('Add at least one part used or service charge before billing this ticket');
        }
        ticketId = input.ticketId;
        customerId = ticket.bike.customerId;
        lines = ticketLines;
      } else {
        // Standalone sale — schema guarantees lineItems is non-empty here.
        lines = input.lineItems!.map((l) => ({
          description: l.description,
          qty: l.qty,
          unitPricePaise: l.unitPrice,
          gstRateBps: l.gstRate,
          inventoryItemId: l.inventoryItemId,
        }));
      }

      if (!customerId) {
        throw new BadRequestException('customerId is required for a standalone sale');
      }

      const gstBreakup = calcGstBreakup(lines) as unknown as Prisma.InputJsonValue;
      const total = calcInvoiceTotal(lines, input.discount);
      lines = await this.attachUnitInfo(tx, lines);

      return tx.invoice.create({
        data: {
          status: 'DRAFT',
          ticketId,
          customerId,
          gstBreakup,
          discount: input.discount,
          total,
          cashierId,
          lineItems: {
            create: lines.map((l) => ({
              inventoryItemId: l.inventoryItemId,
              description: l.description,
              qty: l.qty,
              unitPrice: l.unitPricePaise,
              gstRate: l.gstRateBps,
              unitFactor: l.unitFactor,
              unitLabel: l.unitLabel,
            })),
          },
        },
        include: { lineItems: true, customer: true },
      });
    });
  }

  // Edits a still-DRAFT standalone-sale invoice's lineItems/discount.
  // Ticket-based drafts are never directly edited — their lines always come
  // from deriveTicketLines(), both now and again at finalize.
  async updateDraft(id: string, input: EditInvoiceLineItemsInput) {
    return this.prisma.$transaction(async (tx) => {
      const invoice = await tx.invoice.findUnique({ where: { id } });
      if (!invoice) throw new NotFoundException('Invoice not found');
      if (invoice.status !== 'DRAFT') {
        throw new BadRequestException('Only a draft invoice can be edited this way — use revise for a final invoice');
      }
      if (invoice.ticketId) {
        throw new BadRequestException(
          'This invoice is derived from a service ticket — add/remove parts or charges on the ticket instead',
        );
      }

      let lines: ResolvedLine[] = input.lineItems.map((l) => ({
        description: l.description,
        qty: l.qty,
        unitPricePaise: l.unitPrice,
        gstRateBps: l.gstRate,
        inventoryItemId: l.inventoryItemId,
      }));
      const gstBreakup = calcGstBreakup(lines) as unknown as Prisma.InputJsonValue;
      const total = calcInvoiceTotal(lines, input.discount);
      lines = await this.attachUnitInfo(tx, lines);

      await tx.invoiceLineItem.deleteMany({ where: { invoiceId: id } });
      return tx.invoice.update({
        where: { id },
        data: {
          discount: input.discount,
          total,
          gstBreakup,
          lineItems: {
            create: lines.map((l) => ({
              inventoryItemId: l.inventoryItemId,
              description: l.description,
              qty: l.qty,
              unitPrice: l.unitPricePaise,
              gstRate: l.gstRateBps,
              unitFactor: l.unitFactor,
              unitLabel: l.unitLabel,
            })),
          },
        },
        include: { lineItems: true, customer: true },
      });
    });
  }

  // Turns a DRAFT into a real, numbered, issued invoice: assigns the next
  // sequential invoice number, snapshots the seller details, deducts stock
  // for a standalone sale (ticket-based stock was already deducted when
  // parts were recorded on the ticket), and marks the ticket BILLED.
  async finalize(id: string) {
    return this.prisma.$transaction(async (tx) => {
      const invoice = await tx.invoice.findUnique({ where: { id }, include: { lineItems: true } });
      if (!invoice) throw new NotFoundException('Invoice not found');
      if (invoice.status !== 'DRAFT') throw new BadRequestException('This invoice has already been finalized');

      let lines: ResolvedLine[];
      let ticket: { id: string } | null = null;
      if (invoice.ticketId) {
        const derived = await this.deriveTicketLines(tx, invoice.ticketId);
        if (derived.lines.length === 0) {
          throw new BadRequestException('Add at least one part used or service charge before finalizing this invoice');
        }
        lines = derived.lines;
        ticket = derived.ticket;
      } else {
        lines = invoice.lineItems.map((l) => ({
          description: l.description,
          qty: l.qty,
          unitPricePaise: l.unitPrice,
          gstRateBps: l.gstRate,
          inventoryItemId: l.inventoryItemId ?? undefined,
          unitFactor: l.unitFactor,
          unitLabel: l.unitLabel,
        }));
        for (const line of lines) {
          if (!line.inventoryItemId) continue;
          // Use the line's own snapshotted factor (captured at create/
          // updateDraft time), not a fresh item lookup — the item's unit
          // setup may have changed since the draft was written.
          const baseQty = line.qty * (line.unitFactor ?? 1);
          const item = await tx.inventoryItem.findUnique({ where: { id: line.inventoryItemId } });
          if (!item) throw new NotFoundException(`Inventory item ${line.inventoryItemId} not found`);
          if (item.stockQty < baseQty) throw new BadRequestException(`Not enough stock for ${item.name}`);
          await tx.inventoryItem.update({
            where: { id: line.inventoryItemId },
            data: { stockQty: item.stockQty - baseQty },
          });
        }
      }

      const gstBreakup = calcGstBreakup(lines) as unknown as Prisma.InputJsonValue;
      const total = calcInvoiceTotal(lines, invoice.discount);

      const profile = await tx.showroomProfile.findFirstOrThrow();
      const nextSeq = profile.invoiceSeq + 1;
      await tx.showroomProfile.update({ where: { id: profile.id }, data: { invoiceSeq: nextSeq } });
      const invoiceNumber = `${profile.invoicePrefix}-${new Date().getFullYear()}-${String(nextSeq).padStart(4, '0')}`;

      // Snapshot the seller details as they are *now* — a later profile edit
      // must never change what an already-issued invoice displays.
      const sellerSnapshot: Prisma.InputJsonValue = {
        name: profile.name,
        address: profile.address,
        gstin: profile.gstin,
        pan: profile.pan,
        state: profile.state,
        contactNumber: profile.contactNumber,
      };

      if (invoice.ticketId) {
        await tx.invoiceLineItem.deleteMany({ where: { invoiceId: id } });
      }

      const finalized = await tx.invoice.update({
        where: { id },
        data: {
          status: 'FINAL',
          invoiceNumber,
          sellerSnapshot,
          finalizedAt: new Date(),
          total,
          gstBreakup,
          ...(invoice.ticketId && {
            lineItems: {
              create: lines.map((l) => ({
                inventoryItemId: l.inventoryItemId,
                description: l.description,
                qty: l.qty,
                unitPrice: l.unitPricePaise,
                gstRate: l.gstRateBps,
                unitFactor: l.unitFactor,
                unitLabel: l.unitLabel,
              })),
            },
          }),
        },
        include: { lineItems: true, customer: true },
      });

      if (ticket) {
        await tx.serviceTicket.update({ where: { id: ticket.id }, data: { status: 'BILLED', actualAmount: total } });
      }

      return finalized;
    });
  }

  // Owner-only correction to an already-FINAL invoice — see AuditLog for
  // the before/after trail this writes. For a ticket-based invoice this
  // intentionally does NOT touch stock or the ticket's actualAmount-driving
  // ServicePartUsed/ServiceCharge records: it's a deliberate, tracked
  // override of the recorded numbers (e.g. a price typo), not a re-service
  // event. For a standalone sale, stock is reconciled: old quantities are
  // restored and new quantities deducted.
  async revise(id: string, actorId: string, actorPersonas: Persona[], input: EditInvoiceLineItemsInput) {
    if (!actorPersonas.includes('OWNER')) {
      throw new ForbiddenException('Only the Owner can revise a finalized invoice');
    }
    return this.prisma.$transaction(async (tx) => {
      const invoice = await tx.invoice.findUnique({ where: { id }, include: { lineItems: true } });
      if (!invoice) throw new NotFoundException('Invoice not found');
      if (invoice.status !== 'FINAL') {
        throw new BadRequestException('Only a finalized invoice can be revised — edit the draft directly instead');
      }

      const before = {
        lineItems: invoice.lineItems.map((l) => ({
          inventoryItemId: l.inventoryItemId,
          description: l.description,
          qty: l.qty,
          unitPrice: l.unitPrice,
          gstRate: l.gstRate,
        })),
        discount: invoice.discount,
        total: invoice.total,
      };

      if (!invoice.ticketId) {
        for (const old of invoice.lineItems) {
          if (!old.inventoryItemId) continue;
          // Reverse using the OLD line's own snapshotted factor — not the
          // item's current settings, which may have changed since.
          await tx.inventoryItem.update({
            where: { id: old.inventoryItemId },
            data: { stockQty: { increment: old.qty * old.unitFactor } },
          });
        }
        for (const line of input.lineItems) {
          if (!line.inventoryItemId) continue;
          const item = await tx.inventoryItem.findUnique({ where: { id: line.inventoryItemId } });
          if (!item) throw new NotFoundException(`Inventory item ${line.inventoryItemId} not found`);
          const baseQty = line.qty * item.saleUnitFactor;
          if (item.stockQty < baseQty) throw new BadRequestException(`Not enough stock for ${item.name}`);
          await tx.inventoryItem.update({
            where: { id: line.inventoryItemId },
            data: { stockQty: item.stockQty - baseQty },
          });
        }
      }

      let lines: ResolvedLine[] = input.lineItems.map((l) => ({
        description: l.description,
        qty: l.qty,
        unitPricePaise: l.unitPrice,
        gstRateBps: l.gstRate,
        inventoryItemId: l.inventoryItemId,
      }));
      const gstBreakup = calcGstBreakup(lines) as unknown as Prisma.InputJsonValue;
      const total = calcInvoiceTotal(lines, input.discount);
      lines = await this.attachUnitInfo(tx, lines);

      await tx.invoiceLineItem.deleteMany({ where: { invoiceId: id } });
      const revised = await tx.invoice.update({
        where: { id },
        data: {
          discount: input.discount,
          total,
          gstBreakup,
          lineItems: {
            create: lines.map((l) => ({
              inventoryItemId: l.inventoryItemId,
              description: l.description,
              qty: l.qty,
              unitPrice: l.unitPricePaise,
              gstRate: l.gstRateBps,
              unitFactor: l.unitFactor,
              unitLabel: l.unitLabel,
            })),
          },
        },
        include: { lineItems: true, customer: true },
      });

      if (invoice.ticketId) {
        await tx.serviceTicket.update({ where: { id: invoice.ticketId }, data: { actualAmount: total } });
      }

      await tx.auditLog.create({
        data: {
          actorId,
          action: 'INVOICE_REVISED',
          entity: 'Invoice',
          entityId: id,
          before,
          after: { lineItems: input.lineItems, discount: input.discount, total },
        },
      });

      return revised;
    });
  }
}
