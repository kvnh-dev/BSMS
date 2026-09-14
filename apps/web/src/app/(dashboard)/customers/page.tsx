'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Kbd } from '@/components/kbd';
import { api } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';

interface Customer {
  id: string;
  name: string;
  phone: string;
  address: string | null;
}

export default function CustomersPage() {
  const router = useRouter();
  const { hasPersona } = useAuth();
  const canCreate = hasPersona('OWNER', 'TECHNICIAN', 'CASHIER');

  const { data: customers, isLoading } = useQuery({
    queryKey: ['customers'],
    queryFn: () => api.get<Customer[]>('/customers'),
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-semibold">Customers</h1>
        {canCreate && (
          <Link href="/customers/new">
            <Button>
              Add customer
              <Kbd className="ml-1.5 border-primary-foreground/25 bg-primary-foreground/15 text-primary-foreground shadow-none">
                F6
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
              <TableHead>Name</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Address</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {customers?.map((c) => (
              <TableRow
                key={c.id}
                className="cursor-pointer hover:bg-accent/50"
                onClick={() => router.push(`/customers/${c.id}`)}
              >
                <TableCell className="font-medium">
                  <Link href={`/customers/${c.id}`} className="hover:underline" onClick={(e) => e.stopPropagation()}>
                    {c.name}
                  </Link>
                </TableCell>
                <TableCell>{c.phone}</TableCell>
                <TableCell>{c.address ?? '—'}</TableCell>
              </TableRow>
            ))}
            {customers?.length === 0 && (
              <TableRow>
                <TableCell colSpan={3} className="text-center text-muted-foreground py-8">
                  No customers yet.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
