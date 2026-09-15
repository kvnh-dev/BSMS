import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { Persona, RecordPaymentInput } from '@bsms/shared';
import { PrismaService } from '../prisma/prisma.service.js';
import { LedgerService } from '../ledger/ledger.service.js';

// Direct mirror of PaymentsService, against PurchaseBill instead of
// Invoice — a PurchaseBill has no DRAFT/FINAL split, so unlike
// PaymentsService.record() there's no status check: any existing bill can
// receive a payment.
@Injectable()
export class SupplierPaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: LedgerService,
  ) {}

  async record(purchaseBillId: string, recordedById: string, input: RecordPaymentInput) {
    const bill = await this.prisma.purchaseBill.findUnique({ where: { id: purchaseBillId } });
    if (!bill) throw new NotFoundException('Purchase bill not found');
    return this.prisma.$transaction(async (tx) => {
      const payment = await tx.supplierPayment.create({
        data: { purchaseBillId, amount: input.amount, mode: input.mode, reference: input.reference, recordedById },
        include: { recordedBy: { select: { name: true } } },
      });
      await this.ledger.post(tx, 'SUPPLIER_PAYMENT', payment.id, [
        { account: 'Sundry Creditors', debit: input.amount },
        { account: 'Cash/Bank', credit: input.amount },
      ]);
      return payment;
    });
  }

  list(purchaseBillId: string) {
    return this.prisma.supplierPayment.findMany({
      where: { purchaseBillId },
      include: { recordedBy: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async void(id: string, actorId: string, actorPersonas: Persona[], reason: string) {
    if (!actorPersonas.includes('OWNER')) {
      throw new ForbiddenException('Only the Owner can void a payment');
    }
    const payment = await this.prisma.supplierPayment.findUnique({ where: { id } });
    if (!payment) throw new NotFoundException('Payment not found');
    if (payment.voided) throw new BadRequestException('This payment is already voided');

    return this.prisma.$transaction(async (tx) => {
      const voided = await tx.supplierPayment.update({
        where: { id },
        data: { voided: true, voidedReason: reason },
      });
      await tx.auditLog.create({
        data: {
          actorId,
          action: 'SUPPLIER_PAYMENT_VOIDED',
          entity: 'SupplierPayment',
          entityId: id,
          before: { voided: false },
          after: { voided: true, voidedReason: reason },
        },
      });
      // Exact reverse of the original SUPPLIER_PAYMENT posting.
      await this.ledger.post(tx, 'SUPPLIER_PAYMENT_VOID', id, [
        { account: 'Cash/Bank', debit: payment.amount },
        { account: 'Sundry Creditors', credit: payment.amount },
      ]);
      return voided;
    });
  }

  async totalPaidForBill(purchaseBillId: string): Promise<number> {
    const result = await this.prisma.supplierPayment.aggregate({
      where: { purchaseBillId, voided: false },
      _sum: { amount: true },
    });
    return result._sum.amount ?? 0;
  }

  async totalsPaidForBills(purchaseBillIds: string[]): Promise<Map<string, number>> {
    if (purchaseBillIds.length === 0) return new Map();
    const rows = await this.prisma.supplierPayment.groupBy({
      by: ['purchaseBillId'],
      where: { purchaseBillId: { in: purchaseBillIds }, voided: false },
      _sum: { amount: true },
    });
    return new Map(rows.map((r) => [r.purchaseBillId, r._sum.amount ?? 0]));
  }
}
