'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { formatPaiseAsInr } from '@bsms/shared';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { api } from '@/lib/api-client';

interface TrialBalanceRow {
  accountId: string;
  name: string;
  type: string;
  debit: number;
  credit: number;
}

interface ProfitAndLoss {
  income: { name: string; amount: number }[];
  expenses: { name: string; amount: number }[];
  netProfit: number;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function monthStartIso(): string {
  const now = new Date();
  return new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1)).toISOString().slice(0, 10);
}

export default function LedgerPage() {
  const [mode, setMode] = useState<'trial-balance' | 'profit-and-loss'>('trial-balance');

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Ledger</h1>
        <p className="text-muted-foreground text-sm mt-1">
          A fixed set of accounts that invoices, payments, and purchase bills post to automatically.
        </p>
      </div>

      <div className="flex gap-1 rounded-lg border p-1 max-w-xs">
        <Button
          type="button"
          variant={mode === 'trial-balance' ? 'default' : 'ghost'}
          size="sm"
          className="flex-1"
          onClick={() => setMode('trial-balance')}
        >
          Trial Balance
        </Button>
        <Button
          type="button"
          variant={mode === 'profit-and-loss' ? 'default' : 'ghost'}
          size="sm"
          className="flex-1"
          onClick={() => setMode('profit-and-loss')}
        >
          Profit &amp; Loss
        </Button>
      </div>

      {mode === 'trial-balance' ? <TrialBalancePanel /> : <ProfitAndLossPanel />}
    </div>
  );
}

function TrialBalancePanel() {
  const [asOf, setAsOf] = useState(todayIso());

  const { data: rows, isLoading } = useQuery({
    queryKey: ['ledger', 'trial-balance', asOf],
    queryFn: () => api.get<TrialBalanceRow[]>(`/ledger/trial-balance?asOf=${asOf}`),
  });

  const totalDebit = rows?.reduce((sum, r) => sum + r.debit, 0) ?? 0;
  const totalCredit = rows?.reduce((sum, r) => sum + r.credit, 0) ?? 0;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-end gap-2">
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs">As of</Label>
          <Input type="date" value={asOf} onChange={(e) => setAsOf(e.target.value)} />
        </div>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground text-sm">Loading…</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Account</TableHead>
              <TableHead>Type</TableHead>
              <TableHead className="text-right">Debit</TableHead>
              <TableHead className="text-right">Credit</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows?.map((r) => (
              <TableRow key={r.accountId}>
                <TableCell className="font-medium">{r.name}</TableCell>
                <TableCell className="text-muted-foreground text-xs">{r.type}</TableCell>
                <TableCell className="text-right">{formatPaiseAsInr(r.debit)}</TableCell>
                <TableCell className="text-right">{formatPaiseAsInr(r.credit)}</TableCell>
              </TableRow>
            ))}
            {rows && (
              <TableRow className="font-semibold border-t-2">
                <TableCell colSpan={2}>Total</TableCell>
                <TableCell className="text-right">{formatPaiseAsInr(totalDebit)}</TableCell>
                <TableCell className="text-right">{formatPaiseAsInr(totalCredit)}</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      )}
    </div>
  );
}

function ProfitAndLossPanel() {
  const [from, setFrom] = useState(monthStartIso());
  const [to, setTo] = useState(todayIso());

  const { data, isLoading } = useQuery({
    queryKey: ['ledger', 'profit-and-loss', from, to],
    queryFn: () => api.get<ProfitAndLoss>(`/ledger/profit-and-loss?from=${from}&to=${to}`),
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-end gap-2">
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs">From</Label>
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs">To</Label>
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
      </div>

      {isLoading || !data ? (
        <p className="text-muted-foreground text-sm">Loading…</p>
      ) : (
        <Card className="max-w-xl w-full">
          <CardHeader>
            <CardTitle>Profit &amp; Loss</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4 text-sm">
            <div className="flex flex-col gap-1">
              <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Income</p>
              {data.income.map((i) => (
                <div key={i.name} className="flex justify-between">
                  <span>{i.name}</span>
                  <span>{formatPaiseAsInr(i.amount)}</span>
                </div>
              ))}
            </div>
            <div className="flex flex-col gap-1 border-t pt-3">
              <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Expenses</p>
              {data.expenses.map((e) => (
                <div key={e.name} className="flex justify-between">
                  <span>{e.name}</span>
                  <span>{formatPaiseAsInr(e.amount)}</span>
                </div>
              ))}
            </div>
            <div className="flex justify-between text-base font-bold border-t pt-3">
              <span>Net Profit</span>
              <span className={data.netProfit < 0 ? 'text-destructive' : 'text-success'}>
                {formatPaiseAsInr(data.netProfit)}
              </span>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
