'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { supplierSchema, type SupplierInput } from '@bsms/shared';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from '@/components/ui/sheet';
import { FormField } from '@/components/form-field';
import { api, ApiError } from '@/lib/api-client';

interface Supplier {
  id: string;
  name: string;
  phone: string | null;
}

// Tally-parity quick-add, same shape as quick-add-customer-sheet.tsx —
// opened externally via Alt+C while a supplier picker is focused.
export function QuickAddSupplierSheet({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (supplier: Supplier) => void;
}) {
  const queryClient = useQueryClient();
  const form = useForm<SupplierInput>({ defaultValues: { name: '', phone: '', gstin: '', address: '' } });

  const createMutation = useMutation({
    mutationFn: (input: SupplierInput) => api.post<Supplier>('/suppliers', input),
    onSuccess: (supplier) => {
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      toast.success('Supplier added');
      onCreated(supplier);
      onOpenChange(false);
      form.reset();
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Failed to add supplier'),
  });

  function onSubmit(values: SupplierInput) {
    const parsed = supplierSchema.safeParse(values);
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
          <SheetTitle>New supplier</SheetTitle>
        </SheetHeader>
        <form id="quick-add-supplier-form" onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-3">
          <FormField label="Name">
            <Input {...form.register('name', { required: true })} />
          </FormField>
          <FormField label="Phone">
            <Input {...form.register('phone')} />
          </FormField>
          <FormField label="GSTIN">
            <Input {...form.register('gstin')} placeholder="e.g. 29ABCDE1234F1Z5" />
          </FormField>
          <FormField label="Address">
            <Input {...form.register('address')} />
          </FormField>
        </form>
        <SheetFooter>
          <Button type="submit" form="quick-add-supplier-form" disabled={createMutation.isPending}>
            {createMutation.isPending ? 'Adding…' : 'Add supplier'}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
