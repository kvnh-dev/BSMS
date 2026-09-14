'use client';

import { useParams, useRouter } from 'next/navigation';
import { useForm, useFieldArray } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  formatPaiseAsInr,
  rupeesToPaise,
  bpsToPercent,
  calcGstBreakup,
  calcInvoiceTotal,
  type EditInvoiceLineItemsInput,
} from '@bsms/shared';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FormField } from '@/components/form-field';
import { Breadcrumb } from '@/components/breadcrumb';
import { BarcodeScanInput, type ScannedInventoryItem } from '@/components/barcode-scan-input';
import { useRegisterQuickCreateTarget } from '@/lib/quick-create-context';
import { api, ApiError } from '@/lib/api-client';

interface InvoiceLineItem {
  id: string;
  inventoryItemId: string | null;
  description: string;
  qty: number;
  unitPrice: number;
  gstRate: number;
}

interface InvoiceDetail {
  id: string;
  invoiceNumber: string | null;
  discount: number;
  lineItems: InvoiceLineItem[];
}

interface InventoryItem {
  id: string;
  name: string;
  unitPrice: number;
  gstRate: number;
  saleUnit: string | null;
}

export default function ReviseInvoicePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const quickCreate = useRegisterQuickCreateTarget();

  const { data: invoice, isLoading } = useQuery({
    queryKey: ['invoices', id],
    queryFn: () => api.get<InvoiceDetail>(`/invoices/${id}`),
  });

  const { data: inventory } = useQuery({
    queryKey: ['inventory'],
    queryFn: () => api.get<InventoryItem[]>('/inventory'),
  });
  const inventoryItemLabels = Object.fromEntries((inventory ?? []).map((i): [string, string] => [i.id, i.name]));

  const form = useForm<EditInvoiceLineItemsInput>({
    values: invoice
      ? {
          lineItems: invoice.lineItems.map((l) => ({
            inventoryItemId: l.inventoryItemId ?? undefined,
            description: l.description,
            qty: l.qty,
            unitPrice: l.unitPrice,
            gstRate: l.gstRate,
          })),
          discount: invoice.discount,
        }
      : undefined,
  });
  const { fields, append, remove } = useFieldArray({ control: form.control, name: 'lineItems' });
  const watchedLines = form.watch('lineItems');
  const watchedDiscount = form.watch('discount');
  const gstBreakup = calcGstBreakup(
    (watchedLines ?? []).map((l) => ({ qty: l.qty, unitPricePaise: l.unitPrice, gstRateBps: l.gstRate })),
  );
  const total = calcInvoiceTotal(
    (watchedLines ?? []).map((l) => ({ qty: l.qty, unitPricePaise: l.unitPrice, gstRateBps: l.gstRate })),
    watchedDiscount ?? 0,
  );

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

  const reviseMutation = useMutation({
    mutationFn: (values: EditInvoiceLineItemsInput) => api.patch(`/invoices/${id}/revise`, values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices', id] });
      queryClient.invalidateQueries({ queryKey: ['audit-log'] });
      toast.success('Invoice revised');
      router.push(`/invoices/${id}`);
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Failed to revise invoice'),
  });

  if (isLoading || !invoice) {
    return <p className="text-muted-foreground text-sm">Loading…</p>;
  }

  return (
    <div className="flex flex-col gap-6">
      <Breadcrumb
        items={[
          { label: 'Invoices', href: '/invoices' },
          { label: invoice.invoiceNumber ?? 'Invoice', href: `/invoices/${id}` },
          { label: 'Revise' },
        ]}
      />
      <Card className="max-w-3xl w-full mx-auto">
        <CardHeader>
          <CardTitle>Revise invoice {invoice.invoiceNumber}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={form.handleSubmit((values) => reviseMutation.mutate(values))} className="flex flex-col gap-3">
            <p className="text-xs text-muted-foreground">
              This corrects the already-issued invoice&apos;s recorded amounts and is logged to the audit trail — it
              doesn&apos;t change the invoice number.
            </p>
            <BarcodeScanInput onFound={applyScannedItem} />
            {fields.map((field, index) => {
              const selectedItem = inventory?.find((i) => i.id === watchedLines[index]?.inventoryItemId);
              return (
              <div key={field.id} className="grid grid-cols-[140px_1fr_60px_100px_90px_auto] gap-2 items-end">
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
                      <SelectValue placeholder="From stock…" />
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
                  {selectedItem?.saleUnit && (
                    <p className="text-[10px] text-muted-foreground">{selectedItem.saleUnit}</p>
                  )}
                </div>
                <div className="flex flex-col gap-1">
                  {index === 0 && <Label className="text-xs">Price (₹)</Label>}
                  <Input
                    type="number"
                    step="0.01"
                    aria-label={`Line ${index + 1} unit price`}
                    onChange={(e) => form.setValue(`lineItems.${index}.unitPrice`, rupeesToPaise(Number(e.target.value)))}
                    defaultValue={watchedLines[index]?.unitPrice ? watchedLines[index].unitPrice / 100 : 0}
                  />
                </div>
                <div className="flex flex-col gap-1">
                  {index === 0 && <Label className="text-xs">GST %</Label>}
                  <Input
                    type="number"
                    step="0.01"
                    aria-label={`Line ${index + 1} GST rate`}
                    onChange={(e) => form.setValue(`lineItems.${index}.gstRate`, Math.round(Number(e.target.value) * 100))}
                    defaultValue={bpsToPercent(watchedLines[index]?.gstRate ?? 1800)}
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

            <FormField label="Discount (₹)" className="flex flex-col gap-1.5 max-w-xs">
              <Input
                type="number"
                step="0.01"
                onChange={(e) => form.setValue('discount', rupeesToPaise(Number(e.target.value)))}
                defaultValue={invoice.discount / 100}
              />
            </FormField>

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
              <Button type="submit" disabled={reviseMutation.isPending}>
                {reviseMutation.isPending ? 'Saving…' : 'Save revision'}
              </Button>
              <Button type="button" variant="ghost" onClick={() => router.push(`/invoices/${id}`)}>
                Cancel
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
