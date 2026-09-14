'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useForm, useFieldArray } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  formatPaiseAsInr,
  rupeesToPaise,
  bpsToPercent,
  amountInWordsInr,
  calcGstBreakup,
  calcInvoiceTotal,
  lineItemTaxableValue,
  lineItemGstAmount,
  type EditInvoiceLineItemsInput,
} from '@bsms/shared';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { FormField } from '@/components/form-field';
import { StatusBadge } from '@/components/status-badge';
import { PrintIcon } from '@/components/nav-icons';
import { Breadcrumb } from '@/components/breadcrumb';
import { BarcodeScanInput, type ScannedInventoryItem } from '@/components/barcode-scan-input';
import { RecordPaymentSheet } from '@/components/record-payment-sheet';
import { api, ApiError } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { useRegisterQuickCreateTarget } from '@/lib/quick-create-context';
import { usePageUpDownNavigation } from '@/lib/use-record-navigation';

interface InvoiceLineItem {
  id: string;
  inventoryItemId: string | null;
  description: string;
  qty: number;
  unitPrice: number;
  gstRate: number;
  inventoryItem: { hsnCode: string } | null;
}

interface SellerSnapshot {
  name: string;
  address: string;
  gstin: string;
  pan: string;
  state: string;
  contactNumber: string;
}

interface InvoiceDetail {
  id: string;
  invoiceNumber: string | null;
  status: string;
  ticketId: string | null;
  createdAt: string;
  customer: { name: string; phone: string; address: string | null };
  lineItems: InvoiceLineItem[];
  gstBreakup: { cgstPaise: number; sgstPaise: number; igstPaise: number };
  sellerSnapshot: SellerSnapshot | null;
  discount: number;
  total: number;
  paidAmount: number;
  balanceDue: number;
}

interface Payment {
  id: string;
  amount: number;
  mode: string;
  reference: string | null;
  voided: boolean;
  voidedReason: string | null;
  createdAt: string;
  recordedBy: { name: string };
}

interface InventoryItem {
  id: string;
  name: string;
  unitPrice: number;
  gstRate: number;
  saleUnit: string | null;
}

export default function InvoiceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { hasPersona } = useAuth();
  const isOwner = hasPersona('OWNER');
  const queryClient = useQueryClient();

  const { data: invoice, isLoading } = useQuery({
    queryKey: ['invoices', id],
    queryFn: () => api.get<InvoiceDetail>(`/invoices/${id}`),
  });

  const { data: invoiceList } = useQuery({
    queryKey: ['invoices'],
    queryFn: () => api.get<{ id: string }[]>('/invoices'),
  });
  usePageUpDownNavigation(invoiceList, id, (inv) => `/invoices/${inv.id}`);

  const finalizeMutation = useMutation({
    mutationFn: () => api.post(`/invoices/${id}/finalize`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices', id] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['service-tickets'] });
      toast.success('Invoice finalized');
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Failed to finalize'),
  });

  if (isLoading || !invoice) {
    return <p className="text-muted-foreground text-sm">Loading…</p>;
  }

  if (invoice.status === 'DRAFT') {
    return (
      <DraftView
        invoice={invoice}
        onFinalize={() => finalizeMutation.mutate()}
        finalizing={finalizeMutation.isPending}
      />
    );
  }

  return <FinalView invoice={invoice} isOwner={isOwner} />;
}

