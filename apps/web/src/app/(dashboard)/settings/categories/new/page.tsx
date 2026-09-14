'use client';

import { useRouter } from 'next/navigation';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { bpsToPercent, type CategoryInput } from '@bsms/shared';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FormField } from '@/components/form-field';
import { Breadcrumb } from '@/components/breadcrumb';
import { useRegisterQuickCreateTarget } from '@/lib/quick-create-context';
import { api, ApiError } from '@/lib/api-client';

interface Category {
  id: string;
}

interface GstSlab {
  id: string;
  label: string;
  rate: number;
  isDefault: boolean;
}

export default function NewCategoryPage() {
  const router = useRouter();
  const quickCreate = useRegisterQuickCreateTarget();
  const { data: gstSlabs } = useQuery({
    queryKey: ['gst-slabs'],
    queryFn: () => api.get<GstSlab[]>('/gst-slabs'),
  });
  const gstSlabLabels = Object.fromEntries(
    (gstSlabs ?? []).map((s): [string, string] => [String(s.rate), `${s.label} (${bpsToPercent(s.rate)}%)`]),
  );

  const form = useForm<CategoryInput>({ defaultValues: { name: '', gstRate: 0 } });

  const createMutation = useMutation({
    mutationFn: (input: CategoryInput) => api.post<Category>('/categories', input),
    onSuccess: () => {
      toast.success('Category added');
      router.push('/settings/categories');
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Failed to add category'),
  });

  return (
    <div className="flex flex-col gap-6">
      <Breadcrumb items={[{ label: 'Categories', href: '/settings/categories' }, { label: 'New category' }]} />
      <Card className="max-w-xl w-full mx-auto">
        <CardHeader>
          <CardTitle>New category</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={form.handleSubmit((values) => createMutation.mutate(values))} className="flex flex-col gap-3">
            <FormField label="Name">
              <Input {...form.register('name', { required: true })} placeholder="e.g. Consumables" autoFocus />
            </FormField>
            <FormField label="Default GST rate" htmlFor="category-gst-select">
              <Select items={gstSlabLabels} onValueChange={(v) => form.setValue('gstRate', Number(v))}>
                <SelectTrigger
                  id="category-gst-select"
                  onFocus={() =>
                    quickCreate.onFocus({ entity: 'gst-slab', onCreated: (slab) => form.setValue('gstRate', slab.rate) })
                  }
                  onBlur={quickCreate.onBlur}
                >
                  <SelectValue placeholder="Select GST rate" />
                </SelectTrigger>
                <SelectContent>
                  {gstSlabs?.map((slab) => (
                    <SelectItem key={slab.id} value={String(slab.rate)}>
                      {slab.label} ({bpsToPercent(slab.rate)}%)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
            <div className="flex gap-2">
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? 'Adding…' : 'Add category'}
              </Button>
              <Button type="button" variant="ghost" onClick={() => router.push('/settings/categories')}>
                Cancel
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
