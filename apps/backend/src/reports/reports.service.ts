import { Injectable } from '@nestjs/common';
import { lineItemGstAmount, lineItemTaxableValue } from '@bsms/shared';
import { PrismaService } from '../prisma/prisma.service.js';
import { PaymentsService } from '../payments/payments.service.js';
import { SupplierPaymentsService } from '../supplier-payments/supplier-payments.service.js';

// Unlike attendance.service.ts's same-named helpers (which deliberately
// build a Date.UTC(local components) value for consistent @db.Date storage
// — see that file's comment), these compare against Invoice.createdAt, a
// real timestamptz "this exact moment" value. Using Date.UTC here would
// silently shift "today" by the server's UTC offset: for IST (+5:30),
// startOfToday() would land 5.5h in the *future* between local midnight and
// 5:30am local, making "today's sales" wrongly read as zero during that
// window. The plain local-timezone constructor gives the true instant of
// local midnight, which compares correctly against createdAt.
function startOfMonth(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

function startOfToday(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

// Attendance.date is a @db.Date column, written by attendance.service.ts's
// own UTC-based startOfToday() (Date.UTC of local calendar components) — NOT
// the local-timezone startOfToday() above, which is for timestamptz columns.
// Reusing the local one here would compare against the wrong stored value
// and silently miss today's attendance rows near the UTC/local day boundary.
function startOfTodayUTC(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
}

const TREND_DAYS = 8;
const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// Local calendar-day key (not toISOString, which is UTC and drifts the date
// for positive offsets like IST — local midnight is 18:30 UTC the *previous*
// day, so a UTC-based key would put every trend bucket one day off from the
// invoices' own local calendar day, silently dropping today's sales).
function localDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly payments: PaymentsService,
    private readonly supplierPayments: SupplierPaymentsService,
  ) {}

  // Every FINAL invoice with a non-zero balance due, oldest first — the
  // "who owes me money" view. balanceDue is computed the same way
  // InvoicesService does it (never stored), just batched for the whole list.
  async receivables() {
    const invoices = await this.prisma.invoice.findMany({
      where: { status: 'FINAL' },
      include: { customer: { select: { name: true, phone: true } } },
      orderBy: { createdAt: 'asc' },
    });
    const paidByInvoice = await this.payments.totalsPaidForInvoices(invoices.map((i) => i.id));
    return invoices
      .map((invoice) => {
        const paidAmount = paidByInvoice.get(invoice.id) ?? 0;
        return {
          id: invoice.id,
          invoiceNumber: invoice.invoiceNumber,
          customer: invoice.customer,
          createdAt: invoice.createdAt,
          total: invoice.total,
          paidAmount,
          balanceDue: invoice.total - paidAmount,
        };
      })
      .filter((invoice) => invoice.balanceDue > 0);
  }

  async dashboardSummary(technicianPeriod: 'day' | 'month' = 'month') {
    const today = startOfToday();
    const monthStart = startOfMonth();
    const technicianWindowStart = technicianPeriod === 'day' ? today : monthStart;

    const trendStart = new Date(today.getTime() - (TREND_DAYS - 1) * 24 * 60 * 60 * 1000);

    const [
      todayInvoices,
      monthInvoices,
      ticketsByStatus,
      technicianCounts,
      trendInvoices,
      pendingCounts,
      attendanceToday,
      allInventory,
      finalInvoicesTotal,
      paidTotal,
    ] = await Promise.all([
        this.prisma.invoice.aggregate({ where: { createdAt: { gte: today } }, _sum: { total: true } }),
        this.prisma.invoice.findMany({ where: { createdAt: { gte: monthStart } }, select: { gstBreakup: true, total: true } }),
        this.prisma.serviceTicket.groupBy({ by: ['status'], _count: { _all: true } }),
        this.prisma.serviceTicket.groupBy({
          by: ['technicianId'],
          // deliveredAt, not updatedAt: the schema captures this once, at the
          // actual DELIVERED transition, specifically so a later unrelated
          // edit to the ticket can't shift it in or out of this window.
          where: { status: 'DELIVERED', deliveredAt: { gte: technicianWindowStart }, technicianId: { not: null } },
          _count: { _all: true },
        }),
        this.prisma.invoice.findMany({ where: { createdAt: { gte: trendStart } }, select: { createdAt: true, total: true } }),
        // "Pending" = assigned to a technician but not yet handed back to the
        // customer — everything short of DELIVERED, not just IN_SERVICE, so
        // a ticket sitting in BILLED (paid, not yet picked up) still counts
        // against that technician's open workload.
        this.prisma.serviceTicket.groupBy({
          by: ['technicianId'],
          where: { status: { not: 'DELIVERED' }, technicianId: { not: null } },
          _count: { _all: true },
        }),
        this.prisma.attendance.findMany({
          where: { date: startOfTodayUTC() },
          include: { user: { select: { id: true, name: true } } },
          orderBy: { checkIn: 'desc' },
        }),
        // stockQty <= reorderPoint can't be expressed as a Prisma `where`
        // filter (no field-to-field comparison without raw SQL), so this
        // fetches every item's two int columns and compares in JS below —
        // the same trade-off the inventory list page already makes.
        this.prisma.inventoryItem.findMany({ select: { id: true, name: true, stockQty: true, reorderPoint: true } }),
        this.prisma.invoice.aggregate({ where: { status: 'FINAL' }, _sum: { total: true } }),
        this.prisma.payment.aggregate({ where: { voided: false, invoice: { status: 'FINAL' } }, _sum: { amount: true } }),
      ]);

    const outstandingReceivablesPaise = (finalInvoicesTotal._sum.total ?? 0) - (paidTotal._sum.amount ?? 0);

    const [purchaseBillsTotal, supplierPaidTotal] = await Promise.all([
      this.prisma.purchaseBill.aggregate({ _sum: { total: true } }),
      this.prisma.supplierPayment.aggregate({ where: { voided: false }, _sum: { amount: true } }),
    ]);
    const payablesPaise = (purchaseBillsTotal._sum.total ?? 0) - (supplierPaidTotal._sum.amount ?? 0);

    const trendByDay = new Map<string, number>();
    const trendDayOfWeek = new Map<string, number>();
    for (let i = 0; i < TREND_DAYS; i++) {
      const d = new Date(trendStart.getTime() + i * 24 * 60 * 60 * 1000);
      const key = localDateKey(d);
      trendByDay.set(key, 0);
      trendDayOfWeek.set(key, d.getDay());
    }
    for (const inv of trendInvoices) {
      const key = localDateKey(inv.createdAt);
      if (trendByDay.has(key)) trendByDay.set(key, (trendByDay.get(key) ?? 0) + inv.total);
    }
    const salesTrend = Array.from(trendByDay.entries()).map(([dateKey, totalPaise], i) => ({
      label: i === TREND_DAYS - 1 ? 'Today' : DAY_LABELS[trendDayOfWeek.get(dateKey)!],
      totalPaise,
    }));

    const monthSales = monthInvoices.reduce((sum, inv) => sum + inv.total, 0);
    const gstLiabilityMonth = monthInvoices.reduce((sum, inv) => {
      const b = inv.gstBreakup as { cgstPaise: number; sgstPaise: number; igstPaise: number };
      return sum + b.cgstPaise + b.sgstPaise + b.igstPaise;
    }, 0);

    const technicianIds = [
      ...new Set(
        [...technicianCounts, ...pendingCounts].map((t) => t.technicianId).filter((id): id is string => !!id),
      ),
    ];
    const technicians = await this.prisma.user.findMany({
      where: { id: { in: technicianIds } },
      select: { id: true, name: true },
    });
    const technicianPerformance = technicianCounts.map((t) => ({
      technicianId: t.technicianId as string,
      technician: technicians.find((u) => u.id === t.technicianId)?.name ?? 'Unknown',
      ticketsDelivered: t._count._all,
    }));
    const technicianWorkload = pendingCounts.map((t) => ({
      technicianId: t.technicianId as string,
      technician: technicians.find((u) => u.id === t.technicianId)?.name ?? 'Unknown',
      pendingCount: t._count._all,
    }));

    // One attendance record per (user, day) can recur across a shift's
    // check-in/check-out pairs — keep only each user's latest (checkIn desc
    // means the first match per user is the most recent) to answer "who's in
    // right now," not "who was ever in today."
    const seenUsers = new Set<string>();
    const workersToday: { userId: string; name: string; checkIn: Date; checkOut: Date | null; isCheckedIn: boolean }[] = [];
    for (const a of attendanceToday) {
      if (seenUsers.has(a.userId)) continue;
      seenUsers.add(a.userId);
      workersToday.push({
        userId: a.userId,
        name: a.user.name,
        checkIn: a.checkIn,
        checkOut: a.checkOut,
        isCheckedIn: a.checkOut === null,
      });
    }
    workersToday.sort((a, b) => Number(b.isCheckedIn) - Number(a.isCheckedIn) || a.name.localeCompare(b.name));

    const lowStockItems = allInventory
      .filter((i) => i.stockQty <= i.reorderPoint)
      .sort((a, b) => a.stockQty - b.stockQty)
      .slice(0, 50);

    return {
      todaySalesPaise: todayInvoices._sum.total ?? 0,
      monthSalesPaise: monthSales,
      gstLiabilityMonthPaise: gstLiabilityMonth,
      ticketsByStatus: ticketsByStatus.map((t) => ({ status: t.status, count: t._count._all })),
      technicianPerformance,
      technicianWorkload,
      workersToday,
      lowStockItems,
      salesTrend,
      outstandingReceivablesPaise,
      payablesPaise,
    };
  }

  // HSN-wise GST summary (GSTR-1 style) for a date range — recomputed per
  // line rather than reusing Invoice.gstBreakup, since that's a single
  // per-invoice aggregate and this needs to group by HSN code.
  async gstExport(from: Date, to: Date) {
    const lineItems = await this.prisma.invoiceLineItem.findMany({
      where: { invoice: { createdAt: { gte: from, lte: to } } },
      include: { inventoryItem: { select: { hsnCode: true } } },
    });

    const groups = new Map<string, { hsnCode: string; gstRate: number; taxableValuePaise: number; gstPaise: number }>();
    for (const line of lineItems) {
      const hsnCode = line.inventoryItem?.hsnCode ?? 'SERVICE';
      const key = `${hsnCode}:${line.gstRate}`;
      const taxable = lineItemTaxableValue({ qty: line.qty, unitPricePaise: line.unitPrice, gstRateBps: line.gstRate });
      const gst = lineItemGstAmount({ qty: line.qty, unitPricePaise: line.unitPrice, gstRateBps: line.gstRate });
      const existing = groups.get(key);
      if (existing) {
        existing.taxableValuePaise += taxable;
        existing.gstPaise += gst;
      } else {
        groups.set(key, { hsnCode, gstRate: line.gstRate, taxableValuePaise: taxable, gstPaise: gst });
      }
    }

    return Array.from(groups.values()).map((g) => ({
      ...g,
      cgstPaise: Math.round(g.gstPaise / 2),
      sgstPaise: g.gstPaise - Math.round(g.gstPaise / 2),
    }));
  }
}
