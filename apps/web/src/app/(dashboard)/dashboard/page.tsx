'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { formatPaiseAsInr } from '@bsms/shared';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { InvoiceIcon, ReportsIcon, GstIcon, ServiceTicketIcon } from '@/components/nav-icons';

interface DashboardSummary {
  todaySalesPaise: number;
  monthSalesPaise: number;
  gstLiabilityMonthPaise: number;
  ticketsByStatus: { status: string; count: number }[];
  technicianPerformance: { technicianId: string; technician: string; ticketsDelivered: number }[];
  technicianWorkload: { technicianId: string; technician: string; pendingCount: number }[];
  workersToday: { userId: string; name: string; checkIn: string; checkOut: string | null; isCheckedIn: boolean }[];
  lowStockItems: { id: string; name: string; stockQty: number; reorderPoint: number }[];
  salesTrend: { label: string; totalPaise: number }[];
}

const STATUS_DOT: Record<string, string> = {
  INTAKE: 'bg-warning',
  APPROVED: 'bg-primary',
  IN_SERVICE: 'bg-primary',
  BILLED: 'bg-info',
  DELIVERED: 'bg-success',
};

function StatCard({
  label,
  value,
  icon,
  sub,
}: {
  label: string;
  value: string;
  icon: React.ReactElement;
  sub?: React.ReactNode;
}) {
  return (
    <Card className="flex flex-col gap-3 p-4.5">
      <div className="flex items-center justify-between">
        <span className="text-[12.5px] font-semibold text-muted-foreground">{label}</span>
        <div className="flex h-7.5 w-7.5 items-center justify-center rounded-[8px] bg-accent text-accent-foreground">
          {icon}
        </div>
      </div>
      <div className="text-[26px] font-extrabold tracking-tight">{value}</div>
      {sub}
    </Card>
  );
}