function DraftView({
  invoice,
  onFinalize,
  finalizing,
}: {
  invoice: InvoiceDetail;
  onFinalize: () => void;
  finalizing: boolean;
}) {
  const queryClient = useQueryClient();
  const isTicketBased = !!invoice.ticketId;
  const quickCreate = useRegisterQuickCreateTarget();

  const { data: inventory } = useQuery({
    queryKey: ['inventory'],
    queryFn: () => api.get<InventoryItem[]>('/inventory'),
    enabled: !isTicketBased,
  });
  const inventoryItemLabels = Object.fromEntries((inventory ?? []).map((i): [string, string] => [i.id, i.name]));

  const form = useForm<EditInvoiceLineItemsInput>({
    defaultValues: {
      lineItems: invoice.lineItems.map((l) => ({
        inventoryItemId: l.inventoryItemId ?? undefined,
        description: l.description,
        qty: l.qty,
        unitPrice: l.unitPrice,
        gstRate: l.gstRate,
      })),
      discount: invoice.discount,
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
    mutationFn: (values: EditInvoiceLineItemsInput) => api.patch(`/invoices/${invoice.id}/draft`, values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices', invoice.id] });
      toast.success('Draft saved');
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Failed to save draft'),
  });

  return (
    <div className="flex flex-col gap-6">
      <Breadcrumb items={[{ label: 'Invoices', href: '/invoices' }, { label: 'Draft' }]} />

      <Card className="max-w-3xl w-full mx-auto">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Draft invoice</CardTitle>
          <StatusBadge status="DRAFT" />
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="text-sm text-muted-foreground">
            <p className="text-foreground font-medium">{invoice.customer.name}</p>
            <p>{invoice.customer.phone}</p>
          </div>

          {isTicketBased ? (
            <div className="flex flex-col gap-1 text-sm border-t pt-3">
              <p className="text-xs text-muted-foreground mb-1">
                Derived from the ticket&apos;s recorded parts/charges — refreshed automatically when finalized, so
                it&apos;s not edited here directly.
              </p>
              {invoice.lineItems.map((line) => (
                <div key={line.id} className="flex justify-between">
                  <span>
                    {line.description} × {line.qty} ({bpsToPercent(line.gstRate)}% GST)
                  </span>
                  <span>{formatPaiseAsInr(line.qty * line.unitPrice)}</span>
                </div>
              ))}
              <div className="flex justify-between text-foreground font-medium border-t pt-2 mt-1">
                <span>Total</span>
                <span>{formatPaiseAsInr(invoice.total)}</span>
              </div>
            </div>
          ) : (
            <form
              onSubmit={form.handleSubmit((values) => saveMutation.mutate(values))}
              className="flex flex-col gap-3 border-t pt-3"
            >
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

              <Button type="submit" variant="outline" className="self-start" disabled={saveMutation.isPending}>
                {saveMutation.isPending ? 'Saving…' : 'Save changes'}
              </Button>
            </form>
          )}

          <Button onClick={onFinalize} disabled={finalizing} className="self-start">
            {finalizing ? 'Finalizing…' : 'Finalize invoice'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function FinalView({ invoice, isOwner }: { invoice: InvoiceDetail; isOwner: boolean }) {
  const seller = invoice.sellerSnapshot!;
  const queryClient = useQueryClient();
  const [paymentSheetOpen, setPaymentSheetOpen] = useState(false);
  const [voidTarget, setVoidTarget] = useState<Payment | null>(null);
  const [voidReason, setVoidReason] = useState('');
  const taxable = invoice.lineItems.reduce(
    (sum, l) => sum + lineItemTaxableValue({ qty: l.qty, unitPricePaise: l.unitPrice, gstRateBps: l.gstRate }),
    0,
  );

  const { data: payments } = useQuery({
    queryKey: ['invoices', invoice.id, 'payments'],
    queryFn: () => api.get<Payment[]>(`/invoices/${invoice.id}/payments`),
  });

  const voidMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      api.patch(`/payments/${id}/void`, { reason }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices', invoice.id] });
      queryClient.invalidateQueries({ queryKey: ['invoices', invoice.id, 'payments'] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      toast.success('Payment voided');
      setVoidTarget(null);
      setVoidReason('');
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Failed to void payment'),
  });

  const balanceLabel = invoice.balanceDue <= 0 ? 'Paid in full' : formatPaiseAsInr(invoice.balanceDue);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between print:hidden">
        <Breadcrumb items={[{ label: 'Invoices', href: '/invoices' }, { label: invoice.invoiceNumber! }]} />
        <div className="flex gap-2">
          {isOwner && (
            <Link href={`/invoices/${invoice.id}/revise`}>
              <Button variant="outline" size="sm">
                Revise
              </Button>
            </Link>
          )}
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            <PrintIcon className="h-4 w-4" />
            Print
          </Button>
        </div>
      </div>

      <Card className="max-w-3xl w-full mx-auto print:hidden">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Payments</CardTitle>
          <div className="flex items-center gap-3">
            <span
              className={
                invoice.balanceDue <= 0 ? 'text-success font-semibold text-sm' : 'text-destructive font-semibold text-sm'
              }
            >
              Balance due: {balanceLabel}
            </span>
            {invoice.balanceDue > 0 && (
              <Button size="sm" onClick={() => setPaymentSheetOpen(true)}>
                Record payment
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {payments && payments.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Mode</TableHead>
                  <TableHead>Reference</TableHead>
                  <TableHead>Recorded by</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  {isOwner && <TableHead className="text-right">Action</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments.map((p) => (
                  <TableRow key={p.id} className={p.voided ? 'opacity-50' : undefined}>
                    <TableCell>{new Date(p.createdAt).toLocaleDateString()}</TableCell>
                    <TableCell>{p.mode.replace('_', ' ')}</TableCell>
                    <TableCell>{p.reference ?? '—'}</TableCell>
                    <TableCell>{p.recordedBy.name}</TableCell>
                    <TableCell className="text-right">
                      {formatPaiseAsInr(p.amount)}
                      {p.voided && <span className="ml-1.5 text-xs text-destructive">(voided)</span>}
                    </TableCell>
                    {isOwner && (
                      <TableCell className="text-right">
                        {!p.voided && (
                          <Button variant="ghost" size="sm" onClick={() => setVoidTarget(p)}>
                            Void
                          </Button>
                        )}
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-sm text-muted-foreground">No payments recorded yet.</p>
          )}
        </CardContent>
      </Card>

      <RecordPaymentSheet
        open={paymentSheetOpen}
        onOpenChange={setPaymentSheetOpen}
        invoiceId={invoice.id}
        balanceDue={invoice.balanceDue}
      />

      <Dialog open={!!voidTarget} onOpenChange={(open) => !open && setVoidTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Void payment</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <p className="text-sm text-muted-foreground">
              This marks the {voidTarget && formatPaiseAsInr(voidTarget.amount)} payment as voided and restores it to
              the balance due. It&apos;s logged to the audit trail and can&apos;t be undone.
            </p>
            <FormField label="Reason">
              <Input value={voidReason} onChange={(e) => setVoidReason(e.target.value)} placeholder="e.g. Recorded in error" />
            </FormField>
            <DialogFooter>
              <Button
                variant="destructive"
                disabled={!voidReason || voidMutation.isPending}
                onClick={() => voidTarget && voidMutation.mutate({ id: voidTarget.id, reason: voidReason })}
              >
                {voidMutation.isPending ? 'Voiding…' : 'Void payment'}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      <div className="mx-auto w-full max-w-3xl bg-card text-card-foreground ring-1 ring-foreground/10 rounded-xl p-8 text-sm print:max-w-none print:rounded-none print:ring-0 print:p-0">
        <div className="text-center border-b-2 border-foreground/80 pb-3 mb-3">
          <p className="text-xs font-bold tracking-[0.2em] uppercase text-muted-foreground">Tax Invoice</p>
          <h1 className="text-xl font-bold mt-1">{seller.name}</h1>
          <p className="text-xs text-muted-foreground mt-1">
            {seller.address}, {seller.state}
            <br />
            GSTIN {seller.gstin} &nbsp;·&nbsp; PAN {seller.pan} &nbsp;·&nbsp; Ph {seller.contactNumber}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4 border-b border-foreground/15 pb-3 mb-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground mb-1">Billed to</p>
            <p className="font-medium">{invoice.customer.name}</p>
            <p className="text-muted-foreground">{invoice.customer.phone}</p>
            {invoice.customer.address && <p className="text-muted-foreground">{invoice.customer.address}</p>}
          </div>
          <div className="text-right">
            <p>
              <span className="text-muted-foreground">Invoice No: </span>
              <span className="font-medium">{invoice.invoiceNumber}</span>
            </p>
            <p>
              <span className="text-muted-foreground">Invoice Date: </span>
              <span className="font-medium">
                {new Date(invoice.createdAt).toLocaleDateString('en-IN', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric',
                })}
              </span>
            </p>
          </div>
        </div>

        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="border-y border-foreground/30 text-[10px] uppercase tracking-wide text-muted-foreground">
              <th className="text-left py-1.5 pr-2 font-bold">#</th>
              <th className="text-left py-1.5 pr-2 font-bold">Description</th>
              <th className="text-left py-1.5 pr-2 font-bold">HSN/SAC</th>
              <th className="text-right py-1.5 pr-2 font-bold">Qty</th>
              <th className="text-right py-1.5 pr-2 font-bold">Rate</th>
              <th className="text-right py-1.5 pr-2 font-bold">Taxable</th>
              <th className="text-right py-1.5 pr-2 font-bold">CGST</th>
              <th className="text-right py-1.5 pr-2 font-bold">SGST</th>
              <th className="text-right py-1.5 font-bold">Amount</th>
            </tr>
          </thead>
          <tbody>
            {invoice.lineItems.map((line, i) => {
              const line$ = { qty: line.qty, unitPricePaise: line.unitPrice, gstRateBps: line.gstRate };
              const lineTaxable = lineItemTaxableValue(line$);
              const lineGst = lineItemGstAmount(line$);
              const lineTotal = lineTaxable + lineGst;
              return (
                <tr key={line.id} className="border-b border-foreground/10">
                  <td className="py-1.5 pr-2 align-top text-muted-foreground">{i + 1}</td>
                  <td className="py-1.5 pr-2 align-top">{line.description}</td>
                  <td className="py-1.5 pr-2 align-top text-muted-foreground">{line.inventoryItem?.hsnCode ?? '—'}</td>
                  <td className="py-1.5 pr-2 align-top text-right">{line.qty}</td>
                  <td className="py-1.5 pr-2 align-top text-right">{formatPaiseAsInr(line.unitPrice)}</td>
                  <td className="py-1.5 pr-2 align-top text-right">{formatPaiseAsInr(lineTaxable)}</td>
                  <td className="py-1.5 pr-2 align-top text-right text-muted-foreground">
                    {bpsToPercent(line.gstRate) / 2}%<br />
                    {formatPaiseAsInr(Math.round(lineGst / 2))}
                  </td>
                  <td className="py-1.5 pr-2 align-top text-right text-muted-foreground">
                    {bpsToPercent(line.gstRate) / 2}%<br />
                    {formatPaiseAsInr(lineGst - Math.round(lineGst / 2))}
                  </td>
                  <td className="py-1.5 align-top text-right font-medium">{formatPaiseAsInr(lineTotal)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <div className="flex justify-end mt-3">
          <div className="w-64 flex flex-col gap-1">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Taxable value</span>
              <span>{formatPaiseAsInr(taxable)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">CGST</span>
              <span>{formatPaiseAsInr(invoice.gstBreakup.cgstPaise)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">SGST</span>
              <span>{formatPaiseAsInr(invoice.gstBreakup.sgstPaise)}</span>
            </div>
            {invoice.discount > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Discount</span>
                <span>-{formatPaiseAsInr(invoice.discount)}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-base border-t border-foreground/30 pt-1.5 mt-1">
              <span>Total</span>
              <span>{formatPaiseAsInr(invoice.total)}</span>
            </div>
          </div>
        </div>

        <p className="text-xs mt-3 pt-3 border-t border-foreground/15">
          <span className="text-muted-foreground">Amount in words: </span>
          <span className="font-medium">{amountInWordsInr(invoice.total)}</span>
        </p>

        <div className="flex justify-between items-end mt-10 pt-3 border-t border-foreground/15 text-xs text-muted-foreground">
          <p>This is a computer-generated invoice and does not require a physical signature.</p>
          <div className="text-center">
            <p className="mb-8">For {seller.name}</p>
            <p className="border-t border-foreground/30 pt-1">Authorized Signatory</p>
          </div>
        </div>
      </div>
    </div>
  );
}
