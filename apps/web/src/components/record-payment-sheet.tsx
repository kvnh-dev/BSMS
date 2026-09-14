'use client';

import { useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { PAYMENT_MODES, recordPaymentSchema, rupeesToPaise, type RecordPaymentInput } from '@bsms/shared';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from '@/components/ui/sheet';
import { FormField } from '@/components/form-field';
import { api, ApiError } from '@/lib/api-client';

const MODE_LABELS: Record<string, string> = {
  CASH: 'Cash',
  UPI: 'UPI',
  CARD: 'Card',
  BANK_TRANSFER: 'Bank transfer',
  CHEQUE: 'Cheque',
  OTHER: 'Other',
};

interface FormValues {
  amount: string;
  mode: (typeof PAYMENT_MODES)[number];
  reference: string;
}

export function RecordPaymentSheet({
  open,
  onOpenChange,
  invoiceId,
  balanceDue,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoiceId: string;
  balanceDue: number;
}) {
  const queryClient = useQueryClient();
  const form = useForm<FormValues>({
    defaultValues: { amount: String(balanceDue / 100), mode: 'CASH', reference: '' },
  });

  useEffect(() => {
    if (open) form.reset({ amount: String(balanceDue / 100), mode: 'CASH', reference: '' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, balanceDue]);

  const recordMutation = useMutation({
    mutationFn: (input: RecordPaymentInput) => api.post(`/invoices/${invoiceId}/payments`, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices', invoiceId] });
      queryClient.invalidateQueries({ queryKey: ['invoices', invoiceId, 'payments'] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      toast.success('Payment recorded');
      onOpenChange(false);
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Failed to record payment'),
  });

  function onSubmit(values: FormValues) {
    const input = {
      amount: rupeesToPaise(Number(values.amount)),
      mode: values.mode,
      reference: values.reference || undefined,
    };
    const parsed = recordPaymentSchema.safeParse(input);
    if (!parsed.success) {
      toast.error('Please check the form for errors');
      return;
    }
    recordMutation.mutate(parsed.data);
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Record payment</SheetTitle>
        </SheetHeader>
        <form id="record-payment-form" onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-3">
          <FormField label="Amount (₹)">
            <Input type="number" step="0.01" autoFocus {...form.register('amount', { required: true })} />
          </FormField>
          <FormField label="Mode">
            <Select
              items={MODE_LABELS}
              value={form.watch('mode')}
              onValueChange={(v) => form.setValue('mode', (v as FormValues['mode']) ?? 'CASH')}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAYMENT_MODES.map((mode) => (
                  <SelectItem key={mode} value={mode}>
                    {MODE_LABELS[mode]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
          <FormField label="Reference (optional)">
            <Input placeholder="UPI txn ID, cheque no…" {...form.register('reference')} />
          </FormField>
        </form>
        <SheetFooter>
          <Button type="submit" form="record-payment-form" disabled={recordMutation.isPending}>
            {recordMutation.isPending ? 'Recording…' : 'Record payment'}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