export default function DashboardPage() {
  const { user, hasPersona } = useAuth();
  const canSeeReports = hasPersona('OWNER', 'AUDITOR');
  const [technicianPeriod, setTechnicianPeriod] = useState<'day' | 'month'>('month');

  const { data: summary, isLoading } = useQuery({
    queryKey: ['reports', 'dashboard-summary', technicianPeriod],
    queryFn: () => api.get<DashboardSummary>(`/reports/dashboard-summary?period=${technicianPeriod}`),
    enabled: canSeeReports,
  });

  if (!canSeeReports) {
    return (
      <div>
        <h1 className="text-[22px] font-extrabold tracking-tight">Welcome, {user?.name}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Sales and GST reporting are visible to Owner and Auditor personas.
        </p>
      </div>
    );
  }

  if (isLoading || !summary) {
    return <p className="text-sm text-muted-foreground">Loading…</p>;
  }

  const maxTrend = Math.max(...summary.salesTrend.map((t) => t.totalPaise), 1);

  return (
    <div className="flex flex-col gap-5.5">
      <div>
        <h1 className="text-[22px] font-extrabold tracking-tight">Welcome, {user?.name}</h1>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Today's Sales"
          value={formatPaiseAsInr(summary.todaySalesPaise)}
          icon={<InvoiceIcon className="h-[15px] w-[15px]" />}
        />
        <StatCard
          label="This Month"
          value={formatPaiseAsInr(summary.monthSalesPaise)}
          icon={<ReportsIcon className="h-[15px] w-[15px]" />}
        />
        <StatCard
          label="GST Liability"
          value={formatPaiseAsInr(summary.gstLiabilityMonthPaise)}
          icon={<GstIcon className="h-[15px] w-[15px]" />}
          sub={<span className="text-[11.5px] text-muted-foreground">Due by 20th</span>}
        />
        <StatCard
          label="Open Tickets"
          value={String(summary.ticketsByStatus.filter((t) => t.status !== 'DELIVERED').reduce((n, t) => n + t.count, 0))}
          icon={<ServiceTicketIcon className="h-[15px] w-[15px]" />}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.6fr_1fr]">
        <Card className="p-5">
          <div className="mb-4.5 flex items-center justify-between">
            <div>
              <div className="text-[14.5px] font-bold">Sales trend</div>
              <div className="text-xs text-muted-foreground">Last {summary.salesTrend.length} days</div>
            </div>
          </div>
          <div className="flex h-[140px] items-end gap-3 px-1">
            {summary.salesTrend.map((t, i) => {
              const isLast = i === summary.salesTrend.length - 1;
              // Percentage heights need an explicit-height ancestor to resolve
              // against; `items-end` here means the column divs shrink-to-fit
              // instead of stretching to the row's 140px, so the bar's own
              // height is computed in pixels directly instead.
              const barPx = Math.max(Math.round((t.totalPaise / maxTrend) * 112), 4);
              return (
                <div key={i} className="flex flex-1 flex-col items-center justify-end gap-2">
                  <div
                    className={isLast ? 'w-full max-w-9 rounded-t-md bg-primary' : 'w-full max-w-9 rounded-t-md bg-primary/15'}
                    style={{ height: `${barPx}px` }}
                    title={formatPaiseAsInr(t.totalPaise)}
                  />
                  <span className={isLast ? 'text-[10.5px] font-bold' : 'text-[10.5px] text-muted-foreground'}>
                    {t.label}
                  </span>
                </div>
              );
            })}
          </div>
        </Card>

        <Card className="flex flex-col gap-3.5 p-5">
          <div className="text-[14.5px] font-bold">Tickets by status</div>
          <div className="flex flex-col gap-2.5">
            {summary.ticketsByStatus.map((t) => (
              <div key={t.status} className="flex items-center gap-2.5">
                <span className={`h-2 w-2 rounded-full ${STATUS_DOT[t.status] ?? 'bg-muted-foreground'}`} />
                <span className="flex-1 text-[12.5px]">{t.status.replace('_', ' ')}</span>
                <span className="text-[12.5px] font-bold">{t.count}</span>
              </div>
            ))}
            {summary.ticketsByStatus.length === 0 && (
              <p className="text-sm text-muted-foreground">No tickets yet.</p>
            )}
          </div>

          <div className="mt-0.5 border-t border-border pt-3.5">
            <div className="mb-2.5 flex items-center justify-between">
              <div className="text-[14.5px] font-bold">Technician performance</div>
              <div className="flex gap-1 rounded-md border p-0.5">
                <Button
                  type="button"
                  variant={technicianPeriod === 'day' ? 'default' : 'ghost'}
                  size="sm"
                  className="h-6 px-2 text-xs"
                  onClick={() => setTechnicianPeriod('day')}
                >
                  Today
                </Button>
                <Button
                  type="button"
                  variant={technicianPeriod === 'month' ? 'default' : 'ghost'}
                  size="sm"
                  className="h-6 px-2 text-xs"
                  onClick={() => setTechnicianPeriod('month')}
                >
                  This month
                </Button>
              </div>
            </div>
            {summary.technicianPerformance.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                No deliveries recorded {technicianPeriod === 'day' ? 'today' : 'yet this month'}.
              </p>
            ) : (
              <div className="flex flex-col gap-1.5">
                {summary.technicianPerformance.map((t) => (
                  <Link
                    key={t.technicianId}
                    href={`/service-tickets?technicianId=${t.technicianId}&status=DELIVERED`}
                    className="flex justify-between text-[12.5px] hover:underline"
                  >
                    <span className="font-medium">{t.technician}</span>
                    <span className="text-muted-foreground">{t.ticketsDelivered} delivered</span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </Card>
      </div>

      <div>
        <div className="mb-3 text-[14.5px] font-bold">Today’s Overview</div>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
          <Card className="flex flex-col gap-3 p-5">
            <div className="text-[13px] font-semibold text-muted-foreground">Workers today</div>
            {summary.workersToday.length === 0 ? (
              <p className="text-xs text-muted-foreground">No one has checked in today.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {summary.workersToday.map((w) => (
                  <div key={w.userId} className="flex items-center justify-between text-[12.5px]">
                    <div className="flex items-center gap-2">
                      <span className={`h-2 w-2 rounded-full ${w.isCheckedIn ? 'bg-success' : 'bg-muted-foreground/40'}`} />
                      <span className="font-medium">{w.name}</span>
                    </div>
                    <span className="text-muted-foreground">
                      {w.isCheckedIn
                        ? `In since ${new Date(w.checkIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                        : `Out at ${new Date(w.checkOut!).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card className="flex flex-col gap-3 p-5">
            <div className="text-[13px] font-semibold text-muted-foreground">Bikes in service</div>
            <div className="text-[26px] font-extrabold tracking-tight">
              {summary.ticketsByStatus.find((t) => t.status === 'IN_SERVICE')?.count ?? 0}
            </div>
            <Link href="/service-tickets?status=IN_SERVICE" className="text-[12px] text-muted-foreground hover:underline">
              View tickets in service
            </Link>
          </Card>

          <Card className="flex flex-col gap-3 p-5">
            <div className="text-[13px] font-semibold text-muted-foreground">Pending by technician</div>
            {summary.technicianWorkload.length === 0 ? (
              <p className="text-xs text-muted-foreground">No open tickets right now.</p>
            ) : (
              <div className="flex flex-col gap-1.5">
                {summary.technicianWorkload.map((t) => (
                  <Link
                    key={t.technicianId}
                    href={`/service-tickets?technicianId=${t.technicianId}`}
                    className="flex justify-between text-[12.5px] hover:underline"
                  >
                    <span className="font-medium">{t.technician}</span>
                    <span className="text-muted-foreground">{t.pendingCount} pending</span>
                  </Link>
                ))}
              </div>
            )}
          </Card>

          <Card className="flex flex-col gap-3 p-5">
            <div className="text-[13px] font-semibold text-muted-foreground">Low stock</div>
            {summary.lowStockItems.length === 0 ? (
              <p className="text-xs text-muted-foreground">Everything is above its reorder point.</p>
            ) : (
              <div className="flex flex-col gap-1.5">
                {summary.lowStockItems.slice(0, 5).map((i) => (
                  <Link
                    key={i.id}
                    href={`/inventory/${i.id}`}
                    className="flex justify-between text-[12.5px] hover:underline"
                  >
                    <span className="font-medium">{i.name}</span>
                    <span className="text-destructive">
                      {i.stockQty} / {i.reorderPoint}
                    </span>
                  </Link>
                ))}
                {summary.lowStockItems.length > 5 && (
                  <Link href="/inventory" className="text-[12px] text-muted-foreground hover:underline">
                    +{summary.lowStockItems.length - 5} more
                  </Link>
                )}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
