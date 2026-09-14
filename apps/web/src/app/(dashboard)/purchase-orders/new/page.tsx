'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm, useFieldArray } from 'react-hook-form';
import { useMutation, useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { formatPaiseAsInr, rupeesToPaise, calcGstBreakup, calcInvoiceTotal, type PurchaseOrderInput } from '@bsms/shared';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FormField } from '@/components/form-field';
import { Breadcrumb } from '@/components/breadcrumb';
import { useRegisterQuickCreateTarget } from '@/lib/quick-create-context';
import { useVoucherDrafts } from '@/lib/voucher-drafts-context';
import { cn } from '@/lib/utils';
import { api, ApiError } from '@/lib/api-client';

interface Supplier {
  id: string;
  name: string;
  phone: string | null;
}

interface InventoryItem {
  id: string;
  name: string;
  unitPrice: number;
  gstRate: number;
  purchaseUnit: string | null;
}

interface Tab {
  key: string;
  saved: boolean;
  savedId?: string;
}

function isMeaningful(values: PurchaseOrderInput): boolean {
  return !!values.supplierId || values.lineItems.some((l) => l.description.trim() !== '');
}

// Direct mirror of sale-orders/new/page.tsx's tabbed multi-tasking pattern.
export default function NewPurchaseOrdersPage() {
  const { drafts, removeDraft } = useVoucherDrafts();
  const searchParams = useSearchParams();
  const draftParam = searchParams.get('draft');

  const [tabs, setTabs] = useState<Tab[]>(() => {
    const existing = drafts.filter((d) => d.type === 'purchase-order').map((d) => ({ key: d.id, saved: false }));
    return existing.length > 0 ? existing : [{ key: crypto.randomUUID(), saved: false }];
  });
  const [activeKey, setActiveKey] = useState<string>(() => draftParam ?? tabs[0].key);

  function addTab() {
    const key = crypto.randomUUID();
    setTabs((prev) => [...prev, { key, saved: false }]);
    setActiveKey(key);
  }

  function closeTab(key: string) {
    removeDraft(key);
    setTabs((prev) => {
      const next = prev.filter((t) => t.key !== key);
      if (next.length === 0) {
        const freshKey = crypto.randomUUID();
        setActiveKey(freshKey);
        return [{ key: freshKey, saved: false }];
      }
      if (activeKey === key) setActiveKey(next[0].key);
      return next;
    });
  }

  function markSaved(key: string, savedId: string) {
    setTabs((prev) => prev.map((t) => (t.key === key ? { ...t, saved: true, savedId } : t)));
  }

  return (
    <div className="flex flex-col gap-6">
      <Breadcrumb items={[{ label: 'Purchase Orders', href: '/purchase-orders' }, { label: 'New' }]} />

      <div className="flex items-center gap-1 border-b">
        {tabs.map((tab, i) => (
          <div
            key={tab.key}
            role="tab"
            tabIndex={0}
            aria-selected={activeKey === tab.key}
            onClick={() => setActiveKey(tab.key)}
            onKeyDown={(e) => {
              if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) {
                e.preventDefault();
                setActiveKey(tab.key);
              }
            }}
            className={cn(
              'flex cursor-pointer items-center gap-2 px-3 py-2 text-sm border-b-2 -mb-px outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
              activeKey === tab.key
                ? 'border-primary text-foreground font-medium'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            {tab.saved ? <span className="text-success">✓</span> : <span className="h-1.5 w-1.5 rounded-full bg-warning" />}
            Order {i + 1}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                closeTab(tab.key);
              }}
              aria-label={`Close Order ${i + 1}`}
              className="text-muted-foreground/60 hover:text-foreground ml-1"
            >
              ×
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={addTab}
          className="px-3 py-2 text-sm text-muted-foreground hover:text-foreground"
        >
          + Tab
        </button>
      </div>

      {tabs.map((tab) => (
        <div key={tab.key} className={activeKey === tab.key ? '' : 'hidden'}>
          <PurchaseOrderDraftForm
            id={tab.key}
            saved={tab.saved}
            savedId={tab.savedId}
            onSaved={(id) => markSaved(tab.key, id)}
          />
        </div>
      ))}
    </div>
  );
}

function PurchaseOrderDraftForm({
  id,
  saved,
  savedId,
  onSaved,
}: {
  id: string;
  saved: boolean;
  savedId?: string;
  onSaved: (id: string) => void;
}) {
  const router = useRouter();
  const quickCreate = useRegisterQuickCreateTarget();
  const { getDraft, upsertDraft, removeDraft } = useVoucherDrafts();

  const { data: suppliers } = useQuery({
    queryKey: ['suppliers'],
    queryFn: () => api.get<Supplier[]>('/suppliers'),
  });
  const { data: inventory } = useQuery({
    queryKey: ['inventory'],
    queryFn: () => api.get<InventoryItem[]>('/inventory'),
  });
  const supplierLabels = Object.fromEntries(
    (suppliers ?? []).map((s): [string, string] => [s.id, s.phone ? `${s.name} (${s.phone})` : s.name]),
  );
  const inventoryItemLabels = Object.fromEntries((inventory ?? []).map((i): [string, string] => [i.id, i.name]));

  const existingDraft = getDraft(id)?.data as PurchaseOrderInput | undefined;
  const form = useForm<PurchaseOrderInput>({
    defaultValues: existingDraft ?? {
      supplierId: '',
      lineItems: [{ description: '', qty: 1, unitPrice: 0, gstRate: 1800 }],
      discount: 0,
    },
  });
  const { fields, append, remove } = useFieldArray({ control: form.control, name: 'lineItems' });
  const watchedLines = form.watch('lineItems');
  const watchedDiscount = form.watch('discount');
  const gstBreakup = calcGstBreakup(
    watchedLines.map((l) => ({ qty: l.qty, unitPricePaise: l.unitPrice, gstRateBps: l.gstRate })),
  );
  const total = calcInvoiceTotal(
    watchedLines.map((l) => ({ qty: l.qty, unitPricePaise: l.unitPrice, gstRateBps: l.gstRate })),
    watchedDiscount,
  );

  useEffect(() => {
    const subscription = form.watch((values) => {
      const v = values as PurchaseOrderInput;
      if (!isMeaningful(v)) return;
      const supplier = suppliers?.find((s) => s.id === v.supplierId);
      upsertDraft(id, 'purchase-order', supplier ? supplier.name : 'New purchase order', v);
    });
    return () => subscription.unsubscribe();
  }, [form, suppliers, id, upsertDraft]);

  function applyItemToLine(index: number, itemId: string) {
    const item = inventory?.find((i) => i.id === itemId);
    if (!item) return;
    form.setValue(`lineItems.${index}.inventoryItemId`, item.id);
    form.setValue(`lineItems.${index}.description`, item.name);
    form.setValue(`lineItems.${index}.unitPrice`, item.unitPrice);
    form.setValue(`lineItems.${index}.gstRate`, item.gstRate);
  }

  const createMutation = useMutation({
    mutationFn: (input: PurchaseOrderInput) => api.post<{ id: string }>('/purchase-orders', input),
    onSuccess: (order) => {
      toast.success('Purchase order saved');
      removeDraft(id);
      onSaved(order.id);
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Failed to save purchase order'),
  });

  if (saved && savedId) {
    return (
      <Card className="max-w-2xl w-full mx-auto">
        <CardContent className="pt-6 flex flex-col gap-3">
          <p className="text-sm text-muted-foreground">This purchase order has been saved.</p>
          <div className="flex gap-2">
            <Link href={`/purchase-orders/${savedId}`}>
              <Button variant="outline">View purchase order</Button>
            </Link>
            <Button variant="ghost" onClick={() => router.push('/purchase-orders')}>
              Back to list
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="max-w-2xl w-full mx-auto">
      <CardHeader>
        <CardTitle>New purchase order</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={form.handleSubmit((v) => createMutation.mutate(v))} className="flex flex-col gap-3">
          <FormField label="Supplier" htmlFor="purchase-order-supplier-select">
            <Select
              items={supplierLabels}
              value={form.watch('supplierId')}
              onValueChange={(v: string | null) => form.setValue('supplierId', v ?? '')}
            >
              <SelectTrigger
                id="purchase-order-supplier-select"
                autoFocus
                onFocus={() =>
                  quickCreate.onFocus({
                    entity: 'supplier',
                    onCreated: (supplier) => form.setValue('supplierId', supplier.id),
                  })
                }
                onBlur={quickCreate.onBlur}
              >
                <SelectValue placeholder="Select a supplier" />
              </SelectTrigger>
              <SelectContent>
                {suppliers?.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.phone ? `${s.name} (${s.phone})` : s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>

          {fields.map((field, index) => {
            const selectedItem = inventory?.find((i) => i.id === watchedLines[index]?.inventoryItemId);
            return (
            <div key={field.id} className="grid grid-cols-[1fr_1fr_60px_90px_auto] gap-2 items-end">
              <div className="flex flex-col gap-1">
                {index === 0 && <Label className="text-xs">Item</Label>}
                <Select
                  items={inventoryItemLabels}
                  value={watchedLines[index]?.inventoryItemId ?? ''}
                  onValueChange={(v: string | null) => applyItemToLine(index, v ?? '')}
                >
                  <SelectTrigger
                    aria-label={`Line ${index + 1} item`}
                    onFocus={() =>
                      quickCreate.onFocus({
                        entity: 'inventory-item',
                        onCreated: (item) => applyItemToLine(index, item.id),
                      })
                    }
                    onBlur={quickCreate.onBlur}
                  >
                    <SelectValue placeholder="Pick item" />
                  </SelectTrigger>
                  <SelectContent>
                    {inventory?.map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        {item.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1">
                {index === 0 && <Label className="text-xs">Description</Label>}
                <Input
                  aria-label={`Line ${index + 1} description`}
                  {...form.register(`lineItems.${index}.description`, { required: true })}
                />
              </div>
              <div className="flex flex-col gap-1">
                {index === 0 && <Label className="text-xs">Qty</Label>}
                <Input
                  type="number"
                  min={1}
                  aria-label={`Line ${index + 1} quantity`}
                  {...form.register(`lineItems.${index}.qty`, { valueAsNumber: true })}
                />
                {selectedItem?.purchaseUnit && (
                  <p className="text-[10px] text-muted-foreground">{selectedItem.purchaseUnit}</p>
                )}
              </div>
              <div className="flex flex-col gap-1">
                {index === 0 && <Label className="text-xs">Price (₹)</Label>}
                <Input
                  type="number"
                  step="0.01"
                  defaultValue={watchedLines[index]?.unitPrice ? watchedLines[index].unitPrice / 100 : 0}
                  aria-label={`Line ${index + 1} unit price`}
                  onChange={(e) => form.setValue(`lineItems.${index}.unitPrice`, rupeesToPaise(Number(e.target.value)))}
                />
              </div>
              <Button type="button" variant="ghost" size="sm" onClick={() => remove(index)}>
                Remove
              </Button>
            </div>
            );
          })}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="self-start"
            onClick={() => append({ description: '', qty: 1, unitPrice: 0, gstRate: 1800 })}
          >
            Add line
          </Button>

          <div className="text-sm text-muted-foreground border-t pt-2 flex flex-col gap-1">
            <div className="flex justify-between">
              <span>CGST</span>
              <span>{formatPaiseAsInr(gstBreakup.cgstPaise)}</span>
            </div>
            <div className="flex justify-between">
              <span>SGST</span>
              <span>{formatPaiseAsInr(gstBreakup.sgstPaise)}</span>
            </div>
            <div className="flex justify-between text-foreground font-medium">
              <span>Total</span>
              <span>{formatPaiseAsInr(total)}</span>
            </div>
          </div>

          <div className="flex gap-2">
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? 'Saving…' : 'Save purchase order'}
            </Button>
            <Button type="button" variant="ghost" onClick={() => router.push('/purchase-orders')}>
              Cancel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
