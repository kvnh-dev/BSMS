'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { bikeSchema, type BikeInput } from '@bsms/shared';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from '@/components/ui/sheet';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FormField } from '@/components/form-field';
import { api, ApiError } from '@/lib/api-client';

interface Bike {
  id: string;
  regNo: string;
  chassisNo: string;
  model: string;
  customerId: string;
}

interface Customer {
  id: string;
  name: string;
  phone: string;
}

// Opened via Alt+C from the bike search box on the New Service page — that
// field is a plain Input (not a Select), so it registers as a quick-create
// target directly on focus/blur rather than through a SelectTrigger.
export function QuickAddBikeSheet({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (bike: Bike) => void;
}) {
  const queryClient = useQueryClient();
  const { data: customers } = useQuery({
    queryKey: ['customers'],
    queryFn: () => api.get<Customer[]>('/customers'),
    enabled: open,
  });
  const customerLabels = Object.fromEntries((customers ?? []).map((c): [string, string] => [c.id, `${c.name} (${c.phone})`]));

  const form = useForm<BikeInput>({ defaultValues: { regNo: '', chassisNo: '', model: '', customerId: '' } });

  const createMutation = useMutation({
    mutationFn: (input: BikeInput) => api.post<Bike>('/bikes', input),
    onSuccess: (bike) => {
      queryClient.invalidateQueries({ queryKey: ['bikes'] });
      toast.success('Bike added');
      onCreated(bike);
      onOpenChange(false);
      form.reset();
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
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>New bike</SheetTitle>
        </SheetHeader>
        <form id="quick-add-bike-form" onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-3">
          <FormField label="Customer" htmlFor="quick-bike-customer-select">
            <Select items={customerLabels} onValueChange={(v: string | null) => form.setValue('customerId', v ?? '')}>
              <SelectTrigger id="quick-bike-customer-select">
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
          <FormField label="Registration number">
            <Input {...form.register('regNo', { required: true })} placeholder="e.g. KA01AB1234" />
          </FormField>
          <FormField label="Chassis number">
            <Input {...form.register('chassisNo', { required: true })} />
          </FormField>
          <FormField label="Model">
            <Input {...form.register('model', { required: true })} placeholder="e.g. Splendor Plus" />
          </FormField>
        </form>
        <SheetFooter>
          <Button type="submit" form="quick-add-bike-form" disabled={createMutation.isPending}>
            {createMutation.isPending ? 'Adding…' : 'Add bike'}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
