'use client';

import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Breadcrumb } from '@/components/breadcrumb';
import { api } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { usePageUpDownNavigation } from '@/lib/use-record-navigation';

interface Bike {
  id: string;
  regNo: string;
  chassisNo: string;
  model: string;
}

interface CustomerDetail {
  id: string;
  name: string;
  phone: string;
  address: string | null;
  bikes: Bike[];
}

export default function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { hasPersona } = useAuth();
  const canCreate = hasPersona('OWNER', 'TECHNICIAN', 'CASHIER');

  const { data: customer, isLoading } = useQuery({
    queryKey: ['customers', id],
    queryFn: () => api.get<CustomerDetail>(`/customers/${id}`),
  });

  const { data: customerList } = useQuery({
    queryKey: ['customers'],
    queryFn: () => api.get<{ id: string }[]>('/customers'),
  });
  usePageUpDownNavigation(customerList, id, (c) => `/customers/${c.id}`);

  if (isLoading || !customer) {
    return <p className="text-muted-foreground text-sm">Loading…</p>;
  }

  return (
    <div className="flex flex-col gap-6">
      <Breadcrumb items={[{ label: 'Customers', href: '/customers' }, { label: customer.name }]} />
      <Card>
        <CardHeader>
          <CardTitle>{customer.name}</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          <p>{customer.phone}</p>
          {customer.address && <p>{customer.address}</p>}
        </CardContent>
      </Card>

      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Bikes</h2>
          {canCreate && (
            <Button onClick={() => router.push(`/bikes/new?customerId=${id}`)}>Add bike</Button>
          )}
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Reg No</TableHead>
              <TableHead>Chassis No</TableHead>
              <TableHead>Model</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {customer.bikes.map((bike) => (
              <TableRow
                key={bike.id}
                className="cursor-pointer hover:bg-accent/50"
                onClick={() => router.push(`/bikes/${bike.id}`)}
              >
                <TableCell className="font-medium">
                  <Link href={`/bikes/${bike.id}`} className="hover:underline" onClick={(e) => e.stopPropagation()}>
                    {bike.regNo}
                  </Link>
                </TableCell>
                <TableCell>{bike.chassisNo}</TableCell>
                <TableCell>{bike.model}</TableCell>
              </TableRow>
            ))}
            {customer.bikes.length === 0 && (
              <TableRow>
                <TableCell colSpan={3} className="text-center text-muted-foreground py-8">
                  No bikes on record yet.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
