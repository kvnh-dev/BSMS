'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { expenseSchema, rupeesToPaise, formatPaiseAsInr, type ExpenseInput } from '@bsms/shared';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { FormField } from '@/components/form-field';
import { Breadcrumb } from '@/components/breadcrumb';
import { api, ApiError } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';

interface Account {
  id: string;
  name: string;
  type: string;
}

interface ExpenseEntry {
  id: string;
  date: string;
  debit: number;
  narration: string | null;
  account: { name: string };
}

interface FormValues {
  accountId: string;
  amount: string;
  narration: string;
}

export default function ExpensesPage() {
  const { hasPersona } = useAuth();
  const isOwner = hasPersona('OWNER');
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);

  const { data: accounts } = useQuery({
    queryKey: ['ledger', 'accounts'],
    queryFn: () => api.get<Account[]>('/ledger/accounts'),
  });
  const indirectExpenses = accounts?.find((a) => a.name === 'Indirect Expenses');
  const accountLabels = Object.fromEntries((accounts ?? []).map((a): [string, string] => [a.id, a.name]));

  const { data: expenses, isLoading } = useQuery({
    queryKey: ['expenses'],
    queryFn: () => api.get<ExpenseEntry[]>('/expenses'),
  });

  const form = useForm<FormValues>({ defaultValues: { accountId: '', amount: '', narration: '' } });

  useEffect(() => {
    if (indirectExpenses) form.setValue('accountId', indirectExpenses.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [indirectExpenses]);

  const createMutation = useMutation({
    mutationFn: (input: ExpenseInput) => api.post('/expenses', input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      queryClient.invalidateQueries({ queryKey: ['ledger'] });
      toast.success('Expense recorded');
      setDialogOpen(false);
      form.reset({ accountId: indirectExpenses?.id ?? '', amount: '', narration: '' });
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Failed to record expense'),
  });

  function onSubmit(values: FormValues) {
    const input = { accountId: values.accountId, amount: rupeesToPaise(Number(values.amount)), narration: values.narration };
    const parsed = expenseSchema.safeParse(input);
    if (!parsed.success) {
      toast.error('Please check the form for errors');
      return;
    }
    createMutation.mutate(parsed.data);
  }

  return (
    <div className="flex flex-col gap-6">
      <Breadcrumb items={[{ label: 'Ledger', href: '/ledger' }, { label: 'Expenses' }]} />

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Expenses</h1>
        {isOwner && (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger render={<Button>Record expense</Button>} />
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Record expense</DialogTitle>
              </DialogHeader>
              <form id="expense-form" onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-3">
                <FormField label="Account">
                  <Select
                    items={accountLabels}
                    value={form.watch('accountId')}
                    onValueChange={(v) => form.setValue('accountId', v ?? '')}
                  >
                    <SelectTrigger autoFocus>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {accounts
                        ?.filter((a) => a.type === 'EXPENSE')
                        .map((a) => (
                          <SelectItem key={a.id} value={a.id}>
                            {a.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </FormField>
                <FormField label="Amount (₹)">
                  <Input type="number" step="0.01" {...form.register('amount', { required: true })} />
                </FormField>
                <FormField label="Narration">
                  <Input placeholder="e.g. Office rent, electricity bill" {...form.register('narration', { required: true })} />
                </FormField>
              </form>
              <DialogFooter>
                <Button type="submit" form="expense-form" disabled={createMutation.isPending}>
                  {createMutation.isPending ? 'Recording…' : 'Record expense'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {isLoading ? (
        <p className="text-muted-foreground text-sm">Loading…</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Account</TableHead>
              <TableHead>Narration</TableHead>
              <TableHead className="text-right">Amount</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {expenses?.map((e) => (
              <TableRow key={e.id}>
                <TableCell>{new Date(e.date).toLocaleDateString()}</TableCell>
                <TableCell>{e.account.name}</TableCell>
                <TableCell>{e.narration ?? '—'}</TableCell>
                <TableCell className="text-right">{formatPaiseAsInr(e.debit)}</TableCell>
              </TableRow>
            ))}
            {expenses?.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                  No expenses recorded yet.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
