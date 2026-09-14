'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm, useFieldArray } from 'react-hook-form';
import { useMutation, useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { formatPaiseAsInr, rupeesToPaise, calcGstBreakup, calcInvoiceTotal, type CreatePurchaseBillInput } from '@bsms/shared';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FormField } from '@/components/form-field';
import { Breadcrumb } from '@/components/breadcrumb';
import { useRegisterQuickCreateTarget } from '@/lib/quick-create-context';
import { useVoucherDrafts } from '@/lib/voucher-drafts-context';
import { api, ApiError } from '@/lib/api-client';

interface PurchaseBill {
  id: string;
}

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

interface PurchaseBillDraftData {
  supplierId: string;
  billNumber?: string;
  lineItems: CreatePurchaseBillInput['lineItems'];
  discount: number;
}

function isDraftMeaningful(values: PurchaseBillDraftData): boolean {
  return !!values.supplierId || values.lineItems.some((l) => l.description.trim() !== '');
}

// Single-stage — unlike invoices/new there's no ticket-vs-standalone mode
// toggle, since a purchase bill has no ticket-billing equivalent. Direct
// mirror of invoices/new's standalone-sale branch only.
export default function NewPurchaseBillPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { drafts, getDraft, upsertDraft, removeDraft } = useVoucherDrafts();
  const quickCreate = useRegisterQuickCreateTarget();

  const [draftId] = useState<string>(() => {
    const param = searchParams.get('draft');
    if (param) return param;
    const existing = drafts.find((d) => d.type === 'purchase-bill');
    return existing ? existing.id : crypto.randomUUID();
  });
  const existingDraft = getDraft(draftId)?.data as PurchaseBillDraftData | undefined;
  const supplierIdParam = !existingDraft?.supplierId ? searchParams.get('supplierId') : null;

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

  const form = useForm<PurchaseBillDraftData>({
    defaultValues: existingDraft ?? {
      supplierId: supplierIdParam ?? '',
      billNumber: '',
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
    function sync() {
      const values = form.getValues();
      if (!isDraftMeaningful(values)) return;
      const supplier = suppliers?.find((s) => s.id === values.supplierId);
      upsertDraft(draftId, 'purchase-bill', supplier ? `Bill — ${supplier.name}` : 'New purchase bill', values);
    }
    sync();
    const subscription = form.watch(() => sync());
    return () => subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form, suppliers, draftId]);

  function applyItemToLine(index: number, itemId: string) {
    const item = inventory?.find((i) => i.id === itemId);
    if (!item) return;
    form.setValue(`lineItems.${index}.inventoryItemId`, item.id);
    form.setValue(`lineItems.${index}.description`, item.name);
    form.setValue(`lineItems.${index}.unitPrice`, item.unitPrice);
    form.setValue(`lineItems.${index}.gstRate`, item.gstRate);
  }

  const createMutation = useMutation({
    mutationFn: (input: CreatePurchaseBillInput) => api.post<PurchaseBill>('/purchase-bills', input),
    onSuccess: (bill) => {
      toast.success('Purchase bill recorded — stock updated');
      removeDraft(draftId);
      router.push(`/purchase-bills/${bill.id}`);
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Failed to record purchase bill'),
  });

  return (
    <div className="flex flex-col gap-6">
      <Breadcrumb items={[{ label: 'Purchase Bills', href: '/purchase-bills' }, { label: 'New' }]} />
      <Card className="max-w-2xl w-full mx-auto">
        <CardHeader>
          <CardTitle>New purchase bill</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={form.handleSubmit((v) => createMutation.mutate(v))} className="flex flex-col gap-3">
            <p className="text-xs text-muted-foreground">
              Recording this bill moves stock immediately — there&apos;s no draft stage to review first.
            </p>
            <FormField label="Supplier" htmlFor="purchase-bill-supplier-select">
              <Select
                items={supplierLabels}
                value={form.watch('supplierId')}
                onValueChange={(v: string | null) => form.setValue('supplierId', v ?? '')}
              >
                <SelectTrigger
                  id="purchase-bill-supplier-select"
                  autoFocus={!supplierIdParam}
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

            <FormField label="Supplier's bill number (optional)">
              <Input {...form.register('billNumber')} placeholder="e.g. SUP-INV-0042" autoFocus={!!supplierIdParam} />
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
                {createMutation.isPending ? 'Recording…' : 'Record purchase bill'}
              </Button>
              <Button type="button" variant="ghost" onClick={() => router.push('/purchase-bills')}>
                Cancel
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
