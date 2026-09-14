'use client';

import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatusBadge } from '@/components/status-badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Breadcrumb } from '@/components/breadcrumb';
import { api } from '@/lib/api-client';

interface ServiceTicket {
  id: string;
  complaint: string;
  status: string;
  createdAt: string;
}

interface BikeDetail {
  id: string;
  regNo: string;
  chassisNo: string;
  model: string;
  customer: { id: string; name: string; phone: string };
  serviceTickets: ServiceTicket[];
}

export default function BikeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const { data: bike, isLoading } = useQuery({
    queryKey: ['bikes', id],
    queryFn: () => api.get<BikeDetail>(`/bikes/${id}`),
  });

  if (isLoading || !bike) {
    return <p className="text-muted-foreground text-sm">Loading…</p>;
  }

  return (
    <div className="flex flex-col gap-6">
      <Breadcrumb
        items={[
          { label: 'Customers', href: '/customers' },
          { label: bike.customer.name, href: `/customers/${bike.customer.id}` },
          { label: bike.regNo },
        ]}
      />
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>{bike.regNo}</CardTitle>
          <Link href={`/service-tickets/new?bikeId=${bike.id}`}>
            <Button size="sm">New service</Button>
          </Link>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground flex flex-col gap-1">
          <p>{bike.model}</p>
          <p>Chassis: {bike.chassisNo}</p>
          <p>
            Owner:{' '}
            <Link href={`/customers/${bike.customer.id}`} className="hover:underline text-foreground">
              {bike.customer.name}
            </Link>{' '}
            ({bike.customer.phone})
          </p>
        </CardContent>
      </Card>

      <div>
        <h2 className="text-lg font-semibold mb-4">Service history</h2>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Complaint</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {bike.serviceTickets.map((ticket) => (
              <TableRow
                key={ticket.id}
                className="cursor-pointer hover:bg-accent/50"
                onClick={() => router.push(`/service-tickets/${ticket.id}`)}
              >
                <TableCell>{new Date(ticket.createdAt).toLocaleDateString()}</TableCell>
                <TableCell>
                  <Link
                    href={`/service-tickets/${ticket.id}`}
                    className="hover:underline"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {ticket.complaint}
                  </Link>
                </TableCell>
                <TableCell>
                  <StatusBadge status={ticket.status} />
                </TableCell>
              </TableRow>
            ))}
            {bike.serviceTickets.length === 0 && (
              <TableRow>
                <TableCell colSpan={3} className="text-center text-muted-foreground py-8">
                  No service history yet.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
