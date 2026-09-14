'use client';

import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { inventoryItemSchema, bpsToPercent, rupeesToPaise, type InventoryItemInput } from '@bsms/shared';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from '@/components/ui/sheet';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FormField } from '@/components/form-field';
import { api, ApiError } from '@/lib/api-client';

interface InventoryItem {
  id: string;
  name: string;
  unitPrice: number;
  gstRate: number;
}

interface GstSlab {
  id: string;
  label: string;
  rate: number;
  isDefault: boolean;
}

interface Category {
  id: string;
  name: string;
  gstRate: number;
}

// A deliberately reduced field set — Tally's on-the-fly master creation is
// intentionally minimal. SKU/barcode/UoM/reorder point stay reachable by
// editing the item afterward on its full detail page.
export function QuickAddInventoryItemSheet({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (item: InventoryItem) => void;
}) {
  const queryClient = useQueryClient();
  const { data: gstSlabs } = useQuery({
    queryKey: ['gst-slabs'],
    queryFn: () => api.get<GstSlab[]>('/gst-slabs'),
    enabled: open,
  });
  const { data: categories } = useQuery({
    queryKey: ['categories'],
    queryFn: () => api.get<Category[]>('/categories'),
    enabled: open,
  });
  const defaultSlab = gstSlabs?.find((s) => s.isDefault) ?? gstSlabs?.[0];
  const gstSlabLabels = Object.fromEntries(
    (gstSlabs ?? []).map((s): [string, string] => [String(s.rate), `${s.label} (${bpsToPercent(s.rate)}%)`]),
  );

  const form = useForm<{
    name: string;
    category: string;
    hsnCode: string;
    gstRate: number;
    unitPriceRupees: number;
    stockQty: number;
  }>({
    defaultValues: { name: '', category: '', hsnCode: '', gstRate: 0, unitPriceRupees: 0, stockQty: 0 },
  });

  function applyCategory(name: string) {
    form.setValue('category', name);
    const category = categories?.find((c) => c.name === name);
    if (category) form.setValue('gstRate', category.gstRate);
  }

  useEffect(() => {
    if (defaultSlab && form.getValues('gstRate') === 0) {
      form.setValue('gstRate', defaultSlab.rate);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultSlab]);

  const createMutation = useMutation({
    mutationFn: (input: InventoryItemInput) => api.post<InventoryItem>('/inventory', input),
    onSuccess: (item) => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      toast.success('Inventory item added');
      onCreated(item);
      onOpenChange(false);
      form.reset({ name: '', category: '', hsnCode: '', gstRate: 0, unitPriceRupees: 0, stockQty: 0 });
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Failed to add item'),
  });

  function onSubmit(values: {
    name: string;
    category: string;
    hsnCode: string;
    gstRate: number;
    unitPriceRupees: number;
    stockQty: number;
  }) {
    const parsed = inventoryItemSchema.safeParse({
      name: values.name,
      category: values.category,
      hsnCode: values.hsnCode,
      gstRate: values.gstRate,
      unitPrice: rupeesToPaise(values.unitPriceRupees),
      stockQty: values.stockQty,
    });
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
          <SheetTitle>New inventory item</SheetTitle>
        </SheetHeader>
        <form id="quick-add-inventory-item-form" onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-3">
          <FormField label="Name">
            <Input {...form.register('name', { required: true })} />
          </FormField>
          <FormField label="Category" htmlFor="quick-inventory-category-select">
            <Select
              items={Object.fromEntries((categories ?? []).map((c): [string, string] => [c.name, c.name]))}
              onValueChange={(v) => applyCategory((v as string | null) ?? '')}
            >
              <SelectTrigger id="quick-inventory-category-select">
                <SelectValue placeholder="Select a category" />
              </SelectTrigger>
              <SelectContent>
                {categories?.map((c) => (
                  <SelectItem key={c.id} value={c.name}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
          <FormField label="HSN code">
            <Input {...form.register('hsnCode', { required: true })} />
          </FormField>
          <FormField label="GST slab" htmlFor="quick-inventory-gst-slab">
            <Select
              items={gstSlabLabels}
              value={String(form.watch('gstRate'))}
              onValueChange={(v) => form.setValue('gstRate', Number(v))}
            >
              <SelectTrigger id="quick-inventory-gst-slab">
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
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Unit price (₹)">
              <Input type="number" step="0.01" {...form.register('unitPriceRupees', { valueAsNumber: true, required: true })} />
            </FormField>
            <FormField label="Stock quantity">
              <Input type="number" {...form.register('stockQty', { valueAsNumber: true })} />
            </FormField>
          </div>
        </form>
        <SheetFooter>
          <Button type="submit" form="quick-add-inventory-item-form" disabled={createMutation.isPending}>
            {createMutation.isPending ? 'Adding…' : 'Add item'}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
