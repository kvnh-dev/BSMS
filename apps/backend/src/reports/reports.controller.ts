import { Controller, Get, Query } from '@nestjs/common';
import { ReportsService } from './reports.service.js';
import { RequirePersonas } from '../auth/personas.decorator.js';

// "View dashboard/reports" and "Export GST/reports": Owner + Auditor per
// the RBAC matrix (plan §5) — both view-only for Auditor, which is
// naturally satisfied since this controller has no mutation routes.
@RequirePersonas('OWNER', 'AUDITOR')
@Controller('reports')
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get('dashboard-summary')
  dashboardSummary(@Query('period') period?: 'day' | 'month') {
    return this.reports.dashboardSummary(period === 'day' ? 'day' : 'month');
  }

  @Get('gst-export')
  gstExport(@Query('from') from?: string, @Query('to') to?: string) {
    const now = new Date();
    const fromDate = from ? new Date(from) : new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1));
    // A plain YYYY-MM-DD `to` parses as that day's UTC midnight — the start
    // of the day, not the end — which would silently exclude same-day sales
    // made later that day. Push it to the end of that calendar day instead.
    const toDate = to ? new Date(new Date(to).getTime() + 24 * 60 * 60 * 1000 - 1) : now;
    return this.reports.gstExport(fromDate, toDate);
  }
}
