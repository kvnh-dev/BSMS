import { Controller, Get, Query } from '@nestjs/common';
import { LedgerService } from './ledger.service.js';
import { RequirePersonas } from '../auth/personas.decorator.js';

// Read-only — no CRUD on accounts (fixed, seeded chart) and no direct
// journal-entry endpoint (see expenses/ for the one manual-posting path).
// Same "Owner + Auditor view-only" RBAC as ReportsController.
@RequirePersonas('OWNER', 'AUDITOR')
@Controller('ledger')
export class LedgerController {
  constructor(private readonly ledger: LedgerService) {}

  @Get('accounts')
  accounts() {
    return this.ledger.listAccounts();
  }

  @Get('trial-balance')
  trialBalance(@Query('asOf') asOf?: string) {
    // A plain YYYY-MM-DD `asOf` parses as that day's UTC midnight — push to
    // end of that calendar day, same reasoning as ReportsController.gstExport's `to`.
    const asOfDate = asOf ? new Date(new Date(asOf).getTime() + 24 * 60 * 60 * 1000 - 1) : new Date();
    return this.ledger.trialBalance(asOfDate);
  }

  @Get('profit-and-loss')
  profitAndLoss(@Query('from') from?: string, @Query('to') to?: string) {
    const now = new Date();
    const fromDate = from ? new Date(from) : new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1));
    const toDate = to ? new Date(new Date(to).getTime() + 24 * 60 * 60 * 1000 - 1) : now;
    return this.ledger.profitAndLoss(fromDate, toDate);
  }
}
