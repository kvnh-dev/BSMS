'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { inventoryItemSchema, bpsToPercent, rupeesToPaise, type InventoryItemInput } from '@bsms/shared';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FormField } from '@/components/form-field';
import { Breadcrumb } from '@/components/breadcrumb';
import { useRegisterQuickCreateTarget } from '@/lib/quick-create-context';
import { api, ApiError } from '@/lib/api-client';

interface InventoryItem {
  id: string;
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

interface FormValues {
  name: string;
  category: string;
  hsnCode: string;
  gstRate: number;
  unitPriceRupees: number;
  stockQty: number;
  reorderPoint: number;
  sku: string;
  barcode: string;
  baseUnit: string;
  purchaseUnit: string;
  purchaseUnitFactor: number;
  saleUnit: string;
  saleUnitFactor: number;
}

export default function NewInventoryItemPage() {
  const router = useRouter();
  const quickCreate = useRegisterQuickCreateTarget();

  const { data: gstSlabs } = useQuery({
    queryKey: ['gst-slabs'],
    queryFn: () => api.get<GstSlab[]>('/gst-slabs'),
  });
  const { data: categories } = useQuery({
    queryKey: ['categories'],
    queryFn: () => api.get<Category[]>('/categories'),
  });
  const defaultSlab = gstSlabs?.find((s) => s.isDefault) ?? gstSlabs?.[0];

  // Base UI's <Select.Value> shows the raw `value` unless the Select is
  // given an `items` value->label map.
  const gstSlabLabels = Object.fromEntries(
    (gstSlabs ?? []).map((s): [string, string] => [String(s.rate), `${s.label} (${bpsToPercent(s.rate)}%)`]),
  );

  const form = useForm<FormValues>({
    defaultValues: {
      name: '',
      category: '',
      hsnCode: '',
      gstRate: 0,
      unitPriceRupees: 0,
      stockQty: 0,
      reorderPoint: 0,
      sku: '',
      barcode: '',
      baseUnit: 'PCS',
      purchaseUnit: '',
      purchaseUnitFactor: 1,
      saleUnit: '',
      saleUnitFactor: 1,
    },
  });

  function applyCategory(name: string) {
    form.setValue('category', name);
    const category = categories?.find((c) => c.name === name);
    if (category) form.setValue('gstRate', category.gstRate);
  }

  // Pre-select the default GST slab once it loads, so the displayed value
  // and the actual form value agree even if the user never touches the field.
  useEffect(() => {
    if (defaultSlab && form.getValues('gstRate') === 0) {
      form.setValue('gstRate', defaultSlab.rate);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultSlab]);

  const createMutation = useMutation({
    mutationFn: (input: InventoryItemInput) => api.post<InventoryItem>('/inventory', input),
    onSuccess: (item) => {
      toast.success('Inventory item added');
      router.push(`/inventory/${item.id}`);
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Failed to add item'),
  });

  function onSubmit(values: FormValues) {
    const parsed = inventoryItemSchema.safeParse({
      name: values.name,
      category: values.category,
      hsnCode: values.hsnCode,
      gstRate: values.gstRate,
      unitPrice: rupeesToPaise(values.unitPriceRupees),
      stockQty: values.stockQty,
      reorderPoint: values.reorderPoint,
      sku: values.sku || undefined,
      barcode: values.barcode || undefined,
      baseUnit: values.baseUnit || 'PCS',
      purchaseUnit: values.purchaseUnit || undefined,
      purchaseUnitFactor: values.purchaseUnitFactor || 1,
      saleUnit: values.saleUnit || undefined,
      saleUnitFactor: values.saleUnitFactor || 1,
    });
    if (!parsed.success) {
      toast.error('Please check the form for errors');
      return;
    }
    createMutation.mutate(parsed.data);
  }

  return (
    <div className="flex flex-col gap-6">
      <Breadcrumb items={[{ label: 'Inventory', href: '/inventory' }, { label: 'New item' }]} />
      <Card className="max-w-xl w-full mx-auto">
        <CardHeader>
          <CardTitle>New inventory item</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-3">
            <FormField label="Name">
              <Input {...form.register('name', { required: true })} autoFocus />
            </FormField>
            <FormField label="Category" htmlFor="inventory-category-select">
              <Select
                items={Object.fromEntries((categories ?? []).map((c): [string, string] => [c.name, c.name]))}
                onValueChange={(v) => applyCategory((v as string | null) ?? '')}
              >
                <SelectTrigger
                  id="inventory-category-select"
                  onFocus={() =>
                    quickCreate.onFocus({ entity: 'category', onCreated: (category) => applyCategory(category.name) })
                  }
                  onBlur={quickCreate.onBlur}
                >
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
            <FormField label="GST slab" htmlFor="inventory-gst-slab">
              <Select
                items={gstSlabLabels}
                value={String(form.watch('gstRate'))}
                onValueChange={(v) => form.setValue('gstRate', Number(v))}
              >
                <SelectTrigger
                  id="inventory-gst-slab"
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
            <div className="grid grid-cols-2 gap-3">
              <FormField label="SKU (optional)">
                <Input {...form.register('sku')} placeholder="e.g. ENG-OIL-1L" />
              </FormField>
              <FormField label="Barcode (optional)">
                <Input {...form.register('barcode')} placeholder="Scan or type" />
              </FormField>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Unit price (₹)">
                <Input type="number" step="0.01" {...form.register('unitPriceRupees', { valueAsNumber: true, required: true })} />
              </FormField>
              <FormField label="Stock quantity">
                <Input type="number" {...form.register('stockQty', { valueAsNumber: true })} />
              </FormField>
            </div>
            <FormField label="Reorder Point (ROP)">
              <Input type="number" {...form.register('reorderPoint', { valueAsNumber: true })} />
            </FormField>

            <div className="border-t pt-3 flex flex-col gap-3">
              <p className="text-xs text-muted-foreground">
                Units of measure — stock is always tracked in the base unit. Purchase/sale units are optional
                alternates with a whole-number conversion ratio (e.g. 1 Box = 12 base units).
              </p>
              <FormField label="Base unit">
                <Input {...form.register('baseUnit', { required: true })} placeholder="e.g. PCS, ML, KG" />
              </FormField>
              <div className="grid grid-cols-2 gap-3">
                <FormField label="Purchase unit (optional)">
                  <Input {...form.register('purchaseUnit')} placeholder="e.g. Box" />
                </FormField>
                <FormField label="= how many base units">
                  <Input type="number" min={1} {...form.register('purchaseUnitFactor', { valueAsNumber: true })} />
                </FormField>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <FormField label="Sale unit (optional)">
                  <Input {...form.register('saleUnit')} placeholder="e.g. Bottle" />
                </FormField>
                <FormField label="= how many base units">
                  <Input type="number" min={1} {...form.register('saleUnitFactor', { valueAsNumber: true })} />
                </FormField>
              </div>
            </div>

            <div className="flex gap-2">
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? 'Adding…' : 'Add item'}
              </Button>
              <Button type="button" variant="ghost" onClick={() => router.push('/inventory')}>
                Cancel
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
