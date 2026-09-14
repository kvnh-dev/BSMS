import { Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { calcGstBreakup, calcInvoiceTotal, type CreateEstimateInput } from '@bsms/shared';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class EstimatesService {
  constructor(private readonly prisma: PrismaService) {}

  async get(ticketId: string) {
    const estimate = await this.prisma.estimate.findUnique({ where: { ticketId } });
    if (!estimate) throw new NotFoundException('No estimate for this ticket yet');
    return estimate;
  }

  // Upsert: a technician may revise an estimate before the customer
  // approves it, and the schema models one estimate per ticket.
  async createOrReplace(ticketId: string, actorId: string, input: CreateEstimateInput) {
    const ticket = await this.prisma.serviceTicket.findUnique({ where: { id: ticketId } });
    if (!ticket) throw new NotFoundException('Service ticket not found');

    const lines = input.lineItems.map((l) => ({
      qty: l.qty,
      unitPricePaise: l.unitPricePaise,
      gstRateBps: l.gstRateBps,
    }));
    const gstBreakup = calcGstBreakup(lines) as unknown as Prisma.InputJsonValue;
    const lineItems = input.lineItems as unknown as Prisma.InputJsonValue;
    const total = calcInvoiceTotal(lines, input.discount);

    const estimate = await this.prisma.estimate.upsert({
      where: { ticketId },
      create: {
        ticketId,
        lineItems,
        gstBreakup,
        discount: input.discount,
        createdById: actorId,
      },
      update: {
        lineItems,
        gstBreakup,
        discount: input.discount,
        createdById: actorId,
      },
    });

    await this.prisma.serviceTicket.update({
      where: { id: ticketId },
      data: { estimateAmount: total },
    });

    return estimate;
  }
}
