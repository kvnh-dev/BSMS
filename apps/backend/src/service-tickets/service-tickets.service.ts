import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { Persona, ServiceChargeInput, ServicePartUsedInput, ServiceTicketIntakeInput } from '@bsms/shared';
import { PrismaService } from '../prisma/prisma.service.js';

// Who may move a ticket into each status. BILLED is reached only by
// creating an Invoice (Phase 3), never via this manual transition — see
// serviceTicketStatusUpdateSchema in packages/shared.
const STATUS_TRANSITION_PERSONAS: Record<string, Persona[]> = {
  INTAKE: ['OWNER', 'TECHNICIAN'],
  APPROVED: ['OWNER', 'TECHNICIAN'],
  IN_SERVICE: ['OWNER', 'TECHNICIAN'],
  DELIVERED: ['OWNER', 'DELIVERY'],
};

@Injectable()
export class ServiceTicketsService {
  constructor(private readonly prisma: PrismaService) {}

  list(status?: string, technicianId?: string) {
    return this.prisma.serviceTicket.findMany({
      where: { ...(status ? { status } : {}), ...(technicianId ? { technicianId } : {}) },
      include: { bike: { include: { customer: true } }, technician: true, deliveredBy: true },
      orderBy:
        status === 'DELIVERED' ? { deliveredAt: { sort: 'desc', nulls: 'last' } } : { createdAt: 'desc' },
    });
  }

  async get(id: string) {
    const ticket = await this.prisma.serviceTicket.findUnique({
      where: { id },
      include: {
        bike: { include: { customer: true } },
        technician: true,
        deliveredBy: true,
        partsUsed: { include: { inventoryItem: true } },
        serviceCharges: true,
        estimate: true,
        invoice: true,
      },
    });
    if (!ticket) throw new NotFoundException('Service ticket not found');
    return ticket;
  }

  // A Technician creating their own intake defaults to self-assigned (they're
  // typically the one who'll do the work); an Owner can hand off to anyone
  // via technicianId, since only Owner can see the worker list to pick from
  // (see UsersController) — see WEB_APP_PLAN.md's 2026-09-12 usability pass.
  create(input: ServiceTicketIntakeInput, actorId: string, actorPersonas: Persona[]) {
    const technicianId = input.technicianId ?? (actorPersonas.includes('TECHNICIAN') ? actorId : undefined);
    return this.prisma.serviceTicket.create({ data: { ...input, technicianId } });
  }

  async updateStatus(id: string, status: string, actorId: string, actorPersonas: Persona[]) {
    const allowed = STATUS_TRANSITION_PERSONAS[status];
    if (!allowed || !allowed.some((p) => actorPersonas.includes(p))) {
      throw new ForbiddenException(`Not permitted to set status to ${status}`);
    }
    const ticket = await this.get(id);
    if (status === 'DELIVERED' && ticket.status !== 'BILLED') {
      throw new BadRequestException('Ticket must be billed before it can be marked delivered');
    }
    return this.prisma.serviceTicket.update({
      where: { id },
      data:
        status === 'DELIVERED' ? { status, deliveredById: actorId, deliveredAt: new Date() } : { status },
    });
  }

  // Parts and charges are the *actual* record of work done, entered while
  // servicing the bike — deliberately gated to IN_SERVICE, matching the
  // real front-desk journey: intake -> estimate (to inform the customer,
  // doesn't touch inventory) -> customer approves -> in service (now record
  // what's actually used/charged) -> bill from that actual record.
  private async assertInService(ticketId: string) {
    const ticket = await this.get(ticketId);
    if (ticket.status !== 'IN_SERVICE') {
      throw new BadRequestException(
        'Parts and service charges can only be added once the ticket is In Service',
      );
    }
    return ticket;
  }

  // Deducts stock atomically with recording the part used — mirrors
  // InventoryService.adjustStock's transaction pattern. Captures price *and*
  // GST rate at time of use so billing never depends on the inventory
  // item's current rate.
  async addPartUsed(ticketId: string, input: ServicePartUsedInput) {
    await this.assertInService(ticketId);
    const item = await this.prisma.inventoryItem.findUnique({ where: { id: input.inventoryItemId } });
    if (!item) throw new NotFoundException('Inventory item not found');
    // qty is in the item's sale unit; stock is always tracked in baseUnit —
    // saleUnitFactor converts between them (1 when the item has no
    // configured sale unit, so behavior is unchanged for existing items).
    const baseQty = input.qty * item.saleUnitFactor;
    if (item.stockQty < baseQty) {
      throw new BadRequestException('Not enough stock for this item');
    }

    const [partUsed] = await this.prisma.$transaction([
      this.prisma.servicePartUsed.create({
        data: {
          ticketId,
          inventoryItemId: input.inventoryItemId,
          qty: input.qty,
          priceAtUse: item.unitPrice,
          gstRateAtUse: item.gstRate,
          unitFactor: item.saleUnitFactor,
          unitLabel: item.saleUnit,
        },
      }),
      this.prisma.inventoryItem.update({
        where: { id: input.inventoryItemId },
        data: { stockQty: item.stockQty - baseQty },
      }),
    ]);
    return partUsed;
  }

  async addServiceCharge(ticketId: string, input: ServiceChargeInput) {
    await this.assertInService(ticketId);
    return this.prisma.serviceCharge.create({
      data: {
        ticketId,
        description: input.description,
        amount: input.amount,
        gstRate: input.gstRate,
      },
    });
  }
}
