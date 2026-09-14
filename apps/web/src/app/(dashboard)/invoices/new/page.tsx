'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm, useFieldArray } from 'react-hook-form';
import { useMutation, useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { formatPaiseAsInr, rupeesToPaise, bpsToPercent, type CreateInvoiceInput } from '@bsms/shared';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FormField } from '@/components/form-field';
import { Breadcrumb } from '@/components/breadcrumb';
import { QuickAdjustStockSheet } from '@/components/quick-adjust-stock-sheet';
import { BarcodeScanInput, type ScannedInventoryItem } from '@/components/barcode-scan-input';
import { useRegisterQuickCreateTarget } from '@/lib/quick-create-context';
import { useVoucherDrafts } from '@/lib/voucher-drafts-context';
import { api, ApiError } from '@/lib/api-client';

interface Invoice {
  id: string;
}

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

interface BillableTicket {
  id: string;
  complaint: string;
  bike: { regNo: string; customer: { name: string } };
}

interface TicketWithWork {
  id: string;
  partsUsed: { id: string; qty: number; priceAtUse: number; inventoryItem: { name: string } }[];
  serviceCharges: { id: string; description: string; amount: number; gstRate: number }[];
}

interface InvoiceDraftData {
  mode: 'ticket' | 'standalone';
  selectedTicketId: string;
  customerId: string;
  lineItems: CreateInvoiceInput['lineItems'];
  discount: number;
}

function isDraftMeaningful(mode: 'ticket' | 'standalone', selectedTicketId: string, values: CreateInvoiceInput): boolean {
  if (mode === 'ticket') return !!selectedTicketId;
  return !!values.customerId || (values.lineItems ?? []).some((l) => l.description.trim() !== '');
}

