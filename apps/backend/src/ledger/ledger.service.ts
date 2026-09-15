import { Injectable, type OnModuleInit } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { SEEDED_ACCOUNTS, type AccountName } from './ledger.constants.js';

interface Leg {
  account: AccountName;
  debit?: number;
  credit?: number;
  narration?: string;
}

@Injectable()
export class LedgerService implements OnModuleInit {
  constructor(private readonly prisma: PrismaService) {}

  // Runs once per app boot — covers both a fresh install and an
  // already-past-setup showroom (like this dev DB) on its next restart.
  // Unlike GstSlabsService.seedStandardSlabsIfEmpty(), which the setup
  // wizard calls explicitly, this fixed 10-row chart of accounts has no
  // setup-wizard step of its own to hook into.
  async onModuleInit() {
    await this.seedIfEmpty();
  }

  async seedIfEmpty() {
    const count = await this.prisma.account.count();
    if (count > 0) return;
    await this.prisma.account.createMany({ data: [...SEEDED_ACCOUNTS] });
  }

  listAccounts() {
    return this.prisma.account.findMany({ orderBy: { name: 'asc' } });
  }

  // Posts one or more legs of a single transaction inside the caller's own
  // $transaction, so the ledger entries commit atomically with whatever
  // domain row (Invoice, Payment, ...) they describe. Resolves each account
  // by name within the same tx — 10 fixed accounts, so a fresh lookup per
  // leg is fine at this scale and safest against staleness. Asserts the
  // posting balances before writing anything: a caller bug here would
  // otherwise silently corrupt the trial balance.
  async post(tx: Prisma.TransactionClient, sourceType: string, sourceId: string, legs: Leg[]) {
    const totalDebit = legs.reduce((sum, l) => sum + (l.debit ?? 0), 0);
    const totalCredit = legs.reduce((sum, l) => sum + (l.credit ?? 0), 0);
    if (totalDebit !== totalCredit) {
      throw new Error(
        `Unbalanced ledger posting for ${sourceType} ${sourceId}: debit ${totalDebit} != credit ${totalCredit}`,
      );
    }

    for (const leg of legs) {
      const account = await tx.account.findUniqueOrThrow({ where: { name: leg.account } });
      await tx.ledgerEntry.create({
        data: {
          accountId: account.id,
          debit: leg.debit ?? 0,
          credit: leg.credit ?? 0,
          sourceType,
          sourceId,
          narration: leg.narration,
        },
      });
    }
  }

  // Same posting primitive as post(), but for a caller (expenses/) that
  // only has an accountId, not an AccountName — resolves the account row
  // itself and posts against its name, keeping post()'s own signature
  // uniform (always a typed AccountName) for every other, internal caller.
  async postToAccountId(
    tx: Prisma.TransactionClient,
    sourceType: string,
    sourceId: string,
    accountId: string,
    otherLegs: Leg[],
    accountLeg: { debit?: number; credit?: number; narration?: string },
  ) {
    const account = await tx.account.findUniqueOrThrow({ where: { id: accountId } });
    return this.post(tx, sourceType, sourceId, [
      { account: account.name as AccountName, ...accountLeg },
      ...otherLegs,
    ]);
  }

  async trialBalance(asOf: Date) {
    const accounts = await this.prisma.account.findMany({ orderBy: { name: 'asc' } });
    const sums = await this.prisma.ledgerEntry.groupBy({
      by: ['accountId'],
      where: { date: { lte: asOf } },
      _sum: { debit: true, credit: true },
    });
    const sumByAccount = new Map(sums.map((s) => [s.accountId, s._sum]));
    return accounts.map((a) => {
      const sum = sumByAccount.get(a.id);
      return { accountId: a.id, name: a.name, type: a.type, debit: sum?.debit ?? 0, credit: sum?.credit ?? 0 };
    });
  }

  async profitAndLoss(from: Date, to: Date) {
    const accounts = await this.prisma.account.findMany({
      where: { type: { in: ['INCOME', 'EXPENSE'] } },
      orderBy: { name: 'asc' },
    });
    const sums = await this.prisma.ledgerEntry.groupBy({
      by: ['accountId'],
      where: { date: { gte: from, lte: to } },
      _sum: { debit: true, credit: true },
    });
    const sumByAccount = new Map(sums.map((s) => [s.accountId, s._sum]));

    const income = accounts
      .filter((a) => a.type === 'INCOME')
      .map((a) => {
        const sum = sumByAccount.get(a.id);
        return { name: a.name, amount: (sum?.credit ?? 0) - (sum?.debit ?? 0) };
      });
    const expenses = accounts
      .filter((a) => a.type === 'EXPENSE')
      .map((a) => {
        const sum = sumByAccount.get(a.id);
        return { name: a.name, amount: (sum?.debit ?? 0) - (sum?.credit ?? 0) };
      });
    const netProfit =
      income.reduce((sum, i) => sum + i.amount, 0) - expenses.reduce((sum, e) => sum + e.amount, 0);

    return { income, expenses, netProfit };
  }
}
