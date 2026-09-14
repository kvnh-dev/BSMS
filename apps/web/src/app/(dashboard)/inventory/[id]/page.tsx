'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { formatPaiseAsInr, rupeesToPaise, bpsToPercent } from '@bsms/shared';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FormField } from '@/components/form-field';
import { Breadcrumb } from '@/components/breadcrumb';
import { useRegisterQuickCreateTarget } from '@/lib/quick-create-context';
import { usePageUpDownNavigation } from '@/lib/use-record-navigation';
import { api, ApiError } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { describeChange } from '@/lib/audit-log-format';

interface InventoryItem {
  id: string;
  name: string;
  category: string;
  hsnCode: string;
  gstRate: number;
  unitPrice: number;
  stockQty: number;
  reorderPoint: number;
  sku: string | null;
  barcode: string | null;
  baseUnit: string;
  purchaseUnit: string | null;
  purchaseUnitFactor: number;
  saleUnit: string | null;
  saleUnitFactor: number;
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

interface AuditLogEntry {
  id: string;
  action: string;
  timestamp: string;
  actor: { name: string };
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
}

interface EditForm {
  name: string;
  category: string;
  hsnCode: string;
  gstRate: number;
  unitPriceRupees: number;
  reorderPoint: number;
  sku: string;
  barcode: string;
  baseUnit: string;
  purchaseUnit: string;
  purchaseUnitFactor: number;
  saleUnit: string;
  saleUnitFactor: number;
}

export default function InventoryItemDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { hasPersona } = useAuth();
  const canEdit = hasPersona('OWNER');
  const canViewActivity = hasPersona('OWNER', 'AUDITOR');
  const queryClient = useQueryClient();
  const quickCreate = useRegisterQuickCreateTarget();

  const [adjustOpen, setAdjustOpen] = useState(false);
  const [delta, setDelta] = useState(0);
  const [reason, setReason] = useState('');
  const [adjustUnit, setAdjustUnit] = useState<'BASE' | 'PURCHASE'>('BASE');

  const { data: item, isLoading } = useQuery({
    queryKey: ['inventory', id],
    queryFn: () => api.get<InventoryItem>(`/inventory/${id}`),
  });

  const { data: inventoryList } = useQuery({
    queryKey: ['inventory'],
    queryFn: () => api.get<{ id: string }[]>('/inventory'),
  });
  usePageUpDownNavigation(inventoryList, id, (i) => `/inventory/${i.id}`);

  const { data: gstSlabs } = useQuery({
    queryKey: ['gst-slabs'],
    queryFn: () => api.get<GstSlab[]>('/gst-slabs'),
  });

  const { data: categories } = useQuery({
    queryKey: ['categories'],
    queryFn: () => api.get<Category[]>('/categories'),
  });

  const { data: activity } = useQuery({
    queryKey: ['audit-log', 'InventoryItem', id],
    queryFn: () => api.get<AuditLogEntry[]>(`/audit-log?entity=InventoryItem&entityId=${id}`),
    enabled: canViewActivity,
  });

  // Base UI's <Select.Value> shows the raw `value` unless the Select is
  // given an `items` value->label map.
  const gstSlabLabels = Object.fromEntries(
    (gstSlabs ?? []).map((s): [string, string] => [String(s.rate), `${s.label} (${bpsToPercent(s.rate)}%)`]),
  );
  const categoryLabels = Object.fromEntries((categories ?? []).map((c): [string, string] => [c.name, c.name]));