export default function NewInvoicePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { drafts, getDraft, upsertDraft, removeDraft } = useVoucherDrafts();

  const [draftId] = useState<string>(() => {
    const param = searchParams.get('draft');
    if (param) return param;
    const existing = drafts.find((d) => d.type === 'invoice');
    return existing ? existing.id : crypto.randomUUID();
  });
  const existingDraft = getDraft(draftId)?.data as InvoiceDraftData | undefined;
  // Arriving from a service ticket's own context (e.g. F8 pressed while
  // viewing that ticket) — pre-select it for billing. An existing draft's
  // own ticket always wins over this, so it never clobbers a resumed draft.
  const ticketIdParam = !existingDraft?.selectedTicketId ? searchParams.get('ticketId') : null;

  const [mode, setMode] = useState<'ticket' | 'standalone'>(existingDraft?.mode ?? 'ticket');
  const [selectedTicketId, setSelectedTicketId] = useState(existingDraft?.selectedTicketId ?? ticketIdParam ?? '');
  const quickCreate = useRegisterQuickCreateTarget();

  const { data: customers } = useQuery({
    queryKey: ['customers'],
    queryFn: () => api.get<Customer[]>('/customers'),
    enabled: mode === 'standalone',
  });

  const { data: inventory } = useQuery({
    queryKey: ['inventory'],
    queryFn: () => api.get<InventoryItem[]>('/inventory'),
    enabled: mode === 'standalone',
  });

  const { data: billableTickets } = useQuery({
    queryKey: ['service-tickets', 'IN_SERVICE'],
    queryFn: () => api.get<BillableTicket[]>('/service-tickets?status=IN_SERVICE'),
    enabled: mode === 'ticket',
  });

  const { data: selectedTicket, isLoading: ticketLoading } = useQuery({
    queryKey: ['service-tickets', selectedTicketId],
    queryFn: () => api.get<TicketWithWork>(`/service-tickets/${selectedTicketId}`),
    enabled: !!selectedTicketId,
  });
  const hasBillableWork = !!selectedTicket && (selectedTicket.partsUsed.length > 0 || selectedTicket.serviceCharges.length > 0);

  const billableTicketLabels = Object.fromEntries(
    (billableTickets ?? []).map((t) => [t.id, `${t.bike.regNo} — ${t.bike.customer.name} (${t.complaint})`]),
  );
  const customerLabels = Object.fromEntries((customers ?? []).map((c) => [c.id, `${c.name} (${c.phone})`]));
  const inventoryItemLabels = Object.fromEntries((inventory ?? []).map((i) => [i.id, i.name]));

  const form = useForm<CreateInvoiceInput>({
    defaultValues: existingDraft
      ? { customerId: existingDraft.customerId, lineItems: existingDraft.lineItems, discount: existingDraft.discount }
      : {
          customerId: '',
          lineItems: [{ description: '', qty: 1, unitPrice: 0, gstRate: 1800 }],
          discount: 0,
        },
  });
  const { fields, append, remove } = useFieldArray({ control: form.control, name: 'lineItems' });
  const watchedLines = form.watch('lineItems');

  // Pushes mode/ticket-selection/standalone-form changes into the voucher-
  // drafts store as a side-channel, so this in-progress invoice survives an
  // Alt+G detour (or any navigation away) and back — see voucher-drafts-
  // context.tsx. Only one invoice draft exists at a time from this page.
  useEffect(() => {
    function sync() {
      const values = form.getValues();
      if (!isDraftMeaningful(mode, selectedTicketId, values)) return;
      const label =
        mode === 'ticket'
          ? (() => {
              const ticket = billableTickets?.find((t) => t.id === selectedTicketId);
              return ticket ? `Invoice — ${ticket.bike.regNo}` : 'New invoice';
            })()
          : (() => {
              const customer = customers?.find((c) => c.id === values.customerId);
              return customer ? `Invoice — ${customer.name}` : 'New invoice';
            })();
      upsertDraft(draftId, 'invoice', label, { mode, selectedTicketId, ...values });
    }
    sync();
    const subscription = form.watch(() => sync());
    return () => subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form, mode, selectedTicketId, customers, billableTickets, draftId]);

  const createMutation = useMutation({
    mutationFn: (input: CreateInvoiceInput) => api.post<Invoice>('/invoices', input),
    onSuccess: (invoice) => {
      toast.success('Draft created — review and finalize it to issue the invoice');
      removeDraft(draftId);
      router.push(`/invoices/${invoice.id}`);
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Failed to create invoice'),
  });

  function billSelectedTicket() {
    if (!selectedTicket || !hasBillableWork) return;
    createMutation.mutate({ ticketId: selectedTicket.id, discount: 0 });
  }

  function applyItemToLine(index: number, itemId: string) {
    const item = inventory?.find((i) => i.id === itemId);
    if (!item) return;
    form.setValue(`lineItems.${index}.inventoryItemId`, item.id);
    form.setValue(`lineItems.${index}.description`, item.name);
    form.setValue(`lineItems.${index}.unitPrice`, item.unitPrice);
    form.setValue(`lineItems.${index}.gstRate`, item.gstRate);
  }

  // Fills the last line if it's still blank, otherwise appends a new one —
  // a scan should never silently overwrite a line the cashier already typed.
  function applyScannedItem(scanned: ScannedInventoryItem) {
    const lines = form.getValues('lineItems') ?? [];
    const last = lines[lines.length - 1];
    if (last && !last.description && !last.inventoryItemId) {
      applyItemToLine(lines.length - 1, scanned.id);
    } else {
      append({ description: '', qty: 1, unitPrice: 0, gstRate: scanned.gstRate });
      applyItemToLine(lines.length, scanned.id);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <Breadcrumb items={[{ label: 'Invoices', href: '/invoices' }, { label: 'New invoice' }]} />
      <Card className="max-w-2xl w-full mx-auto">
        <CardHeader>
          <CardTitle>New invoice</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-1 rounded-lg border p-1 mb-3">
            <Button
              type="button"
              variant={mode === 'ticket' ? 'default' : 'ghost'}
              size="sm"
              className="flex-1"
              onClick={() => setMode('ticket')}
            >
              Bill a service
            </Button>
            <Button
              type="button"
              variant={mode === 'standalone' ? 'default' : 'ghost'}
              size="sm"
              className="flex-1"
              onClick={() => setMode('standalone')}
            >
              Standalone sale
            </Button>
          </div>

          {mode === 'ticket' ? (
            <div className="flex flex-col gap-3">
              <FormField
                label="Ticket"
                htmlFor="bill-ticket-select"
                hint="Only tickets In Service can be billed. The invoice is built from the parts and charges recorded during service — not the estimate."
              >
                <Select
                  items={billableTicketLabels}
                  value={selectedTicketId}
                  onValueChange={(v) => setSelectedTicketId(v ?? '')}
                >
                  <SelectTrigger id="bill-ticket-select" autoFocus>
                    <SelectValue placeholder="Select a ticket to bill" />
                  </SelectTrigger>
                  <SelectContent>
                    {billableTickets?.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.bike.regNo} — {t.bike.customer.name} ({t.complaint})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>

              {selectedTicketId && ticketLoading && (
                <p className="text-sm text-muted-foreground">Loading recorded work…</p>
              )}

              {selectedTicketId && !ticketLoading && !hasBillableWork && (
                <p className="text-sm text-destructive">
                  No parts or charges recorded on this ticket yet — add them on the ticket first.
                </p>
              )}

              {selectedTicket && hasBillableWork && (
                <Card>
                  <CardContent className="pt-4 flex flex-col gap-1.5 text-sm">
                    {selectedTicket.partsUsed.map((part) => (
                      <div key={part.id} className="flex justify-between">
                        <span>
                          {part.inventoryItem.name} × {part.qty}
                        </span>
                        <span className="font-medium">{formatPaiseAsInr(part.qty * part.priceAtUse)}</span>
                      </div>
                    ))}
                    {selectedTicket.serviceCharges.map((charge) => (
                      <div key={charge.id} className="flex justify-between">
                        <span>
                          {charge.description} ({bpsToPercent(charge.gstRate)}% GST)
                        </span>
                        <span className="font-medium">{formatPaiseAsInr(charge.amount)}</span>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}

              <div className="flex gap-2">
                <Button onClick={billSelectedTicket} disabled={!hasBillableWork || createMutation.isPending}>
                  {createMutation.isPending ? 'Creating…' : 'Create invoice'}
                </Button>
                <Button type="button" variant="ghost" onClick={() => router.push('/invoices')}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <form onSubmit={form.handleSubmit((v) => createMutation.mutate(v))} className="flex flex-col gap-3">
              <FormField label="Customer" htmlFor="invoice-customer-select">
                <Select
                  items={customerLabels}
                  value={form.watch('customerId')}
                  onValueChange={(v: string | null) => form.setValue('customerId', v ?? '')}
                >
                  <SelectTrigger
                    id="invoice-customer-select"
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
                const selectedItem = inventory?.find((i) => i.id === watchedLines?.[index]?.inventoryItemId);
                return (
                <div key={field.id} className="grid grid-cols-[1fr_1fr_60px_90px_auto] gap-2 items-end">
                  <div className="flex flex-col gap-1">
                    {index === 0 && <Label className="text-xs">Item</Label>}
                    <Select
                      items={inventoryItemLabels}
                      value={watchedLines?.[index]?.inventoryItemId ?? ''}
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
                      defaultValue={watchedLines?.[index]?.unitPrice ? watchedLines[index].unitPrice / 100 : 0}
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

              <div className="flex gap-2">
                <Button type="submit" disabled={createMutation.isPending}>
                  {createMutation.isPending ? 'Creating…' : 'Create invoice'}
                </Button>
                <Button type="button" variant="ghost" onClick={() => router.push('/invoices')}>
                  Cancel
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
