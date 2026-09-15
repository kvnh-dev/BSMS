import { Injectable } from '@nestjs/common';
import type { ExpenseInput } from '@bsms/shared';
import { PrismaService } from '../prisma/prisma.service.js';
import { LedgerService } from '../ledger/ledger.service.js';

@Injectable()
export class ExpensesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: LedgerService,
  ) {}

  // No backing domain record (unlike every other posting), so sourceId is
  // a freshly generated id shared by both legs — matches how every other
  // posting's sourceId groups a transaction's legs together.
  async create(input: ExpenseInput) {
    const sourceId = crypto.randomUUID();
    await this.prisma.$transaction(async (tx) => {
      await this.ledger.postToAccountId(
        tx,
        'MANUAL_EXPENSE',
        sourceId,
        input.accountId,
        [{ account: 'Cash/Bank', credit: input.amount }],
        { debit: input.amount, narration: input.narration },
      );
    });
    return { sourceId };
  }

  // The debit leg *is* the expense row — no separate Expense model, same
  // "derive, don't duplicate" reasoning as Invoice/PurchaseBill's
  // paidAmount/balanceDue.
  list() {
    return this.prisma.ledgerEntry.findMany({
      where: { sourceType: 'MANUAL_EXPENSE', debit: { gt: 0 } },
      include: { account: { select: { name: true } } },
      orderBy: { date: 'desc' },
    });
  }
}
