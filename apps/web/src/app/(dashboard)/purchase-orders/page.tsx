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

interface PurchaseOrder {
  id: string;
  status: string;
  total: number;
  createdAt: string;
  supplier: { name: string };
}

export default function PurchaseOrdersPage() {
  const router = useRouter();
  const { hasPersona } = useAuth();
  const canCreate = hasPersona('OWNER', 'CASHIER');

  const { data: orders, isLoading } = useQuery({
    queryKey: ['purchase-orders'],
    queryFn: () => api.get<PurchaseOrder[]>('/purchase-orders'),
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-semibold">Purchase Orders</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Pre-bill supplier commitments — items and price are locked in, but stock only moves once converted
            to a purchase bill.
          </p>
        </div>
        {canCreate && (
          <Link href="/purchase-orders/new">
            <Button>New purchase order</Button>
          </Link>
        )}
      </div>

      {isLoading ? (
        <p className="text-muted-foreground text-sm">Loading…</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Supplier</TableHead>
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
                onClick={() => router.push(`/purchase-orders/${order.id}`)}
              >
                <TableCell className="font-medium">
                  <Link
                    href={`/purchase-orders/${order.id}`}
                    className="hover:underline"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {order.supplier.name}
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
                  No purchase orders yet.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
