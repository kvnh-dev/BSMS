'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { customerSchema, type CustomerInput } from '@bsms/shared';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from '@/components/ui/sheet';
import { FormField } from '@/components/form-field';
import { api, ApiError } from '@/lib/api-client';

interface Customer {
  id: string;
  name: string;
  phone: string;
}

// Tally-parity quick-add: create a customer without losing the surrounding
// form — a slide-over instead of navigating away. Opened externally (Alt+C
// while a customer picker is focused — see quick-create-context.tsx), not by
// a trigger button embedded in this component.
export function QuickAddCustomerSheet({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (customer: Customer) => void;
}) {
  const queryClient = useQueryClient();
  const form = useForm<CustomerInput>({ defaultValues: { name: '', phone: '', address: '' } });

  const createMutation = useMutation({
    mutationFn: (input: CustomerInput) => api.post<Customer>('/customers', input),
    onSuccess: (customer) => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      toast.success('Customer added');
      onCreated(customer);
      onOpenChange(false);
      form.reset();
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Failed to add customer'),
  });

  function onSubmit(values: CustomerInput) {
    const parsed = customerSchema.safeParse(values);
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
          <SheetTitle>New customer</SheetTitle>
        </SheetHeader>
        <form id="quick-add-customer-form" onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-3">
          <FormField label="Name">
            <Input {...form.register('name', { required: true })} />
          </FormField>
          <FormField label="Phone">
            <Input {...form.register('phone', { required: true })} />
          </FormField>
          <FormField label="Address">
            <Input {...form.register('address')} />
          </FormField>
        </form>
        <SheetFooter>
          <Button type="submit" form="quick-add-customer-form" disabled={createMutation.isPending}>
            {createMutation.isPending ? 'Adding…' : 'Add customer'}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
