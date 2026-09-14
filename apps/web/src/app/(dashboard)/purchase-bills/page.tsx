'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { formatPaiseAsInr } from '@bsms/shared';
import { Button } from '@/components/ui/button';
import { Kbd } from '@/components/kbd';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { StatusBadge } from '@/components/status-badge';
import { api } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';

interface PurchaseBill {
  id: string;
  billNumber: string | null;
  total: number;
  paidAmount: number;
  balanceDue: number;
  createdAt: string;
  supplier: { name: string };
}

function paymentStatus(bill: PurchaseBill): 'PAID' | 'PARTIAL' | 'UNPAID' {
  if (bill.balanceDue <= 0) return 'PAID';
  if (bill.paidAmount > 0) return 'PARTIAL';
  return 'UNPAID';
}

export default function PurchaseBillsPage() {
  const router = useRouter();
  const { hasPersona } = useAuth();
  const canCreate = hasPersona('OWNER', 'CASHIER');

  const { data: bills, isLoading } = useQuery({
    queryKey: ['purchase-bills'],
    queryFn: () => api.get<PurchaseBill[]>('/purchase-bills'),
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-semibold">Purchase Bills</h1>
        {canCreate && (
          <Link href="/purchase-bills/new">
            <Button>
              New purchase bill
              <Kbd className="ml-1.5 border-primary-foreground/25 bg-primary-foreground/15 text-primary-foreground shadow-none">
                F10
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
              <TableHead>Bill #</TableHead>
              <TableHead>Supplier</TableHead>
              <TableHead>Date</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead className="text-right">Balance</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {bills?.map((bill) => (
              <TableRow
                key={bill.id}
                className="cursor-pointer hover:bg-accent/50"
                onClick={() => router.push(`/purchase-bills/${bill.id}`)}
              >
                <TableCell className="font-medium">
                  <Link
                    href={`/purchase-bills/${bill.id}`}
                    className="hover:underline"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {bill.billNumber ?? 'Untitled'}
                  </Link>
                </TableCell>
                <TableCell>{bill.supplier.name}</TableCell>
                <TableCell>{new Date(bill.createdAt).toLocaleDateString()}</TableCell>
                <TableCell className="text-right">{formatPaiseAsInr(bill.total)}</TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1.5">
                    <span>{formatPaiseAsInr(bill.balanceDue)}</span>
                    <StatusBadge status={paymentStatus(bill)} />
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {bills?.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                  No purchase bills yet.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
