'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { formatPaiseAsInr, bpsToPercent } from '@bsms/shared';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { api } from '@/lib/api-client';

interface GstExportRow {
  hsnCode: string;
  gstRate: number;
  taxableValuePaise: number;
  cgstPaise: number;
  sgstPaise: number;
}

function toCsv(rows: GstExportRow[]): string {
  const header = 'HSN Code,GST Rate %,Taxable Value,CGST,SGST,Total GST\n';
  const body = rows
    .map((r) =>
      [
        r.hsnCode,
        bpsToPercent(r.gstRate),
        (r.taxableValuePaise / 100).toFixed(2),
        (r.cgstPaise / 100).toFixed(2),
        (r.sgstPaise / 100).toFixed(2),
        ((r.cgstPaise + r.sgstPaise) / 100).toFixed(2),
      ].join(','),
    )
    .join('\n');
  return header + body;
}

function monthStartIso(): string {
  const now = new Date();
  return new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1)).toISOString().slice(0, 10);
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function ReportsPage() {
  const [from, setFrom] = useState(monthStartIso());
  const [to, setTo] = useState(todayIso());

  const { data: rows, isLoading } = useQuery({
    queryKey: ['reports', 'gst-export', from, to],
    queryFn: () => api.get<GstExportRow[]>(`/reports/gst-export?from=${from}&to=${to}`),
  });

  function downloadCsv() {
    if (!rows) return;
    const blob = new Blob([toCsv(rows)], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `gst-export-${from}-to-${to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const totals = rows?.reduce(
    (acc, r) => ({
      taxable: acc.taxable + r.taxableValuePaise,
      cgst: acc.cgst + r.cgstPaise,
      sgst: acc.sgst + r.sgstPaise,
    }),
    { taxable: 0, cgst: 0, sgst: 0 },
  );

  return (
    <div>
      <div className="flex items-end justify-between mb-4 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold">GST Export</h1>
          <p className="text-muted-foreground text-sm mt-1">HSN-wise summary, GSTR-1 style.</p>
        </div>
        <div className="flex items-end gap-2">
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs">From</Label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs">To</Label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <Button variant="outline" onClick={downloadCsv} disabled={!rows?.length}>
            Download CSV
          </Button>
        </div>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground text-sm">Loading…</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>HSN Code</TableHead>
              <TableHead>GST Rate</TableHead>
              <TableHead className="text-right">Taxable Value</TableHead>
              <TableHead className="text-right">CGST</TableHead>
              <TableHead className="text-right">SGST</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows?.map((r, i) => (
              <TableRow key={i}>
                <TableCell>{r.hsnCode}</TableCell>
                <TableCell>{bpsToPercent(r.gstRate)}%</TableCell>
                <TableCell className="text-right">{formatPaiseAsInr(r.taxableValuePaise)}</TableCell>
                <TableCell className="text-right">{formatPaiseAsInr(r.cgstPaise)}</TableCell>
                <TableCell className="text-right">{formatPaiseAsInr(r.sgstPaise)}</TableCell>
              </TableRow>
            ))}
            {rows?.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                  No sales in this date range.
                </TableCell>
              </TableRow>
            )}
            {totals && rows && rows.length > 0 && (
              <TableRow className="font-medium">
                <TableCell colSpan={2}>Total</TableCell>
                <TableCell className="text-right">{formatPaiseAsInr(totals.taxable)}</TableCell>
                <TableCell className="text-right">{formatPaiseAsInr(totals.cgst)}</TableCell>
                <TableCell className="text-right">{formatPaiseAsInr(totals.sgst)}</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
