'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { percentToBps, type GstSlabInput } from '@bsms/shared';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from '@/components/ui/sheet';
import { FormField } from '@/components/form-field';
import { api, ApiError } from '@/lib/api-client';

interface GstSlab {
  id: string;
  label: string;
  rate: number;
  isDefault: boolean;
}

export function QuickAddGstSlabSheet({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (slab: GstSlab) => void;
}) {
  const queryClient = useQueryClient();
  const form = useForm<{ label: string; ratePercent: number; isDefault: boolean }>({
    defaultValues: { label: '', ratePercent: 0, isDefault: false },
  });

  const createMutation = useMutation({
    mutationFn: (input: GstSlabInput) => api.post<GstSlab>('/gst-slabs', input),
    onSuccess: (slab) => {
      queryClient.invalidateQueries({ queryKey: ['gst-slabs'] });
      toast.success('GST slab added');
      onCreated(slab);
      onOpenChange(false);
      form.reset();
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
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>New GST slab</SheetTitle>
        </SheetHeader>
        <form id="quick-add-gst-slab-form" onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-3">
          <FormField label="Label">
            <Input {...form.register('label', { required: true })} placeholder="e.g. Accessories" />
          </FormField>
          <FormField label="Rate (%)">
            <Input type="number" step="0.01" {...form.register('ratePercent', { valueAsNumber: true, required: true })} />
          </FormField>
          <label className="flex items-center gap-1.5 text-sm">
            <Checkbox onCheckedChange={(checked) => form.setValue('isDefault', checked === true)} />
            Set as default
          </label>
        </form>
        <SheetFooter>
          <Button type="submit" form="quick-add-gst-slab-form" disabled={createMutation.isPending}>
            {createMutation.isPending ? 'Adding…' : 'Add slab'}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
