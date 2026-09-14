'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { api } from '@/lib/api-client';
import { describeChange } from '@/lib/audit-log-format';

interface AuditLogEntry {
  id: string;
  action: string;
  entity: string;
  entityId: string;
  timestamp: string;
  actor: { name: string };
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
}

// Extensible: any future audited entity with its own detail page can be
// added here without touching the render logic below.
const ENTITY_LINKS: Record<string, (id: string) => string> = {
  InventoryItem: (id) => `/inventory/${id}`,
  Invoice: (id) => `/invoices/${id}`,
};

export default function AuditLogPage() {
  const { data: entries, isLoading } = useQuery({
    queryKey: ['audit-log'],
    queryFn: () => api.get<AuditLogEntry[]>('/audit-log'),
  });

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-4">Audit Log</h1>

      {isLoading ? (
        <p className="text-muted-foreground text-sm">Loading…</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>When</TableHead>
              <TableHead>Actor</TableHead>
              <TableHead>Action</TableHead>
              <TableHead>Entity</TableHead>
              <TableHead>What changed</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {entries?.map((entry) => {
              const href = ENTITY_LINKS[entry.entity]?.(entry.entityId);
              return (
                <TableRow key={entry.id}>
                  <TableCell>{new Date(entry.timestamp).toLocaleString()}</TableCell>
                  <TableCell>{entry.actor.name}</TableCell>
                  <TableCell>{entry.action}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {href ? (
                      <Link href={href} className="hover:underline text-foreground">
                        {entry.entity} ({entry.entityId.slice(0, 8)}…)
                      </Link>
                    ) : (
                      <>
                        {entry.entity} ({entry.entityId.slice(0, 8)}…)
                      </>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {describeChange(entry.before, entry.after)}
                  </TableCell>
                </TableRow>
              );
            })}
            {entries?.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                  No audit events recorded yet.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
