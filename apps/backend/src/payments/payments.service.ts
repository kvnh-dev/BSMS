import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { Persona, RecordPaymentInput } from '@bsms/shared';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class PaymentsService {
  constructor(private readonly prisma: PrismaService) {}

  async record(invoiceId: string, recordedById: string, input: RecordPaymentInput) {
    const invoice = await this.prisma.invoice.findUnique({ where: { id: invoiceId } });
    if (!invoice) throw new NotFoundException('Invoice not found');
    if (invoice.status !== 'FINAL') {
      throw new BadRequestException('Only a finalized invoice can receive a payment');
    }
    return this.prisma.payment.create({
      data: { invoiceId, amount: input.amount, mode: input.mode, reference: input.reference, recordedById },
      include: { recordedBy: { select: { name: true } } },
    });
  }

  list(invoiceId: string) {
    return this.prisma.payment.findMany({
      where: { invoiceId },
      include: { recordedBy: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  // Owner-only, audit-logged — never a hard delete, same immutability
  // precedent as InvoicesService.revise(): a mistaken payment stays in the
  // record with an explanation, rather than disappearing.
  async void(id: string, actorId: string, actorPersonas: Persona[], reason: string) {
    if (!actorPersonas.includes('OWNER')) {
      throw new ForbiddenException('Only the Owner can void a payment');
    }
    const payment = await this.prisma.payment.findUnique({ where: { id } });
    if (!payment) throw new NotFoundException('Payment not found');
    if (payment.voided) throw new BadRequestException('This payment is already voided');

    return this.prisma.$transaction(async (tx) => {
      const voided = await tx.payment.update({
        where: { id },
        data: { voided: true, voidedReason: reason },
      });
      await tx.auditLog.create({
        data: {
          actorId,
          action: 'PAYMENT_VOIDED',
          entity: 'Payment',
          entityId: id,
          before: { voided: false },
          after: { voided: true, voidedReason: reason },
        },
      });
      return voided;
    });
  }

  // Used by InvoicesService to compute paidAmount/balanceDue on a single
  // invoice without storing a derived field — see the schema comment on
  // Payment for why this stays computed rather than persisted.
  async totalPaidForInvoice(invoiceId: string): Promise<number> {
    const result = await this.prisma.payment.aggregate({
      where: { invoiceId, voided: false },
      _sum: { amount: true },
    });
    return result._sum.amount ?? 0;
  }

  // Batch version for list views — one groupBy instead of an aggregate
  // query per invoice row.
  async totalsPaidForInvoices(invoiceIds: string[]): Promise<Map<string, number>> {
    if (invoiceIds.length === 0) return new Map();
    const rows = await this.prisma.payment.groupBy({
      by: ['invoiceId'],
      where: { invoiceId: { in: invoiceIds }, voided: false },
      _sum: { amount: true },
    });
    return new Map(rows.map((r) => [r.invoiceId, r._sum.amount ?? 0]));
  }
}
