import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { calcGstBreakup, calcInvoiceTotal, type SaleOrderInput } from '@bsms/shared';
import { PrismaService } from '../prisma/prisma.service.js';
import { InvoicesService } from '../invoices/invoices.service.js';

@Injectable()
export class SaleOrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly invoices: InvoicesService,
  ) {}

  list() {
    return this.prisma.saleOrder.findMany({
      include: { customer: true, lineItems: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async get(id: string) {
    const order = await this.prisma.saleOrder.findUnique({
      where: { id },
      include: { customer: true, lineItems: true, invoice: true, createdBy: true },
    });
    if (!order) throw new NotFoundException('Sale order not found');
    return order;
  }

  // Resolves each line's current saleUnitFactor/saleUnit so it can be
  // snapshotted onto the SaleOrderLineItem — a sale order doesn't touch
  // stock, but still records what unit the customer was quoted in, for
  // consistent display until it's converted (at which point
  // InvoicesService.create resolves its own, independent snapshot).
  private async attachUnitInfo(lineItems: SaleOrderInput['lineItems']) {
    return Promise.all(
      lineItems.map(async (l) => {
        if (!l.inventoryItemId) return { ...l, unitFactor: 1, unitLabel: null as string | null };
        const item = await this.prisma.inventoryItem.findUnique({ where: { id: l.inventoryItemId } });
        if (!item) throw new NotFoundException(`Inventory item ${l.inventoryItemId} not found`);
        return { ...l, unitFactor: item.saleUnitFactor, unitLabel: item.saleUnit };
      }),
    );
  }

  // Deliberately mirrors nothing from InvoicesService — a Sale Order never
  // touches stock or invoice numbering, it's a pre-invoice commitment only.
  // See the schema comment on SaleOrder.
  async create(createdById: string, input: SaleOrderInput) {
    const lines = input.lineItems.map((l) => ({
      qty: l.qty,
      unitPricePaise: l.unitPrice,
      gstRateBps: l.gstRate,
    }));
    const gstBreakup = calcGstBreakup(lines) as unknown as Prisma.InputJsonValue;
    const total = calcInvoiceTotal(lines, input.discount);
    const resolvedLines = await this.attachUnitInfo(input.lineItems);

    return this.prisma.saleOrder.create({
      data: {
        status: 'OPEN',
        customerId: input.customerId,
        discount: input.discount,
        total,
        gstBreakup,
        createdById,
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
      include: { lineItems: true, customer: true },
    });
  }

  async update(id: string, input: SaleOrderInput) {
    const order = await this.prisma.saleOrder.findUnique({ where: { id } });
    if (!order) throw new NotFoundException('Sale order not found');
    if (order.status !== 'OPEN') {
      throw new BadRequestException('Only an open sale order can be edited');
    }

    const lines = input.lineItems.map((l) => ({
      qty: l.qty,
      unitPricePaise: l.unitPrice,
      gstRateBps: l.gstRate,
    }));
    const gstBreakup = calcGstBreakup(lines) as unknown as Prisma.InputJsonValue;
    const total = calcInvoiceTotal(lines, input.discount);
    const resolvedLines = await this.attachUnitInfo(input.lineItems);

    return this.prisma.$transaction(async (tx) => {
      await tx.saleOrderLineItem.deleteMany({ where: { saleOrderId: id } });
      return tx.saleOrder.update({
        where: { id },
        data: {
          customerId: input.customerId,
          discount: input.discount,
          total,
          gstBreakup,
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
        include: { lineItems: true, customer: true },
      });
    });
  }

  async cancel(id: string) {
    const order = await this.prisma.saleOrder.findUnique({ where: { id } });
    if (!order) throw new NotFoundException('Sale order not found');
    if (order.status !== 'OPEN') {
      throw new BadRequestException('Only an open sale order can be cancelled');
    }
    return this.prisma.saleOrder.update({ where: { id }, data: { status: 'CANCELLED' } });
  }

  // Converts an OPEN sale order into a real DRAFT invoice — hands off to the
  // existing, already-tested InvoicesService.create() so finalize/revise/
  // stock-deduction/GST-numbering all behave exactly as they do for any
  // other standalone-sale invoice from that point on.
  async convert(id: string, cashierId: string) {
    const order = await this.get(id);
    if (order.status !== 'OPEN') {
      throw new BadRequestException('Only an open sale order can be converted');
    }

    const invoice = await this.invoices.create(cashierId, {
      customerId: order.customerId,
      discount: order.discount,
      lineItems: order.lineItems.map((l) => ({
        inventoryItemId: l.inventoryItemId ?? undefined,
        description: l.description,
        qty: l.qty,
        unitPrice: l.unitPrice,
        gstRate: l.gstRate,
      })),
    });

    await this.prisma.saleOrder.update({
      where: { id },
      data: { status: 'CONVERTED', invoiceId: invoice.id },
    });

    return invoice;
  }
}
