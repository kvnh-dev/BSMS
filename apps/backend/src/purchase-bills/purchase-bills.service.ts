import { Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import {
  calcGstBreakup,
  calcInvoiceTotal,
  lineItemTaxableValue,
  type CreatePurchaseBillInput,
  type PurchaseLineItemInput,
} from '@bsms/shared';
import { PrismaService } from '../prisma/prisma.service.js';
import { SupplierPaymentsService } from '../supplier-payments/supplier-payments.service.js';
import { LedgerService } from '../ledger/ledger.service.js';

interface ResolvedLine extends PurchaseLineItemInput {
  unitFactor: number;
  unitLabel: string | null;
}

@Injectable()
export class PurchaseBillsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly payments: SupplierPaymentsService,
    private readonly ledger: LedgerService,
  ) {}

  // paidAmount/balanceDue computed here, never stored — same "derive, don't
  // duplicate" reasoning as InvoicesService. A PurchaseBill has no DRAFT
  // stage, so every bill (unlike a DRAFT Invoice) always reports a real
  // balance.
  async list() {
    const bills = await this.prisma.purchaseBill.findMany({
      include: { supplier: true, lineItems: true },
      orderBy: { createdAt: 'desc' },
    });
    const paidByBill = await this.payments.totalsPaidForBills(bills.map((b) => b.id));
    return bills.map((bill) => {
      const paidAmount = paidByBill.get(bill.id) ?? 0;
      return { ...bill, paidAmount, balanceDue: bill.total - paidAmount };
    });
  }

  async get(id: string) {
    const bill = await this.prisma.purchaseBill.findUnique({
      where: { id },
      include: {
        supplier: true,
        lineItems: { include: { inventoryItem: { select: { name: true, hsnCode: true } } } },
        recordedBy: true,
      },
    });
    if (!bill) throw new NotFoundException('Purchase bill not found');
    const paidAmount = await this.payments.totalPaidForBill(id);
    return { ...bill, paidAmount, balanceDue: bill.total - paidAmount };
  }

  // Resolves each line's current purchaseUnitFactor/purchaseUnit for the
  // stock ledger — mirrors InvoicesService.attachUnitInfo, using the
  // purchase-side unit instead of the sale-side one.
  private async attachUnitInfo(
    tx: Prisma.TransactionClient,
    lines: PurchaseLineItemInput[],
  ): Promise<ResolvedLine[]> {
    return Promise.all(
      lines.map(async (l) => {
        if (!l.inventoryItemId) return { ...l, unitFactor: 1, unitLabel: null };
        const item = await tx.inventoryItem.findUnique({ where: { id: l.inventoryItemId } });
        if (!item) throw new NotFoundException(`Inventory item ${l.inventoryItemId} not found`);
        return { ...l, unitFactor: item.purchaseUnitFactor, unitLabel: item.purchaseUnit };
      }),
    );
  }

  // Recorded once, single-stage — unlike Invoice there's no DRAFT to review
  // first: stock moves immediately in the same transaction, the direct
  // mirror of InvoicesService.finalize()'s stock decrement but in reverse.
  async create(recordedById: string, input: CreatePurchaseBillInput) {
    return this.prisma.$transaction(async (tx) => {
      const lines = input.lineItems.map((l) => ({
        inventoryItemId: l.inventoryItemId,
        description: l.description,
        qty: l.qty,
        unitPricePaise: l.unitPrice,
        gstRateBps: l.gstRate,
      }));
      const gstBreakupRaw = calcGstBreakup(lines);
      const gstBreakup = gstBreakupRaw as unknown as Prisma.InputJsonValue;
      const total = calcInvoiceTotal(lines, input.discount);
      const taxable = lines.reduce((sum, l) => sum + lineItemTaxableValue(l), 0);
      const gst = gstBreakupRaw.cgstPaise + gstBreakupRaw.sgstPaise;
      const resolvedLines = await this.attachUnitInfo(tx, input.lineItems);

      for (const line of resolvedLines) {
        if (!line.inventoryItemId) continue;
        const baseQty = line.qty * line.unitFactor;
        await tx.inventoryItem.update({
          where: { id: line.inventoryItemId },
          data: { stockQty: { increment: baseQty } },
        });
      }

      const bill = await tx.purchaseBill.create({
        data: {
          billNumber: input.billNumber,
          supplierId: input.supplierId,
          discount: input.discount,
          total,
          gstBreakup,
          recordedById,
          lineItems: {
            create: resolvedLines.map((l) => ({
              inventoryItemId: l.inventoryItemId,
              description: l.description,
              qty: l.qty,
              unitPrice: l.unitPrice,
              gstRate: l.gstRate,
              unitFactor: l.unitFactor,
              unitLabel: l.unitLabel,
            })),
          },
        },
        include: { lineItems: true, supplier: true },
      });

      // No revise path exists for PurchaseBill ("recorded once"), so unlike
      // Invoice there's no reversal case to handle here.
      await this.ledger.post(tx, 'PURCHASE_BILL', bill.id, [
        { account: 'Purchases', debit: taxable, narration: bill.billNumber ?? undefined },
        { account: 'GST Receivable', debit: gst, narration: bill.billNumber ?? undefined },
        ...(input.discount > 0
          ? [{ account: 'Discount Received' as const, credit: input.discount, narration: bill.billNumber ?? undefined }]
          : []),
        { account: 'Sundry Creditors', credit: total, narration: bill.billNumber ?? undefined },
      ]);

      return bill;
    });
  }
}
