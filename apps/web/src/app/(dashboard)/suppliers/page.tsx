'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { api } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';

interface Supplier {
  id: string;
  name: string;
  phone: string | null;
  gstin: string | null;
  address: string | null;
}

export default function SuppliersPage() {
  const router = useRouter();
  const { hasPersona } = useAuth();
  const canCreate = hasPersona('OWNER', 'CASHIER');

  const { data: suppliers, isLoading } = useQuery({
    queryKey: ['suppliers'],
    queryFn: () => api.get<Supplier[]>('/suppliers'),
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-semibold">Suppliers</h1>
        {canCreate && (
          <Link href="/suppliers/new">
            <Button>Add supplier</Button>
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
              <TableHead>GSTIN</TableHead>
              <TableHead>Address</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {suppliers?.map((s) => (
              <TableRow
                key={s.id}
                className="cursor-pointer hover:bg-accent/50"
                onClick={() => router.push(`/suppliers/${s.id}`)}
              >
                <TableCell className="font-medium">
                  <Link href={`/suppliers/${s.id}`} className="hover:underline" onClick={(e) => e.stopPropagation()}>
                    {s.name}
                  </Link>
                </TableCell>
                <TableCell>{s.phone ?? '—'}</TableCell>
                <TableCell>{s.gstin ?? '—'}</TableCell>
                <TableCell>{s.address ?? '—'}</TableCell>
              </TableRow>
            ))}
            {suppliers?.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                  No suppliers yet.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
