'use client';

import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { formatPaiseAsInr } from '@bsms/shared';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { api, ApiError } from '@/lib/api-client';

interface ReadyTicket {
  id: string;
  complaint: string;
  actualAmount: number | null;
  bike: { regNo: string; model: string; customer: { name: string; phone: string } };
}

interface DeliveredTicket {
  id: string;
  actualAmount: number | null;
  deliveredAt: string;
  deliveredBy: { name: string } | null;
  bike: { regNo: string; model: string; customer: { name: string; phone: string } };
}

export default function DeliveryPage() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data: tickets, isLoading } = useQuery({
    queryKey: ['service-tickets', 'BILLED'],
    queryFn: () => api.get<ReadyTicket[]>('/service-tickets?status=BILLED'),
  });

  const { data: delivered, isLoading: isDeliveredLoading } = useQuery({
    queryKey: ['service-tickets', 'DELIVERED'],
    queryFn: () => api.get<DeliveredTicket[]>('/service-tickets?status=DELIVERED'),
  });

  const deliverMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/service-tickets/${id}/status`, { status: 'DELIVERED' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['service-tickets'] });
      toast.success('Marked as delivered');
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Failed to update'),
  });

  return (
    <div className="flex flex-col gap-8">
      <div>
      <h1 className="text-2xl font-semibold mb-4">Ready for Delivery</h1>

      {isLoading ? (
        <p className="text-muted-foreground text-sm">Loading…</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Bike</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {tickets?.map((ticket) => (
              <TableRow
                key={ticket.id}
                className="cursor-pointer hover:bg-accent/50"
                onClick={() => router.push(`/service-tickets/${ticket.id}`)}
              >
                <TableCell className="font-medium">{ticket.bike.regNo}</TableCell>
                <TableCell>
                  {ticket.bike.customer.name} ({ticket.bike.customer.phone})
                </TableCell>
                <TableCell className="text-right">
                  {ticket.actualAmount !== null ? formatPaiseAsInr(ticket.actualAmount) : '—'}
                </TableCell>
                <TableCell>
                  <Button
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      deliverMutation.mutate(ticket.id);
                    }}
                    disabled={deliverMutation.isPending}
                  >
                    Mark delivered
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {tickets?.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                  Nothing waiting for delivery.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      )}
      </div>

      <div>
        <h2 className="text-2xl font-semibold mb-4">Recently Delivered</h2>

        {isDeliveredLoading ? (
          <p className="text-muted-foreground text-sm">Loading…</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Bike</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Delivered by</TableHead>
                <TableHead>Delivered at</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {delivered?.map((ticket) => (
                <TableRow
                  key={ticket.id}
                  className="cursor-pointer hover:bg-accent/50"
                  onClick={() => router.push(`/service-tickets/${ticket.id}`)}
                >
                  <TableCell className="font-medium">{ticket.bike.regNo}</TableCell>
                  <TableCell>
                    {ticket.bike.customer.name} ({ticket.bike.customer.phone})
                  </TableCell>
                  <TableCell className="text-right">
                    {ticket.actualAmount !== null ? formatPaiseAsInr(ticket.actualAmount) : '—'}
                  </TableCell>
                  <TableCell>{ticket.deliveredBy?.name ?? '—'}</TableCell>
                  <TableCell>{ticket.deliveredAt ? new Date(ticket.deliveredAt).toLocaleString() : '—'}</TableCell>
                </TableRow>
              ))}
              {delivered?.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                    No deliveries recorded yet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
