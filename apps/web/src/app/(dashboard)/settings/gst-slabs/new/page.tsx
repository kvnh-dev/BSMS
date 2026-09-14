'use client';

import { useRouter } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { percentToBps, type GstSlabInput } from '@bsms/shared';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FormField } from '@/components/form-field';
import { Breadcrumb } from '@/components/breadcrumb';
import { api, ApiError } from '@/lib/api-client';

interface GstSlab {
  id: string;
}

export default function NewGstSlabPage() {
  const router = useRouter();

  const form = useForm<{ label: string; ratePercent: number; isDefault: boolean }>({
    defaultValues: { label: '', ratePercent: 0, isDefault: false },
  });

  const createMutation = useMutation({
    mutationFn: (input: GstSlabInput) => api.post<GstSlab>('/gst-slabs', input),
    onSuccess: () => {
      toast.success('GST slab added');
      router.push('/settings/gst-slabs');
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Failed to add GST slab'),
  });

  function onSubmit(values: { label: string; ratePercent: number; isDefault: boolean }) {
    createMutation.mutate({
      label: values.label,
      rate: percentToBps(values.ratePercent),
      isDefault: values.isDefault,
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <Breadcrumb items={[{ label: 'GST Slabs', href: '/settings/gst-slabs' }, { label: 'New slab' }]} />
      <Card className="max-w-xl w-full mx-auto">
        <CardHeader>
          <CardTitle>New GST slab</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-3">
            <FormField label="Label">
              <Input {...form.register('label', { required: true })} placeholder="e.g. Accessories" autoFocus />
            </FormField>
            <FormField label="Rate (%)">
              <Input type="number" step="0.01" {...form.register('ratePercent', { valueAsNumber: true, required: true })} />
            </FormField>
            <label className="flex items-center gap-1.5 text-sm">
              <Checkbox onCheckedChange={(checked) => form.setValue('isDefault', checked === true)} />
              Set as default
            </label>
            <div className="flex gap-2">
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? 'Adding…' : 'Add slab'}
              </Button>
              <Button type="button" variant="ghost" onClick={() => router.push('/settings/gst-slabs')}>
                Cancel
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
