'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { bpsToPercent, categorySchema, type CategoryInput } from '@bsms/shared';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from '@/components/ui/sheet';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FormField } from '@/components/form-field';
import { api, ApiError } from '@/lib/api-client';

interface Category {
  id: string;
  name: string;
  gstRate: number;
}

interface GstSlab {
  id: string;
  label: string;
  rate: number;
  isDefault: boolean;
}

export function QuickAddCategorySheet({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (category: Category) => void;
}) {
  const queryClient = useQueryClient();
  const { data: gstSlabs } = useQuery({
    queryKey: ['gst-slabs'],
    queryFn: () => api.get<GstSlab[]>('/gst-slabs'),
    enabled: open,
  });
  const gstSlabLabels = Object.fromEntries(
    (gstSlabs ?? []).map((s): [string, string] => [String(s.rate), `${s.label} (${bpsToPercent(s.rate)}%)`]),
  );

  const form = useForm<CategoryInput>({ defaultValues: { name: '', gstRate: 0 } });

  const createMutation = useMutation({
    mutationFn: (input: CategoryInput) => api.post<Category>('/categories', input),
    onSuccess: (category) => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      toast.success('Category added');
      onCreated(category);
      onOpenChange(false);
      form.reset();
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Failed to add category'),
  });

  function onSubmit(values: CategoryInput) {
    const parsed = categorySchema.safeParse(values);
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
          <SheetTitle>New category</SheetTitle>
        </SheetHeader>
        <form id="quick-add-category-form" onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-3">
          <FormField label="Name">
            <Input {...form.register('name', { required: true })} placeholder="e.g. Consumables" />
          </FormField>
          <FormField label="Default GST rate" htmlFor="quick-category-gst-select">
            <Select items={gstSlabLabels} onValueChange={(v) => form.setValue('gstRate', Number(v))}>
              <SelectTrigger id="quick-category-gst-select">
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
        </form>
        <SheetFooter>
          <Button type="submit" form="quick-add-category-form" disabled={createMutation.isPending}>
            {createMutation.isPending ? 'Adding…' : 'Add category'}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
