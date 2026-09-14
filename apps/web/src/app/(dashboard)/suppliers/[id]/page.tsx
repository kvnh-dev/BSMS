'use client';

import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { formatPaiseAsInr } from '@bsms/shared';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Breadcrumb } from '@/components/breadcrumb';
import { StatusBadge } from '@/components/status-badge';
import { api } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { usePageUpDownNavigation } from '@/lib/use-record-navigation';

interface PurchaseOrder {
  id: string;
  status: string;
  total: number;
  createdAt: string;
}

interface PurchaseBill {
  id: string;
  billNumber: string | null;
  total: number;
  createdAt: string;
}

interface SupplierDetail {
  id: string;
  name: string;
  phone: string | null;
  gstin: string | null;
  address: string | null;
  purchaseOrders: PurchaseOrder[];
  purchaseBills: PurchaseBill[];
}

export default function SupplierDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { hasPersona } = useAuth();
  const canCreate = hasPersona('OWNER', 'CASHIER');

  const { data: supplier, isLoading } = useQuery({
    queryKey: ['suppliers', id],
    queryFn: () => api.get<SupplierDetail>(`/suppliers/${id}`),
  });

  const { data: supplierList } = useQuery({
    queryKey: ['suppliers'],
    queryFn: () => api.get<{ id: string }[]>('/suppliers'),
  });
  usePageUpDownNavigation(supplierList, id, (s) => `/suppliers/${s.id}`);

  if (isLoading || !supplier) {
    return <p className="text-muted-foreground text-sm">Loading…</p>;
  }

  return (
    <div className="flex flex-col gap-6">
      <Breadcrumb items={[{ label: 'Suppliers', href: '/suppliers' }, { label: supplier.name }]} />
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>{supplier.name}</CardTitle>
          {canCreate && (
            <Button onClick={() => router.push(`/purchase-bills/new?supplierId=${id}`)}>New purchase bill</Button>
          )}
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground flex flex-col gap-1">
          {supplier.phone && <p>{supplier.phone}</p>}
          {supplier.gstin && <p>GSTIN {supplier.gstin}</p>}
          {supplier.address && <p>{supplier.address}</p>}
        </CardContent>
      </Card>

      <div>
        <h2 className="text-lg font-semibold mb-4">Purchase orders</h2>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Status</TableHead>
              <TableHead>Date</TableHead>
              <TableHead className="text-right">Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {supplier.purchaseOrders.map((po) => (
              <TableRow
                key={po.id}
                className="cursor-pointer hover:bg-accent/50"
                onClick={() => router.push(`/purchase-orders/${po.id}`)}
              >
                <TableCell>
                  <Link href={`/purchase-orders/${po.id}`} className="hover:underline" onClick={(e) => e.stopPropagation()}>
                    <StatusBadge status={po.status} />
                  </Link>
                </TableCell>
                <TableCell>{new Date(po.createdAt).toLocaleDateString()}</TableCell>
                <TableCell className="text-right">{formatPaiseAsInr(po.total)}</TableCell>
              </TableRow>
            ))}
            {supplier.purchaseOrders.length === 0 && (
              <TableRow>
                <TableCell colSpan={3} className="text-center text-muted-foreground py-8">
                  No purchase orders yet.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div>
        <h2 className="text-lg font-semibold mb-4">Purchase bills</h2>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Bill #</TableHead>
              <TableHead>Date</TableHead>
              <TableHead className="text-right">Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {supplier.purchaseBills.map((bill) => (
              <TableRow
                key={bill.id}
                className="cursor-pointer hover:bg-accent/50"
                onClick={() => router.push(`/purchase-bills/${bill.id}`)}
              >
                <TableCell className="font-medium">
                  <Link href={`/purchase-bills/${bill.id}`} className="hover:underline" onClick={(e) => e.stopPropagation()}>
                    {bill.billNumber ?? 'Untitled'}
                  </Link>
                </TableCell>
                <TableCell>{new Date(bill.createdAt).toLocaleDateString()}</TableCell>
                <TableCell className="text-right">{formatPaiseAsInr(bill.total)}</TableCell>
              </TableRow>
            ))}
            {supplier.purchaseBills.length === 0 && (
              <TableRow>
                <TableCell colSpan={3} className="text-center text-muted-foreground py-8">
                  No purchase bills yet.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
