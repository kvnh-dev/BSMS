'use client';

import Link from 'next/link';
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
  type SaleOrderInput,
} from '@bsms/shared';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FormField } from '@/components/form-field';
import { Breadcrumb } from '@/components/breadcrumb';
import { StatusBadge } from '@/components/status-badge';
import { BarcodeScanInput, type ScannedInventoryItem } from '@/components/barcode-scan-input';
import { useRegisterQuickCreateTarget } from '@/lib/quick-create-context';
import { usePageUpDownNavigation } from '@/lib/use-record-navigation';
import { api, ApiError } from '@/lib/api-client';

interface SaleOrderLineItem {
  id: string;
  inventoryItemId: string | null;
  description: string;
  qty: number;
  unitPrice: number;
  gstRate: number;
}

interface SaleOrderDetail {
  id: string;
  status: string;
  discount: number;
  total: number;
  createdAt: string;
  customer: { id: string; name: string; phone: string };
  lineItems: SaleOrderLineItem[];
  invoice: { id: string; invoiceNumber: string | null } | null;
}

interface InventoryItem {
  id: string;
  name: string;
  unitPrice: number;
  gstRate: number;
  saleUnit: string | null;
}

export default function SaleOrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const quickCreate = useRegisterQuickCreateTarget();

  const { data: order, isLoading } = useQuery({
    queryKey: ['sale-orders', id],
    queryFn: () => api.get<SaleOrderDetail>(`/sale-orders/${id}`),
  });

  const { data: saleOrderList } = useQuery({
    queryKey: ['sale-orders'],
    queryFn: () => api.get<{ id: string }[]>('/sale-orders'),
  });
  usePageUpDownNavigation(saleOrderList, id, (o) => `/sale-orders/${o.id}`);

  const { data: inventory } = useQuery({
    queryKey: ['inventory'],
    queryFn: () => api.get<InventoryItem[]>('/inventory'),
    enabled: order?.status === 'OPEN',
  });
  const inventoryItemLabels = Object.fromEntries((inventory ?? []).map((i): [string, string] => [i.id, i.name]));

  const form = useForm<SaleOrderInput>({
    values: order
      ? {
          customerId: order.customer.id,
          discount: order.discount,
          lineItems: order.lineItems.map((l) => ({
            inventoryItemId: l.inventoryItemId ?? undefined,
            description: l.description,
            qty: l.qty,
            unitPrice: l.unitPrice,
            gstRate: l.gstRate,
          })),
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

  const saveMutation = useMutation({
    mutationFn: (values: SaleOrderInput) => api.patch(`/sale-orders/${id}`, values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sale-orders', id] });
      toast.success('Sale order saved');
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Failed to save'),
  });

  const cancelMutation = useMutation({
    mutationFn: () => api.post(`/sale-orders/${id}/cancel`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sale-orders', id] });
      queryClient.invalidateQueries({ queryKey: ['sale-orders'] });
      toast.success('Sale order cancelled');
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Failed to cancel'),
  });

  const convertMutation = useMutation({
    mutationFn: () => api.post<{ id: string }>(`/sale-orders/${id}/convert`),
    onSuccess: (invoice) => {
      queryClient.invalidateQueries({ queryKey: ['sale-orders', id] });
      queryClient.invalidateQueries({ queryKey: ['sale-orders'] });
      toast.success('Converted to draft invoice');
      router.push(`/invoices/${invoice.id}`);
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Failed to convert'),
  });

  if (isLoading || !order) {
    return <p className="text-muted-foreground text-sm">Loading…</p>;
  }

  return (
    <div className="flex flex-col gap-6">
      <Breadcrumb items={[{ label: 'Sale Orders', href: '/sale-orders' }, { label: order.customer.name }]} />

      <Card className="max-w-2xl w-full mx-auto">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>{order.customer.name}</CardTitle>
          <StatusBadge status={order.status} />
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <p className="text-sm text-muted-foreground">{order.customer.phone}</p>

          {order.status === 'CONVERTED' && order.invoice && (
            <p className="text-sm">
              Converted to invoice{' '}
              <Link href={`/invoices/${order.invoice.id}`} className="underline hover:text-foreground">
                {order.invoice.invoiceNumber ?? 'Draft'}
              </Link>
            </p>
          )}

          {order.status === 'OPEN' ? (
            <form
              onSubmit={form.handleSubmit((values) => saveMutation.mutate(values))}
              className="flex flex-col gap-3 border-t pt-3"
            >
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
                  defaultValue={order.discount / 100}
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

              <div className="flex flex-wrap gap-2">
                <Button type="submit" variant="outline" disabled={saveMutation.isPending}>
                  {saveMutation.isPending ? 'Saving…' : 'Save changes'}
                </Button>
                <Button
                  type="button"
                  onClick={() => convertMutation.mutate()}
                  disabled={convertMutation.isPending}
                >
                  {convertMutation.isPending ? 'Converting…' : 'Convert to invoice'}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="text-destructive hover:text-destructive"
                  onClick={() => cancelMutation.mutate()}
                  disabled={cancelMutation.isPending}
                >
                  Cancel order
                </Button>
              </div>
            </form>
          ) : (
            <div className="flex flex-col gap-1 text-sm border-t pt-3">
              {order.lineItems.map((line) => (
                <div key={line.id} className="flex justify-between">
                  <span>
                    {line.description} × {line.qty} ({bpsToPercent(line.gstRate)}% GST)
                  </span>
                  <span>{formatPaiseAsInr(line.qty * line.unitPrice)}</span>
                </div>
              ))}
              <div className="flex justify-between text-foreground font-medium border-t pt-2 mt-1">
                <span>Total</span>
                <span>{formatPaiseAsInr(order.total)}</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
