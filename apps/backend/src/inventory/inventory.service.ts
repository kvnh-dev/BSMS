import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { InventoryItemInput, InventoryStockAdjustInput } from '@bsms/shared';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class InventoryService {
  constructor(private readonly prisma: PrismaService) {}

  list() {
    return this.prisma.inventoryItem.findMany({ orderBy: { name: 'asc' } });
  }

  async get(id: string) {
    const item = await this.prisma.inventoryItem.findUnique({ where: { id } });
    if (!item) throw new NotFoundException('Inventory item not found');
    return item;
  }

  // SKU/barcode are the only unique, user-typed fields on this model — a
  // duplicate is a plausible data-entry mistake, so it gets a friendly 400
  // instead of bubbling up as a raw Prisma P2002.
  async findByCode(code: string) {
    const item = await this.prisma.inventoryItem.findFirst({
      where: { OR: [{ sku: code }, { barcode: code }] },
    });
    if (!item) throw new NotFoundException('No item matches that code');
    return item;
  }

  // Powers the Go To bar's live inventory search — fuzzy/partial, unlike
  // findByCode's exact match used by the barcode scanner.
  search(query: string) {
    return this.prisma.inventoryItem.findMany({
      where: {
        OR: [
          { name: { contains: query, mode: 'insensitive' } },
          { sku: { contains: query, mode: 'insensitive' } },
          { barcode: { contains: query, mode: 'insensitive' } },
          { category: { contains: query, mode: 'insensitive' } },
        ],
      },
      take: 20,
    });
  }

  create(input: InventoryItemInput) {
    return this.prisma.inventoryItem.create({ data: input }).catch((err) => this.rethrowUniqueViolation(err));
  }

  async update(id: string, input: Partial<InventoryItemInput>) {
    await this.get(id);
    return this.prisma.inventoryItem
      .update({ where: { id }, data: input })
      .catch((err) => this.rethrowUniqueViolation(err));
  }

  private rethrowUniqueViolation(err: unknown): never {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw new BadRequestException('SKU or barcode already in use');
    }
    throw err;
  }

  async delete(id: string) {
    await this.get(id);
    return this.prisma.inventoryItem.delete({ where: { id } });
  }

  // Logged to AuditLog since stock changes outside a sale/service flow
  // (manual corrections, restocking) are the kind of action an Auditor
  // needs to be able to trace (plan §4/§5).
  //
  // stockQty is always denominated in baseUnit. `unit: 'PURCHASE'` lets a
  // restock be entered in the item's purchase unit (e.g. "2 boxes") — the
  // delta is converted to base units here before it ever touches the DB, so
  // the persisted quantity is unambiguous everywhere else in the app.
  async adjustStock(id: string, actorId: string, input: InventoryStockAdjustInput) {
    const item = await this.get(id);
    let baseDelta = input.delta;
    if (input.unit === 'PURCHASE') {
      if (!item.purchaseUnit) {
        throw new BadRequestException('This item has no purchase unit configured');
      }
      baseDelta = input.delta * item.purchaseUnitFactor;
    }
    const newQty = item.stockQty + baseDelta;
    if (newQty < 0) {
      throw new BadRequestException('Stock adjustment would result in negative quantity');
    }
    const [updated] = await this.prisma.$transaction([
      this.prisma.inventoryItem.update({ where: { id }, data: { stockQty: newQty } }),
      this.prisma.auditLog.create({
        data: {
          actorId,
          action: 'INVENTORY_STOCK_ADJUST',
          entity: 'InventoryItem',
          entityId: id,
          before: { stockQty: item.stockQty },
          after: {
            stockQty: newQty,
            reason: input.reason,
            delta: input.delta,
            unit: input.unit,
            baseDelta,
          },
        },
      }),
    ]);
    return updated;
  }
}
