'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { api, ApiError } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';

interface AttendanceRecord {
  id: string;
  date: string;
  checkIn: string;
  checkOut: string | null;
}

interface AllStaffRecord extends AttendanceRecord {
  user: { id: string; name: string };
}

function currentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function hoursBetween(checkIn: string, checkOut: string | null): number {
  if (!checkOut) return 0;
  return (new Date(checkOut).getTime() - new Date(checkIn).getTime()) / (1000 * 60 * 60);
}

export default function AttendancePage() {
  const { hasPersona } = useAuth();
  const isOwner = hasPersona('OWNER');
  const queryClient = useQueryClient();
  const [month, setMonth] = useState(currentMonth());
  const [expandedWorker, setExpandedWorker] = useState<{ id: string; name: string } | null>(null);

  const { data: history, isLoading } = useQuery({
    queryKey: ['attendance', 'me'],
    queryFn: () => api.get<AttendanceRecord[]>('/attendance/me'),
  });

  const { data: allStaff, isLoading: allStaffLoading } = useQuery({
    queryKey: ['attendance', 'all', month],
    queryFn: () => api.get<AllStaffRecord[]>(`/attendance?month=${month}`),
    enabled: isOwner,
  });

  // Per-worker monthly summary, computed client-side from the raw records
  // the backend already scopes to the selected month.
  const workerSummaries = useMemo(() => {
    if (!allStaff) return [];
    const byWorker = new Map<string, { id: string; name: string; days: Set<string>; hours: number }>();
    for (const record of allStaff) {
      const entry = byWorker.get(record.user.id) ?? {
        id: record.user.id,
        name: record.user.name,
        days: new Set<string>(),
        hours: 0,
      };
      entry.days.add(record.date.slice(0, 10));
      entry.hours += hoursBetween(record.checkIn, record.checkOut);
      byWorker.set(record.user.id, entry);
    }
    return Array.from(byWorker.values())
      .map((w) => ({ id: w.id, name: w.name, daysPresent: w.days.size, totalHours: w.hours }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [allStaff]);

  const expandedRecords = expandedWorker
    ? (allStaff ?? []).filter((r) => r.user.id === expandedWorker.id).sort((a, b) => a.date.localeCompare(b.date))
    : [];

  const today = history?.[0];
  const isCheckedIn = today && !today.checkOut && isToday(today.date);

  const checkInMutation = useMutation({
    mutationFn: () => api.post('/attendance/check-in'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attendance'] });
      toast.success('Checked in');
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Check-in failed'),
  });

  const checkOutMutation = useMutation({
    mutationFn: () => api.post('/attendance/check-out'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attendance'] });
      toast.success('Checked out');
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Check-out failed'),
  });

  return (
    <div className="flex flex-col gap-8">
      <div>
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-semibold">Attendance</h1>
          {isCheckedIn ? (
            <Button variant="outline" onClick={() => checkOutMutation.mutate()} disabled={checkOutMutation.isPending}>
              Check out
            </Button>
          ) : (
            <Button onClick={() => checkInMutation.mutate()} disabled={checkInMutation.isPending}>
              Check in
            </Button>
          )}
        </div>

        {isLoading ? (
          <p className="text-muted-foreground text-sm">Loading…</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Check in</TableHead>
                <TableHead>Check out</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {history?.map((record) => (
                <TableRow key={record.id}>
                  <TableCell>{new Date(record.date).toLocaleDateString()}</TableCell>
                  <TableCell>{new Date(record.checkIn).toLocaleTimeString()}</TableCell>
                  <TableCell>{record.checkOut ? new Date(record.checkOut).toLocaleTimeString() : '—'}</TableCell>
                </TableRow>
              ))}
              {history?.length === 0 && (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-muted-foreground py-8">
                    No attendance records yet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </div>

      {isOwner && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold">All staff</h2>
              <p className="text-sm text-muted-foreground mt-0.5">
                Monthly summary — click a worker to see their individual check-in/out times.
              </p>
            </div>
            <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="w-40" />
          </div>

          {allStaffLoading ? (
            <p className="text-muted-foreground text-sm">Loading…</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Worker</TableHead>
                  <TableHead className="text-right">Days present</TableHead>
                  <TableHead className="text-right">Total hours</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {workerSummaries.map((w) => (
                  <TableRow
                    key={w.id}
                    className="cursor-pointer hover:bg-accent/50"
                    onClick={() => setExpandedWorker({ id: w.id, name: w.name })}
                  >
                    <TableCell className="font-medium">{w.name}</TableCell>
                    <TableCell className="text-right">{w.daysPresent}</TableCell>
                    <TableCell className="text-right">{w.totalHours.toFixed(1)}</TableCell>
                  </TableRow>
                ))}
                {workerSummaries.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-muted-foreground py-8">
                      No attendance recorded for this month.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </div>
      )}

      <Dialog open={!!expandedWorker} onOpenChange={(open) => !open && setExpandedWorker(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{expandedWorker?.name} — {month}</DialogTitle>
          </DialogHeader>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Check in</TableHead>
                <TableHead>Check out</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {expandedRecords.map((record) => (
                <TableRow key={record.id}>
                  <TableCell>{new Date(record.date).toLocaleDateString()}</TableCell>
                  <TableCell>{new Date(record.checkIn).toLocaleTimeString()}</TableCell>
                  <TableCell>{record.checkOut ? new Date(record.checkOut).toLocaleTimeString() : '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function isToday(dateStr: string): boolean {
  const d = new Date(dateStr);
  const now = new Date();
  return (
    d.getUTCFullYear() === now.getUTCFullYear() &&
    d.getUTCMonth() === now.getUTCMonth() &&
    d.getUTCDate() === now.getUTCDate()
  );
}
