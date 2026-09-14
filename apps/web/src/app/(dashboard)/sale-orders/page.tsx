'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { formatPaiseAsInr } from '@bsms/shared';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { StatusBadge } from '@/components/status-badge';
import { api } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';

interface SaleOrder {
  id: string;
  status: string;
  total: number;
  createdAt: string;
  customer: { name: string };
}

export default function SaleOrdersPage() {
  const router = useRouter();
  const { hasPersona } = useAuth();
  const canCreate = hasPersona('OWNER', 'CASHIER');

  const { data: orders, isLoading } = useQuery({
    queryKey: ['sale-orders'],
    queryFn: () => api.get<SaleOrder[]>('/sale-orders'),
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-semibold">Sale Orders</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Pre-invoice commitments — items and price are locked in, but stock and GST invoice numbering only
            apply once converted to an invoice.
          </p>
        </div>
        {canCreate && (
          <Link href="/sale-orders/new">
            <Button>New sale order</Button>
          </Link>
        )}
      </div>

      {isLoading ? (
        <p className="text-muted-foreground text-sm">Loading…</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Customer</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Date</TableHead>
              <TableHead className="text-right">Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {orders?.map((order) => (
              <TableRow
                key={order.id}
                className="cursor-pointer hover:bg-accent/50"
                onClick={() => router.push(`/sale-orders/${order.id}`)}
              >
                <TableCell className="font-medium">
                  <Link
                    href={`/sale-orders/${order.id}`}
                    className="hover:underline"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {order.customer.name}
                  </Link>
                </TableCell>
                <TableCell>
                  <StatusBadge status={order.status} />
                </TableCell>
                <TableCell>{new Date(order.createdAt).toLocaleDateString()}</TableCell>
                <TableCell className="text-right">{formatPaiseAsInr(order.total)}</TableCell>
              </TableRow>
            ))}
            {orders?.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                  No sale orders yet.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
