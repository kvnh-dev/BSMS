'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { bikeSchema, type BikeInput } from '@bsms/shared';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FormField } from '@/components/form-field';
import { Breadcrumb } from '@/components/breadcrumb';
import { useRegisterQuickCreateTarget } from '@/lib/quick-create-context';
import { useVoucherDrafts } from '@/lib/voucher-drafts-context';
import { api, ApiError } from '@/lib/api-client';

interface Bike {
  id: string;
}

interface Customer {
  id: string;
  name: string;
  phone: string;
}

function isBikeDraftMeaningful(v: BikeInput): boolean {
  return !!v.customerId || (v.regNo ?? '').trim() !== '';
}

export default function NewBikePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const quickCreate = useRegisterQuickCreateTarget();
  const { drafts, getDraft, upsertDraft, removeDraft } = useVoucherDrafts();
  const presetCustomerId = searchParams.get('customerId') ?? '';

  const [draftId] = useState<string>(() => {
    const param = searchParams.get('draft');
    if (param) return param;
    const existing = drafts.find((d) => d.type === 'bike');
    // Only auto-resume an existing bike draft when there's no explicit
    // customerId in the URL, or it already belongs to that same customer —
    // otherwise a link from a DIFFERENT customer's "Add bike" button would
    // confusingly resume an unrelated in-progress bike for someone else.
    if (existing && (!presetCustomerId || (existing.data as BikeInput).customerId === presetCustomerId)) {
      return existing.id;
    }
    return crypto.randomUUID();
  });
  const existingDraft = getDraft(draftId)?.data as BikeInput | undefined;

  const { data: customer } = useQuery({
    queryKey: ['customers', presetCustomerId],
    queryFn: () => api.get<Customer>(`/customers/${presetCustomerId}`),
    enabled: !!presetCustomerId,
  });

  // No customerId in the URL — e.g. arriving via the global F9 shortcut
  // rather than a customer's own "Add bike" button — so offer a picker
  // instead of dead-ending, matching every other standalone "New X" page.
  const { data: customers } = useQuery({
    queryKey: ['customers'],
    queryFn: () => api.get<Customer[]>('/customers'),
    enabled: !presetCustomerId,
  });
  const customerLabels = Object.fromEntries(
    (customers ?? []).map((c): [string, string] => [c.id, `${c.name} (${c.phone})`]),
  );

  const form = useForm<BikeInput>({
    defaultValues: existingDraft ?? { regNo: '', chassisNo: '', model: '', customerId: presetCustomerId },
  });

  // Pushes the form into the voucher-drafts store as a side-channel, so this
  // in-progress bike survives an Alt+G detour and back — see
  // voucher-drafts-context.tsx. Gated on isBikeDraftMeaningful so a stray
  // visit that's immediately abandoned doesn't leave a taskbar chip behind.
  useEffect(() => {
    const subscription = form.watch((values) => {
      const v = values as BikeInput;
      if (!isBikeDraftMeaningful(v)) return;
      upsertDraft(draftId, 'bike', v.regNo ? `Bike — ${v.regNo}` : 'New bike', v);
    });
    return () => subscription.unsubscribe();
  }, [form, draftId, upsertDraft]);

  const createMutation = useMutation({
    mutationFn: (input: BikeInput) => api.post<Bike>('/bikes', input),
    onSuccess: (bike) => {
      toast.success('Bike added');
      removeDraft(draftId);
      router.push(`/bikes/${bike.id}`);
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Failed to add bike'),
  });

  function onSubmit(values: BikeInput) {
    const parsed = bikeSchema.safeParse(values);
    if (!parsed.success) {
      toast.error('Please check the form for errors');
      return;
    }
    createMutation.mutate(parsed.data);
  }

  return (
    <div className="flex flex-col gap-6">
      <Breadcrumb
        items={
          presetCustomerId
            ? [
                { label: 'Customers', href: '/customers' },
                { label: customer?.name ?? '…', href: `/customers/${presetCustomerId}` },
                { label: 'New bike' },
              ]
            : [{ label: 'Customers', href: '/customers' }, { label: 'New bike' }]
        }
      />
      <Card className="max-w-xl w-full mx-auto">
        <CardHeader>
          <CardTitle>New bike {customer && `for ${customer.name}`}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-3">
            {!presetCustomerId && (
              <FormField label="Customer" htmlFor="new-bike-customer-select">
                <Select
                  items={customerLabels}
                  value={form.watch('customerId')}
                  onValueChange={(v: string | null) => form.setValue('customerId', v ?? '')}
                >
                  <SelectTrigger
                    id="new-bike-customer-select"
                    autoFocus
                    onFocus={() =>
                      quickCreate.onFocus({
                        entity: 'customer',
                        onCreated: (c) => form.setValue('customerId', c.id),
                      })
                    }
                    onBlur={quickCreate.onBlur}
                  >
                    <SelectValue placeholder="Select a customer" />
                  </SelectTrigger>
                  <SelectContent>
                    {customers?.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name} ({c.phone})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>
            )}
            <FormField label="Registration number">
              <Input
                {...form.register('regNo', { required: true })}
                placeholder="e.g. KA01AB1234"
                autoFocus={!!presetCustomerId}
              />
            </FormField>
            <FormField label="Chassis number">
              <Input {...form.register('chassisNo', { required: true })} />
            </FormField>
            <FormField label="Model">
              <Input {...form.register('model', { required: true })} placeholder="e.g. Splendor Plus" />
            </FormField>
            <div className="flex gap-2">
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? 'Adding…' : 'Add bike'}
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => router.push(presetCustomerId ? `/customers/${presetCustomerId}` : '/customers')}
              >
                Cancel
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
