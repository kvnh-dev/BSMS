'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm, useFieldArray } from 'react-hook-form';
import { useMutation, useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { formatPaiseAsInr, rupeesToPaise, calcGstBreakup, calcInvoiceTotal, type SaleOrderInput } from '@bsms/shared';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FormField } from '@/components/form-field';
import { Breadcrumb } from '@/components/breadcrumb';
import { QuickAdjustStockSheet } from '@/components/quick-adjust-stock-sheet';
import { useRegisterQuickCreateTarget } from '@/lib/quick-create-context';
import { useVoucherDrafts } from '@/lib/voucher-drafts-context';
import { BarcodeScanInput, type ScannedInventoryItem } from '@/components/barcode-scan-input';
import { cn } from '@/lib/utils';
import { api, ApiError } from '@/lib/api-client';

interface Customer {
  id: string;
  name: string;
  phone: string;
}

interface InventoryItem {
  id: string;
  name: string;
  unitPrice: number;
  gstRate: number;
  stockQty: number;
  saleUnit: string | null;
}

interface Tab {
  key: string;
  saved: boolean;
  savedId?: string;
}

function isMeaningful(values: SaleOrderInput): boolean {
  return !!values.customerId || values.lineItems.some((l) => l.description.trim() !== '');
}

// Tally-style multi-tasking: several sale orders can be drafted at once in
// their own tabs, and — via the voucher-drafts store — a tab's in-progress
// content survives navigating away entirely (e.g. an Alt+G detour) and back,
// not just switching tabs within this one page load.
export default function NewSaleOrdersPage() {
  const { drafts, removeDraft } = useVoucherDrafts();
  const searchParams = useSearchParams();
  const draftParam = searchParams.get('draft');

  const [tabs, setTabs] = useState<Tab[]>(() => {
    const existing = drafts.filter((d) => d.type === 'sale-order').map((d) => ({ key: d.id, saved: false }));
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
      <Breadcrumb items={[{ label: 'Sale Orders', href: '/sale-orders' }, { label: 'New' }]} />

      <div className="flex items-center gap-1 border-b">
        {tabs.map((tab, i) => (
          // A real <button> can't nest another interactive element (the close
          // "×"), so this is a role="tab" div with its own Enter/Space
          // handling instead — the close button inside it stays a real
          // <button>, which already gets Enter/Space activation for free.
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
          <SaleOrderDraftForm
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

function SaleOrderDraftForm({
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

  const { data: customers } = useQuery({
    queryKey: ['customers'],
    queryFn: () => api.get<Customer[]>('/customers'),
  });
  const { data: inventory } = useQuery({
    queryKey: ['inventory'],
    queryFn: () => api.get<InventoryItem[]>('/inventory'),
  });
  const customerLabels = Object.fromEntries((customers ?? []).map((c): [string, string] => [c.id, `${c.name} (${c.phone})`]));
  const inventoryItemLabels = Object.fromEntries((inventory ?? []).map((i): [string, string] => [i.id, i.name]));

  const existingDraft = getDraft(id)?.data as SaleOrderInput | undefined;
  const form = useForm<SaleOrderInput>({
    defaultValues: existingDraft ?? {
      customerId: '',
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

  // Pushes changes into the voucher-drafts store as a side-channel — the
  // form itself stays an uncontrolled react-hook-form instance, this just
  // keeps a resumable copy alive at the layout level.
  useEffect(() => {
    const subscription = form.watch((values) => {
      const v = values as SaleOrderInput;
      if (!isMeaningful(v)) return;
      const customer = customers?.find((c) => c.id === v.customerId);
      upsertDraft(id, 'sale-order', customer ? customer.name : 'New sale order', v);
    });
    return () => subscription.unsubscribe();
  }, [form, customers, id, upsertDraft]);

  function applyItemToLine(index: number, itemId: string) {
    const item = inventory?.find((i) => i.id === itemId);
    if (!item) return;
    form.setValue(`lineItems.${index}.inventoryItemId`, item.id);
    form.setValue(`lineItems.${index}.description`, item.name);
    form.setValue(`lineItems.${index}.unitPrice`, item.unitPrice);
    form.setValue(`lineItems.${index}.gstRate`, item.gstRate);
  }

  function applyScannedItem(scanned: ScannedInventoryItem) {
    const lines = form.getValues('lineItems');
    const last = lines[lines.length - 1];
    if (last && !last.description && !last.inventoryItemId) {
      applyItemToLine(lines.length - 1, scanned.id);
    } else {
      append({ description: '', qty: 1, unitPrice: 0, gstRate: scanned.gstRate });
      applyItemToLine(lines.length, scanned.id);
    }
  }

  const createMutation = useMutation({
    mutationFn: (input: SaleOrderInput) => api.post<{ id: string }>('/sale-orders', input),
    onSuccess: (order) => {
      toast.success('Sale order saved');
      removeDraft(id);
      onSaved(order.id);
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Failed to save sale order'),
  });

  if (saved && savedId) {
    return (
      <Card className="max-w-2xl w-full mx-auto">
        <CardContent className="pt-6 flex flex-col gap-3">
          <p className="text-sm text-muted-foreground">This sale order has been saved.</p>
          <div className="flex gap-2">
            <Link href={`/sale-orders/${savedId}`}>
              <Button variant="outline">View sale order</Button>
            </Link>
            <Button variant="ghost" onClick={() => router.push('/sale-orders')}>
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
        <CardTitle>New sale order</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={form.handleSubmit((v) => createMutation.mutate(v))} className="flex flex-col gap-3">
          <FormField label="Customer" htmlFor="sale-order-customer-select">
            <Select
              items={customerLabels}
              value={form.watch('customerId')}
              onValueChange={(v: string | null) => form.setValue('customerId', v ?? '')}
            >
              <SelectTrigger
                id="sale-order-customer-select"
                autoFocus
                onFocus={() =>
                  quickCreate.onFocus({
                    entity: 'customer',
                    onCreated: (customer) => form.setValue('customerId', customer.id),
                  })
                }
                onBlur={quickCreate.onBlur}
              >
                <SelectValue placeholder="Select a customer" />
              </SelectTrigger>
              <SelectContent>
                {customers?.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name} ({c.phone})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>

          <BarcodeScanInput onFound={applyScannedItem} />

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
                {selectedItem && (
                  <QuickAdjustStockSheet
                    itemId={selectedItem.id}
                    itemName={selectedItem.name}
                    currentStock={selectedItem.stockQty}
                  />
                )}
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
                {selectedItem?.saleUnit && (
                  <p className="text-[10px] text-muted-foreground">{selectedItem.saleUnit}</p>
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
              {createMutation.isPending ? 'Saving…' : 'Save sale order'}
            </Button>
            <Button type="button" variant="ghost" onClick={() => router.push('/sale-orders')}>
              Cancel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
