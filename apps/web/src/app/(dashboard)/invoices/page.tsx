'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { formatPaiseAsInr } from '@bsms/shared';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { StatusBadge } from '@/components/status-badge';
import { Kbd } from '@/components/kbd';
import { api } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';

interface Invoice {
  id: string;
  invoiceNumber: string | null;
  status: string;
  total: number;
  createdAt: string;
  customer: { name: string };
}

export default function InvoicesPage() {
  const router = useRouter();
  const { hasPersona } = useAuth();
  const canBill = hasPersona('OWNER', 'CASHIER');

  const { data: invoices, isLoading } = useQuery({
    queryKey: ['invoices'],
    queryFn: () => api.get<Invoice[]>('/invoices'),
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-semibold">Invoices</h1>
        {canBill && (
          <Link href="/invoices/new">
            <Button>
              New invoice
              <Kbd className="ml-1.5 border-primary-foreground/25 bg-primary-foreground/15 text-primary-foreground shadow-none">
                F8
              </Kbd>
            </Button>
          </Link>
        )}
      </div>

      {isLoading ? (
        <p className="text-muted-foreground text-sm">Loading…</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Invoice #</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Date</TableHead>
              <TableHead className="text-right">Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {invoices?.map((inv) => (
              <TableRow
                key={inv.id}
                className="cursor-pointer hover:bg-accent/50"
                onClick={() => router.push(`/invoices/${inv.id}`)}
              >
                <TableCell className="font-medium">
                  <Link
                    href={`/invoices/${inv.id}`}
                    className="hover:underline"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {inv.invoiceNumber ?? 'Draft'}
                  </Link>
                </TableCell>
                <TableCell>{inv.customer.name}</TableCell>
                <TableCell>
                  <StatusBadge status={inv.status} />
                </TableCell>
                <TableCell>{new Date(inv.createdAt).toLocaleDateString()}</TableCell>
                <TableCell className="text-right">{formatPaiseAsInr(inv.total)}</TableCell>
              </TableRow>
            ))}
            {invoices?.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                  No invoices yet.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
