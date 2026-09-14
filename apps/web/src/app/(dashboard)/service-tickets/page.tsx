'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/status-badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Kbd } from '@/components/kbd';
import { api } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { TICKET_STATUSES } from '@bsms/shared';

interface ServiceTicket {
  id: string;
  complaint: string;
  status: string;
  createdAt: string;
  bike: { regNo: string; model: string; customer: { name: string } };
  technician: { name: string } | null;
}

export default function ServiceTicketsPage() {
  const { hasPersona } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const technicianIdFilter = searchParams.get('technicianId');
  const canCreateTicket = hasPersona('OWNER', 'TECHNICIAN');
  const [statusFilter, setStatusFilter] = useState<string | undefined>(
    () => searchParams.get('status') ?? undefined,
  );

  const { data: tickets, isLoading } = useQuery({
    queryKey: ['service-tickets', statusFilter, technicianIdFilter],
    queryFn: () => {
      const params = new URLSearchParams();
      if (statusFilter) params.set('status', statusFilter);
      if (technicianIdFilter) params.set('technicianId', technicianIdFilter);
      const qs = params.toString();
      return api.get<ServiceTicket[]>(`/service-tickets${qs ? `?${qs}` : ''}`);
    },
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-semibold">Services</h1>
        <div className="flex items-center gap-2">
          <Select
            value={statusFilter ?? 'ALL'}
            onValueChange={(v) => setStatusFilter(!v || v === 'ALL' ? undefined : v)}
            items={{ ALL: 'All statuses', ...Object.fromEntries(TICKET_STATUSES.map((s) => [s, s])) }}
          >
            <SelectTrigger className="w-fit">
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All statuses</SelectItem>
              {TICKET_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {canCreateTicket && (
            <Link href="/service-tickets/new">
              <Button>
                New ticket
                <Kbd className="ml-1.5 border-primary-foreground/25 bg-primary-foreground/15 text-primary-foreground shadow-none">
                  F4
                </Kbd>
              </Button>
            </Link>
          )}
        </div>
      </div>

      {technicianIdFilter && (
        <p className="text-sm text-muted-foreground mb-3">
          Filtered by technician —{' '}
          <button type="button" className="underline hover:text-foreground" onClick={() => router.push('/service-tickets')}>
            clear filter
          </button>
        </p>
      )}

      {isLoading ? (
        <p className="text-muted-foreground text-sm">Loading…</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Bike</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Complaint</TableHead>
              <TableHead>Technician</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Created</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tickets?.map((ticket) => (
              <TableRow
                key={ticket.id}
                className="cursor-pointer hover:bg-accent/50"
                onClick={() => router.push(`/service-tickets/${ticket.id}`)}
              >
                <TableCell className="font-medium">
                  <Link
                    href={`/service-tickets/${ticket.id}`}
                    className="hover:underline"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {ticket.bike.regNo}
                  </Link>
                </TableCell>
                <TableCell>{ticket.bike.customer.name}</TableCell>
                <TableCell>{ticket.complaint}</TableCell>
                <TableCell>{ticket.technician?.name ?? '—'}</TableCell>
                <TableCell>
                  <StatusBadge status={ticket.status} />
                </TableCell>
                <TableCell>{new Date(ticket.createdAt).toLocaleDateString()}</TableCell>
              </TableRow>
            ))}
            {tickets?.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                  No services yet.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
