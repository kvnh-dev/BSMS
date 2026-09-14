'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { type Persona } from '@bsms/shared';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { api } from '@/lib/api-client';

interface WorkerUser {
  id: string;
  name: string;
  phone: string;
  isActive: boolean;
  personas: Persona[];
}

export default function WorkersPage() {
  const router = useRouter();

  const { data: users, isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: () => api.get<WorkerUser[]>('/users'),
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-semibold">Workers</h1>
        <Link href="/workers/new">
          <Button>Add worker</Button>
        </Link>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground text-sm">Loading…</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Personas</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users?.map((u) => (
              <TableRow
                key={u.id}
                className="cursor-pointer hover:bg-accent/50"
                onClick={() => router.push(`/workers/${u.id}`)}
              >
                <TableCell className="font-medium">{u.name}</TableCell>
                <TableCell>{u.phone}</TableCell>
                <TableCell className="flex flex-wrap gap-1">
                  {u.personas.map((p) => (
                    <Badge key={p} variant="secondary">
                      {p}
                    </Badge>
                  ))}
                </TableCell>
                <TableCell>
                  <Badge variant={u.isActive ? 'default' : 'secondary'}>
                    {u.isActive ? 'Active' : 'Disabled'}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
