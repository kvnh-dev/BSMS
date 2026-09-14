import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { calcGstBreakup, calcInvoiceTotal, type PurchaseOrderInput } from '@bsms/shared';
import { PrismaService } from '../prisma/prisma.service.js';
import { PurchaseBillsService } from '../purchase-bills/purchase-bills.service.js';

// Direct mirror of SaleOrdersService, against Supplier/PurchaseBill instead
// of Customer/Invoice.
@Injectable()
export class PurchaseOrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly purchaseBills: PurchaseBillsService,
  ) {}

  list() {
    return this.prisma.purchaseOrder.findMany({
      include: { supplier: true, lineItems: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async get(id: string) {
    const order = await this.prisma.purchaseOrder.findUnique({
      where: { id },
      include: { supplier: true, lineItems: true, purchaseBill: true, createdBy: true },
    });
    if (!order) throw new NotFoundException('Purchase order not found');
    return order;
  }

  private async attachUnitInfo(lineItems: PurchaseOrderInput['lineItems']) {
    return Promise.all(
      lineItems.map(async (l) => {
        if (!l.inventoryItemId) return { ...l, unitFactor: 1, unitLabel: null as string | null };
        const item = await this.prisma.inventoryItem.findUnique({ where: { id: l.inventoryItemId } });
        if (!item) throw new NotFoundException(`Inventory item ${l.inventoryItemId} not found`);
        return { ...l, unitFactor: item.purchaseUnitFactor, unitLabel: item.purchaseUnit };
      }),
    );
  }

  async create(createdById: string, input: PurchaseOrderInput) {
    const lines = input.lineItems.map((l) => ({
      qty: l.qty,
      unitPricePaise: l.unitPrice,
      gstRateBps: l.gstRate,
    }));
    const gstBreakup = calcGstBreakup(lines) as unknown as Prisma.InputJsonValue;
    const total = calcInvoiceTotal(lines, input.discount);
    const resolvedLines = await this.attachUnitInfo(input.lineItems);

    return this.prisma.purchaseOrder.create({
      data: {
        status: 'OPEN',
        supplierId: input.supplierId,
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
      include: { lineItems: true, supplier: true },
    });
  }

  async update(id: string, input: PurchaseOrderInput) {
    const order = await this.prisma.purchaseOrder.findUnique({ where: { id } });
    if (!order) throw new NotFoundException('Purchase order not found');
    if (order.status !== 'OPEN') {
      throw new BadRequestException('Only an open purchase order can be edited');
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
      await tx.purchaseOrderLineItem.deleteMany({ where: { purchaseOrderId: id } });
      return tx.purchaseOrder.update({
        where: { id },
        data: {
          supplierId: input.supplierId,
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
        include: { lineItems: true, supplier: true },
      });
    });
  }

  async cancel(id: string) {
    const order = await this.prisma.purchaseOrder.findUnique({ where: { id } });
    if (!order) throw new NotFoundException('Purchase order not found');
    if (order.status !== 'OPEN') {
      throw new BadRequestException('Only an open purchase order can be cancelled');
    }
    return this.prisma.purchaseOrder.update({ where: { id }, data: { status: 'CANCELLED' } });
  }

  // Converts an OPEN purchase order into a real PurchaseBill — hands off to
  // PurchaseBillsService.create(), which moves stock immediately (a
  // PurchaseBill has no DRAFT stage, unlike Invoice).
  async convert(id: string, actorId: string) {
    const order = await this.get(id);
    if (order.status !== 'OPEN') {
      throw new BadRequestException('Only an open purchase order can be converted');
    }

    const bill = await this.purchaseBills.create(actorId, {
      supplierId: order.supplierId,
      discount: order.discount,
      lineItems: order.lineItems.map((l) => ({
        inventoryItemId: l.inventoryItemId ?? undefined,
        description: l.description,
        qty: l.qty,
        unitPrice: l.unitPrice,
        gstRate: l.gstRate,
      })),
    });

    await this.prisma.purchaseOrder.update({
      where: { id },
      data: { status: 'CONVERTED', purchaseBillId: bill.id },
    });

    return bill;
  }
}
