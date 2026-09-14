'use client';

import { useRouter } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { supplierSchema, type SupplierInput } from '@bsms/shared';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FormField } from '@/components/form-field';
import { Breadcrumb } from '@/components/breadcrumb';
import { api, ApiError } from '@/lib/api-client';

interface Supplier {
  id: string;
}

export default function NewSupplierPage() {
  const router = useRouter();
  const form = useForm<SupplierInput>({ defaultValues: { name: '', phone: '', gstin: '', address: '' } });

  const createMutation = useMutation({
    mutationFn: (input: SupplierInput) => api.post<Supplier>('/suppliers', input),
    onSuccess: (supplier) => {
      toast.success('Supplier added');
      router.push(`/suppliers/${supplier.id}`);
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
    <div className="flex flex-col gap-6">
      <Breadcrumb items={[{ label: 'Suppliers', href: '/suppliers' }, { label: 'New supplier' }]} />
      <Card className="max-w-xl w-full mx-auto">
        <CardHeader>
          <CardTitle>New supplier</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-3">
            <FormField label="Name">
              <Input {...form.register('name', { required: true })} autoFocus />
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
            <div className="flex gap-2">
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? 'Adding…' : 'Add supplier'}
              </Button>
              <Button type="button" variant="ghost" onClick={() => router.push('/suppliers')}>
                Cancel
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
