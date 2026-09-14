'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { formatPaiseAsInr } from '@bsms/shared';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Breadcrumb } from '@/components/breadcrumb';
import { api } from '@/lib/api-client';

interface Receivable {
  id: string;
  invoiceNumber: string | null;
  customer: { name: string; phone: string };
  createdAt: string;
  total: number;
  paidAmount: number;
  balanceDue: number;
}

export default function ReceivablesPage() {
  const { data: rows, isLoading } = useQuery({
    queryKey: ['reports', 'receivables'],
    queryFn: () => api.get<Receivable[]>('/reports/receivables'),
  });

  const totalOutstanding = rows?.reduce((sum, r) => sum + r.balanceDue, 0) ?? 0;

  return (
    <div className="flex flex-col gap-4">
      <Breadcrumb items={[{ label: 'Reports', href: '/reports' }, { label: 'Receivables' }]} />

      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Receivables</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Finalized invoices with an outstanding balance, oldest first.
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs text-muted-foreground">Total outstanding</p>
          <p className="text-xl font-bold text-destructive">{formatPaiseAsInr(totalOutstanding)}</p>
        </div>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground text-sm">Loading…</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Invoice #</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Date</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead className="text-right">Paid</TableHead>
              <TableHead className="text-right">Balance due</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows?.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-medium">
                  <Link href={`/invoices/${r.id}`} className="hover:underline">
                    {r.invoiceNumber}
                  </Link>
                </TableCell>
                <TableCell>
                  {r.customer.name}
                  <span className="text-muted-foreground"> · {r.customer.phone}</span>
                </TableCell>
                <TableCell>{new Date(r.createdAt).toLocaleDateString()}</TableCell>
                <TableCell className="text-right">{formatPaiseAsInr(r.total)}</TableCell>
                <TableCell className="text-right">{formatPaiseAsInr(r.paidAmount)}</TableCell>
                <TableCell className="text-right font-semibold text-destructive">
                  {formatPaiseAsInr(r.balanceDue)}
                </TableCell>
              </TableRow>
            ))}
            {rows?.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                  Nothing outstanding — every finalized invoice is paid in full.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
