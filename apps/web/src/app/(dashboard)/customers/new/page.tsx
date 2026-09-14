'use client';

import { useRouter } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { customerSchema, type CustomerInput } from '@bsms/shared';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FormField } from '@/components/form-field';
import { Breadcrumb } from '@/components/breadcrumb';
import { api, ApiError } from '@/lib/api-client';

interface Customer {
  id: string;
}

export default function NewCustomerPage() {
  const router = useRouter();
  const form = useForm<CustomerInput>({ defaultValues: { name: '', phone: '', address: '' } });

  const createMutation = useMutation({
    mutationFn: (input: CustomerInput) => api.post<Customer>('/customers', input),
    onSuccess: (customer) => {
      toast.success('Customer added');
      router.push(`/customers/${customer.id}`);
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
    <div className="flex flex-col gap-6">
      <Breadcrumb items={[{ label: 'Customers', href: '/customers' }, { label: 'New customer' }]} />
      <Card className="max-w-xl w-full mx-auto">
        <CardHeader>
          <CardTitle>New customer</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-3">
            <FormField label="Name">
              <Input {...form.register('name', { required: true })} autoFocus />
            </FormField>
            <FormField label="Phone">
              <Input {...form.register('phone', { required: true })} />
            </FormField>
            <FormField label="Address">
              <Input {...form.register('address')} />
            </FormField>
            <div className="flex gap-2">
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? 'Adding…' : 'Add customer'}
              </Button>
              <Button type="button" variant="ghost" onClick={() => router.push('/customers')}>
                Cancel
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