  const form = useForm<EditForm>({
    defaultValues: {
      name: '',
      category: '',
      hsnCode: '',
      gstRate: 0,
      unitPriceRupees: 0,
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

  // Populate the form once the item loads — fetched, not known up front.
  useEffect(() => {
    if (item) {
      form.reset({
        name: item.name,
        category: item.category,
        hsnCode: item.hsnCode,
        gstRate: item.gstRate,
        unitPriceRupees: item.unitPrice / 100,
        reorderPoint: item.reorderPoint,
        sku: item.sku ?? '',
        barcode: item.barcode ?? '',
        baseUnit: item.baseUnit,
        purchaseUnit: item.purchaseUnit ?? '',
        purchaseUnitFactor: item.purchaseUnitFactor,
        saleUnit: item.saleUnit ?? '',
        saleUnitFactor: item.saleUnitFactor,
      });
    }
  }, [item, form]);

  const saveMutation = useMutation({
    mutationFn: (values: EditForm) =>
      api.patch(`/inventory/${id}`, {
        name: values.name,
        category: values.category,
        hsnCode: values.hsnCode,
        gstRate: values.gstRate,
        unitPrice: rupeesToPaise(values.unitPriceRupees),
        reorderPoint: values.reorderPoint,
        sku: values.sku || undefined,
        barcode: values.barcode || undefined,
        baseUnit: values.baseUnit || 'PCS',
        purchaseUnit: values.purchaseUnit || undefined,
        purchaseUnitFactor: values.purchaseUnitFactor || 1,
        saleUnit: values.saleUnit || undefined,
        saleUnitFactor: values.saleUnitFactor || 1,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory', id] });
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      toast.success('Item updated');
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Failed to update item'),
  });

  // Stock changes go through the dedicated endpoint (not a plain field edit)
  // so every change is captured in the audit log with a reason — see
  // InventoryService.adjustStock. Choosing "Purchase" lets the delta be
  // entered in the item's purchase unit; the backend converts to base units.
  const adjustMutation = useMutation({
    mutationFn: () => api.post(`/inventory/${id}/adjust-stock`, { delta, reason, unit: adjustUnit }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory', id] });
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      toast.success('Stock adjusted');
      setAdjustOpen(false);
      setDelta(0);
      setReason('');
      setAdjustUnit('BASE');
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Failed to adjust stock'),
  });

  if (isLoading || !item) {
    return <p className="text-muted-foreground text-sm">Loading…</p>;
  }

  return (
    <div className="flex flex-col gap-6">
      <Breadcrumb items={[{ label: 'Inventory', href: '/inventory' }, { label: item.name }]} />
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>{item.name}</CardTitle>
          {canEdit && (
            <Dialog open={adjustOpen} onOpenChange={setAdjustOpen}>
              <DialogTrigger render={<Button size="sm" variant="outline">Adjust stock</Button>} />
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Adjust stock — {item.name}</DialogTitle>
                </DialogHeader>
                <div className="flex flex-col gap-3">
                  <p className="text-sm text-muted-foreground">
                    Current stock: {item.stockQty} {item.baseUnit}
                  </p>
                  {item.purchaseUnit && (
                    <FormField label="Unit">
                      <Select
                        items={{ BASE: item.baseUnit, PURCHASE: item.purchaseUnit }}
                        value={adjustUnit}
                        onValueChange={(v) => setAdjustUnit((v as 'BASE' | 'PURCHASE') ?? 'BASE')}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="BASE">{item.baseUnit}</SelectItem>
                          <SelectItem value="PURCHASE">
                            {item.purchaseUnit} (= {item.purchaseUnitFactor} {item.baseUnit})
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </FormField>
                  )}
                  <FormField label="Change (+ to add, − to remove)">
                    <Input type="number" value={delta} onChange={(e) => setDelta(Number(e.target.value))} />
                  </FormField>
                  <FormField label="Reason">
                    <Input
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      placeholder="e.g. Restock from supplier, damaged stock write-off"
                    />
                  </FormField>
                  <DialogFooter>
                    <Button
                      onClick={() => adjustMutation.mutate()}
                      disabled={!delta || !reason || adjustMutation.isPending}
                    >
                      {adjustMutation.isPending ? 'Saving…' : 'Save adjustment'}
                    </Button>
                  </DialogFooter>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground flex flex-col gap-1">
          <p>
            Current stock:{' '}
            <span className={item.stockQty <= item.reorderPoint ? 'text-destructive font-medium' : 'text-foreground font-medium'}>
              {item.stockQty} {item.baseUnit}
            </span>
            {item.stockQty <= item.reorderPoint && ' — at or below reorder point'}
          </p>
          {(item.sku || item.barcode) && (
            <p>
              {item.sku && <span>SKU: {item.sku}</span>}
              {item.sku && item.barcode && <span> · </span>}
              {item.barcode && <span>Barcode: {item.barcode}</span>}
            </p>
          )}
        </CardContent>
      </Card>

      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
      {canEdit ? (
        <Card className="max-w-xl lg:shrink-0">
          <CardHeader>
            <CardTitle>Edit details</CardTitle>
          </CardHeader>
          <CardContent>
            <form
              onSubmit={form.handleSubmit((values) => saveMutation.mutate(values))}
              className="flex flex-col gap-3"
            >
              <FormField label="Name">
                <Input {...form.register('name', { required: true })} />
              </FormField>
              <FormField label="Category" htmlFor="inventory-edit-category-select">
                <Select
                  items={categoryLabels}
                  value={form.watch('category')}
                  onValueChange={(v) => applyCategory((v as string | null) ?? '')}
                >
                  <SelectTrigger
                    id="inventory-edit-category-select"
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
              <FormField label="GST slab" htmlFor="inventory-edit-gst-slab">
                <Select
                  items={gstSlabLabels}
                  value={String(form.watch('gstRate'))}
                  onValueChange={(v) => form.setValue('gstRate', Number(v))}
                >
                  <SelectTrigger
                    id="inventory-edit-gst-slab"
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
                  <Input {...form.register('sku')} />
                </FormField>
                <FormField label="Barcode (optional)">
                  <Input {...form.register('barcode')} />
                </FormField>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <FormField label="Unit price (₹)">
                  <Input
                    type="number"
                    step="0.01"
                    {...form.register('unitPriceRupees', { valueAsNumber: true, required: true })}
                  />
                </FormField>
                <FormField label="Reorder Point (ROP)">
                  <Input type="number" {...form.register('reorderPoint', { valueAsNumber: true })} />
                </FormField>
              </div>

              <div className="border-t pt-3 flex flex-col gap-3">
                <p className="text-xs text-muted-foreground">
                  Units of measure — stock is always tracked in the base unit. Purchase/sale units are optional
                  alternates with a whole-number conversion ratio.
                </p>
                <FormField label="Base unit">
                  <Input {...form.register('baseUnit', { required: true })} />
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

              <Button type="submit" className="self-start" disabled={saveMutation.isPending}>
                {saveMutation.isPending ? 'Saving…' : 'Save changes'}
              </Button>
            </form>
          </CardContent>
        </Card>
      ) : (
        <Card className="max-w-xl lg:shrink-0">
          <CardHeader>
            <CardTitle>Details</CardTitle>
          </CardHeader>
          <CardContent className="text-sm flex flex-col gap-1.5">
            <p>
              <span className="text-muted-foreground">Category: </span>
              {item.category}
            </p>
            <p>
              <span className="text-muted-foreground">HSN code: </span>
              {item.hsnCode}
            </p>
            <p>
              <span className="text-muted-foreground">GST rate: </span>
              {bpsToPercent(item.gstRate)}%
            </p>
            <p>
              <span className="text-muted-foreground">Unit price: </span>
              {formatPaiseAsInr(item.unitPrice)}
              {item.saleUnit ? ` / ${item.saleUnit}` : ''}
            </p>
            <p>
              <span className="text-muted-foreground">Reorder Point (ROP): </span>
              {item.reorderPoint}
            </p>
          </CardContent>
        </Card>
      )}

      {canViewActivity && (
        <Card className="flex-1">
          <CardHeader>
            <CardTitle>Stock activity</CardTitle>
          </CardHeader>
          <CardContent>
            {!activity ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : activity.length === 0 ? (
              <p className="text-sm text-muted-foreground">No stock adjustments recorded for this item yet.</p>
            ) : (
              <div className="flex flex-col gap-3">
                {activity.map((entry) => (
                  <div key={entry.id} className="flex flex-col gap-0.5 border-b pb-3 last:border-0 last:pb-0">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">{entry.actor.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {new Date(entry.timestamp).toLocaleString()}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground">{describeChange(entry.before, entry.after)}</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
      </div>
    </div>
  );
}
