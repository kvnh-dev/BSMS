'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm, useFieldArray } from 'react-hook-form';
import { useMutation, useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  formatPaiseAsInr,
  rupeesToPaise,
  bpsToPercent,
  calcGstBreakup,
  calcInvoiceTotal,
  type CreateEstimateInput,
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
import { useVoucherDrafts } from '@/lib/voucher-drafts-context';
import { api, ApiError } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';

interface WorkerUser {
  id: string;
  name: string;
  personas: string[];
}

interface BikeSearchResult {
  id: string;
  regNo: string;
  model: string;
  customer: { name: string };
}

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

interface ServiceTicketDraftData {
  bikeQuery: string;
  selectedBikeId: string | null;
  complaint: string;
  technicianId: string | null;
  estimate: CreateEstimateInput;
}

export default function NewServiceTicketPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { hasPersona } = useAuth();
  const canAssignTechnician = hasPersona('OWNER');
  const quickCreate = useRegisterQuickCreateTarget();
  const { drafts, getDraft, upsertDraft, removeDraft } = useVoucherDrafts();

  const [draftId] = useState<string>(() => {
    const param = searchParams.get('draft');
    if (param) return param;
    const existing = drafts.find((d) => d.type === 'service-ticket');
    return existing ? existing.id : crypto.randomUUID();
  });
  const existingDraft = getDraft(draftId)?.data as ServiceTicketDraftData | undefined;
  // Arriving from a bike's own "New service" action (bikes/[id]) — pre-select
  // that bike so the owner doesn't have to search for it again. An existing
  // draft's own bike (if any) always wins over this link.
  const bikeIdParam = !existingDraft?.selectedBikeId ? searchParams.get('bikeId') : null;

  const [bikeQuery, setBikeQuery] = useState(existingDraft?.bikeQuery ?? '');
  const [selectedBikeId, setSelectedBikeId] = useState<string | null>(existingDraft?.selectedBikeId ?? null);
  const [complaint, setComplaint] = useState(existingDraft?.complaint ?? '');
  const [technicianId, setTechnicianId] = useState<string | null>(existingDraft?.technicianId ?? null);

  const { data: workers } = useQuery({
    queryKey: ['users'],
    queryFn: () => api.get<WorkerUser[]>('/users'),
    enabled: canAssignTechnician,
  });
  const technicians = workers?.filter((w) => w.personas.includes('TECHNICIAN')) ?? [];
  const technicianLabels = Object.fromEntries(technicians.map((t): [string, string] => [t.id, t.name]));

  const { data: bikeResults } = useQuery({
    queryKey: ['bikes-search', bikeQuery],
    queryFn: () => api.get<BikeSearchResult[]>(`/bikes/search?q=${encodeURIComponent(bikeQuery)}`),
    enabled: bikeQuery.length > 1,
  });

  const { data: prefilledBike } = useQuery({
    queryKey: ['bikes', bikeIdParam],
    queryFn: () => api.get<{ id: string; regNo: string; model: string }>(`/bikes/${bikeIdParam}`),
    enabled: !!bikeIdParam,
  });

  useEffect(() => {
    if (prefilledBike && !selectedBikeId) {
      setSelectedBikeId(prefilledBike.id);
      setBikeQuery(`${prefilledBike.regNo} — ${prefilledBike.model}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefilledBike]);

  const { data: inventory } = useQuery({
    queryKey: ['inventory'],
    queryFn: () => api.get<InventoryItem[]>('/inventory'),
  });

  const { data: gstSlabs } = useQuery({
    queryKey: ['gst-slabs'],
    queryFn: () => api.get<GstSlab[]>('/gst-slabs'),
  });

  const estimateForm = useForm<CreateEstimateInput>({
    defaultValues: existingDraft?.estimate ?? {
      lineItems: [{ description: '', qty: 1, unitPricePaise: 0, gstRateBps: 1800 }],
      discount: 0,
    },
  });
  const { fields, append, remove } = useFieldArray({ control: estimateForm.control, name: 'lineItems' });
  const watchedLines = estimateForm.watch('lineItems');
  const watchedDiscount = estimateForm.watch('discount');
  const gstBreakup = calcGstBreakup(
    watchedLines.map((l) => ({ qty: l.qty, unitPricePaise: l.unitPricePaise, gstRateBps: l.gstRateBps })),
  );
  const total = calcInvoiceTotal(
    watchedLines.map((l) => ({ qty: l.qty, unitPricePaise: l.unitPricePaise, gstRateBps: l.gstRateBps })),
    watchedDiscount,
  );

  function applyItemToLine(index: number, itemId: string) {
    const item = inventory?.find((i) => i.id === itemId);
    if (!item) return;
    estimateForm.setValue(`lineItems.${index}.description`, item.name);
    estimateForm.setValue(`lineItems.${index}.unitPricePaise`, item.unitPrice);
    estimateForm.setValue(`lineItems.${index}.gstRateBps`, item.gstRate);
  }

  function applyScannedItem(scanned: ScannedInventoryItem) {
    const lines = estimateForm.getValues('lineItems');
    const last = lines[lines.length - 1];
    if (last && !last.description) {
      applyItemToLine(lines.length - 1, scanned.id);
    } else {
      append({ description: '', qty: 1, unitPricePaise: 0, gstRateBps: scanned.gstRate });
      applyItemToLine(lines.length, scanned.id);
    }
  }

  const inventoryItemLabels = Object.fromEntries((inventory ?? []).map((i) => [i.id, i.name]));
  const gstSlabLabels = Object.fromEntries((gstSlabs ?? []).map((s) => [String(s.rate), `${bpsToPercent(s.rate)}%`]));

  // Pushes every field this page tracks (plain useState + the separate
  // estimate form) into the voucher-drafts store as a side-channel, so this
  // in-progress intake survives an Alt+G detour and back — see
  // voucher-drafts-context.tsx.
  useEffect(() => {
    function sync() {
      if (!selectedBikeId && complaint.trim() === '') return;
      const label = selectedBikeId ? `Ticket — ${bikeQuery}` : 'New ticket';
      upsertDraft(draftId, 'service-ticket', label, {
        bikeQuery,
        selectedBikeId,
        complaint,
        technicianId,
        estimate: estimateForm.getValues(),
      });
    }
    sync();
    const subscription = estimateForm.watch(() => sync());
    return () => subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bikeQuery, selectedBikeId, complaint, technicianId, estimateForm, draftId]);

  const createMutation = useMutation({
    mutationFn: async () => {
      const ticket = await api.post<{ id: string }>('/service-tickets', {
        bikeId: selectedBikeId,
        complaint,
        technicianId: technicianId ?? undefined,
      });
      const lineItems = estimateForm.getValues('lineItems').filter((l) => l.description.trim() !== '');
      if (lineItems.length > 0) {
        await api.put(`/service-tickets/${ticket.id}/estimate`, {
          lineItems,
          discount: estimateForm.getValues('discount'),
        });
      }
      return ticket;
    },
    onSuccess: (ticket) => {
      removeDraft(draftId);
      toast.success('Ticket created');
      router.push(`/service-tickets/${ticket.id}`);
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Failed to create ticket'),
  });

  return (
    <div className="flex flex-col gap-6">
      <Breadcrumb items={[{ label: 'Services', href: '/service-tickets' }, { label: 'New service' }]} />
      <Card className="max-w-3xl w-full mx-auto">
        <CardHeader>
          <CardTitle>New service</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <FormField label="Search bike by reg. number or customer phone">
                <Input
                  value={bikeQuery}
                  onChange={(e) => {
                    setBikeQuery(e.target.value);
                    setSelectedBikeId(null);
                  }}
                  placeholder="e.g. KA01 or 9876543210"
                  autoFocus={!bikeIdParam}
                  onFocus={() =>
                    quickCreate.onFocus({
                      entity: 'bike',
                      onCreated: (bike) => {
                        setSelectedBikeId(bike.id);
                        setBikeQuery(`${bike.regNo} — ${bike.model}`);
                      },
                    })
                  }
                  onBlur={quickCreate.onBlur}
                />
              </FormField>
              {bikeResults && bikeResults.length > 0 && !selectedBikeId && (
                <div className="border rounded-md divide-y">
                  {bikeResults.map((bike) => (
                    <button
                      key={bike.id}
                      type="button"
                      onClick={() => {
                        setSelectedBikeId(bike.id);
                        setBikeQuery(`${bike.regNo} — ${bike.model} (${bike.customer.name})`);
                      }}
                      className="w-full text-left px-2 py-1.5 text-sm hover:bg-accent"
                    >
                      {bike.regNo} — {bike.model} ({bike.customer.name})
                    </button>
                  ))}
                </div>
              )}
            </div>
            <FormField label="Complaint">
              <Input
                value={complaint}
                onChange={(e) => setComplaint(e.target.value)}
                placeholder="Describe the issue"
                autoFocus={!!bikeIdParam}
              />
            </FormField>

            {canAssignTechnician && (
              <FormField label="Technician (optional)" htmlFor="new-ticket-technician-select">
                <Select items={technicianLabels} value={technicianId ?? ''} onValueChange={(v) => setTechnicianId(v || null)}>
                  <SelectTrigger
                    id="new-ticket-technician-select"
                    onFocus={() =>
                      quickCreate.onFocus({
                        entity: 'technician',
                        onCreated: (worker) => setTechnicianId(worker.id),
                      })
                    }
                    onBlur={quickCreate.onBlur}
                  >
                    <SelectValue placeholder="Assign later" />
                  </SelectTrigger>
                  <SelectContent>
                    {technicians.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>
            )}

            <div className="flex flex-col gap-2 border-t pt-3">
              <div>
                <Label className="text-sm font-medium">Estimate (optional)</Label>
                <p className="text-xs text-muted-foreground">
                  Quote for the customer — leave blank to add it later from the ticket.
                </p>
              </div>
              <BarcodeScanInput onFound={applyScannedItem} />
              {fields.map((field, index) => (
                <div key={field.id} className="grid grid-cols-[140px_1fr_60px_100px_90px_auto] gap-2 items-end">
                  <div className="flex flex-col gap-1">
                    {index === 0 && <Label className="text-xs">Item</Label>}
                    <Select
                      items={inventoryItemLabels}
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
                      {...estimateForm.register(`lineItems.${index}.description`)}
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    {index === 0 && <Label className="text-xs">Qty</Label>}
                    <Input
                      type="number"
                      min={1}
                      aria-label={`Line ${index + 1} quantity`}
                      {...estimateForm.register(`lineItems.${index}.qty`, { valueAsNumber: true })}
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    {index === 0 && <Label className="text-xs">Price (₹)</Label>}
                    <Input
                      type="number"
                      step="0.01"
                      aria-label={`Line ${index + 1} unit price`}
                      onChange={(e) =>
                        estimateForm.setValue(`lineItems.${index}.unitPricePaise`, rupeesToPaise(Number(e.target.value)))
                      }
                      defaultValue={watchedLines[index]?.unitPricePaise ? watchedLines[index].unitPricePaise / 100 : 0}
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    {index === 0 && <Label className="text-xs">GST %</Label>}
                    <Select
                      items={gstSlabLabels}
                      value={String(watchedLines[index]?.gstRateBps ?? 1800)}
                      onValueChange={(v) => estimateForm.setValue(`lineItems.${index}.gstRateBps`, Number(v))}
                    >
                      <SelectTrigger aria-label={`Line ${index + 1} GST rate`}>
                        <SelectValue placeholder="GST %" />
                      </SelectTrigger>
                      <SelectContent>
                        {gstSlabs?.map((slab) => (
                          <SelectItem key={slab.id} value={String(slab.rate)}>
                            {bpsToPercent(slab.rate)}%
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button type="button" variant="ghost" size="sm" onClick={() => remove(index)}>
                    Remove
                  </Button>
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="self-start"
                onClick={() => append({ description: '', qty: 1, unitPricePaise: 0, gstRateBps: 1800 })}
              >
                Add line
              </Button>

              {watchedLines.some((l) => l.description.trim() !== '') && (
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
              )}
            </div>

            <div className="flex gap-2">
              <Button
                onClick={() => createMutation.mutate()}
                disabled={!selectedBikeId || !complaint || createMutation.isPending}
              >
                {createMutation.isPending ? 'Creating…' : 'Create ticket'}
              </Button>
              <Button type="button" variant="ghost" onClick={() => router.push('/service-tickets')}>
                Cancel
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
