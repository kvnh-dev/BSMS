'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { formatPaiseAsInr, rupeesToPaise, bpsToPercent, calcInvoiceTotal } from '@bsms/shared';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { StatusBadge } from '@/components/status-badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FormField } from '@/components/form-field';
import { Breadcrumb } from '@/components/breadcrumb';
import { BarcodeScanInput, type ScannedInventoryItem } from '@/components/barcode-scan-input';
import { useRegisterQuickCreateTarget } from '@/lib/quick-create-context';
import { usePageUpDownNavigation } from '@/lib/use-record-navigation';
import { api, ApiError } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';

interface InventoryItem {
  id: string;
  name: string;
  unitPrice: number;
  gstRate: number;
  stockQty: number;
  saleUnit: string | null;
}

interface GstSlab {
  id: string;
  label: string;
  rate: number;
  isDefault: boolean;
}

interface PartUsed {
  id: string;
  qty: number;
  priceAtUse: number;
  inventoryItem: { name: string };
}

interface ServiceCharge {
  id: string;
  description: string;
  amount: number;
  gstRate: number;
}

interface Estimate {
  lineItems: { description: string; qty: number; unitPricePaise: number; gstRateBps: number }[];
  gstBreakup: { cgstPaise: number; sgstPaise: number; igstPaise: number };
  discount: number;
}

interface TicketDetail {
  id: string;
  complaint: string;
  status: string;
  estimateAmount: number | null;
  bike: { id: string; regNo: string; model: string; customer: { id: string; name: string; phone: string } };
  technician: { name: string } | null;
  deliveredBy: { name: string } | null;
  deliveredAt: string | null;
  partsUsed: PartUsed[];
  serviceCharges: ServiceCharge[];
  estimate: Estimate | null;
  invoice: { id: string; status: string } | null;
}

const NEXT_STATUS: Record<string, { label: string; status: string }[]> = {
  INTAKE: [{ label: 'Approve', status: 'APPROVED' }],
  APPROVED: [{ label: 'Start service', status: 'IN_SERVICE' }],
  BILLED: [{ label: 'Mark delivered', status: 'DELIVERED' }],
};

export default function ServiceTicketDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { hasPersona } = useAuth();
  const queryClient = useQueryClient();
  const quickCreate = useRegisterQuickCreateTarget();
  const [partDialogOpen, setPartDialogOpen] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState<string>('');
  const [partQty, setPartQty] = useState(1);
  const [chargeDialogOpen, setChargeDialogOpen] = useState(false);
  const [chargeDescription, setChargeDescription] = useState('');
  const [chargeAmount, setChargeAmount] = useState(0);
  const [chargeGstRateBps, setChargeGstRateBps] = useState(1800);

  const { data: ticket, isLoading } = useQuery({
    queryKey: ['service-tickets', id],
    queryFn: () => api.get<TicketDetail>(`/service-tickets/${id}`),
  });

  const { data: ticketList } = useQuery({
    queryKey: ['service-tickets'],
    queryFn: () => api.get<{ id: string }[]>('/service-tickets'),
  });
  usePageUpDownNavigation(ticketList, id, (t) => `/service-tickets/${t.id}`);

  const { data: inventory } = useQuery({
    queryKey: ['inventory'],
    queryFn: () => api.get<InventoryItem[]>('/inventory'),
  });

  const { data: gstSlabs } = useQuery({
    queryKey: ['gst-slabs'],
    queryFn: () => api.get<GstSlab[]>('/gst-slabs'),
  });

  // Base UI's <Select.Value> shows the raw `value` unless the Select is
  // given an `items` value->label map — without it, picking an item shows
  // its id instead of its name once selected.
  const inventoryItemLabels = Object.fromEntries(
    (inventory ?? []).map((i) => [i.id, `${i.name} (${i.stockQty} in stock)`]),
  );
  const gstSlabLabels = Object.fromEntries((gstSlabs ?? []).map((s) => [String(s.rate), `${bpsToPercent(s.rate)}%`]));

  const statusMutation = useMutation({
    mutationFn: (status: string) => api.patch(`/service-tickets/${id}/status`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['service-tickets', id] });
      toast.success('Status updated');
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Update failed'),
  });

  const billMutation = useMutation({
    // Billing is derived server-side from the ticket's actual parts used +
    // service charges — never the estimate, never client-supplied lineItems.
    // Creates a DRAFT — the ticket stays IN_SERVICE until the draft is
    // reviewed and finalized on the invoice's own page.
    mutationFn: () => api.post<{ id: string }>('/invoices', { ticketId: id }),
    onSuccess: (invoice) => {
      toast.success('Draft invoice created — review and finalize it to bill the ticket');
      router.push(`/invoices/${invoice.id}`);
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Billing failed'),
  });

  const addPartMutation = useMutation({
    mutationFn: () => api.post(`/service-tickets/${id}/parts`, { inventoryItemId: selectedItemId, qty: partQty }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['service-tickets', id] });
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      toast.success('Part added');
      setPartDialogOpen(false);
      setSelectedItemId('');
      setPartQty(1);
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Failed to add part'),
  });

  const addChargeMutation = useMutation({
    mutationFn: () =>
      api.post(`/service-tickets/${id}/charges`, {
        description: chargeDescription,
        amount: rupeesToPaise(chargeAmount),
        gstRate: chargeGstRateBps,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['service-tickets', id] });
      toast.success('Charge added');
      setChargeDialogOpen(false);
      setChargeDescription('');
      setChargeAmount(0);
      setChargeGstRateBps(1800);
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Failed to add charge'),
  });

  const canManageTicket = hasPersona('OWNER', 'TECHNICIAN');
  const canDeliver = hasPersona('OWNER', 'DELIVERY');
  const canBill = hasPersona('OWNER', 'CASHIER');

  if (isLoading || !ticket) {
    return <p className="text-muted-foreground text-sm">Loading…</p>;
  }

  const nextActions = (NEXT_STATUS[ticket.status] ?? []).filter((action) =>
    action.status === 'DELIVERED' ? canDeliver : canManageTicket,
  );
  const inService = ticket.status === 'IN_SERVICE';
  const hasBillableWork = ticket.partsUsed.length > 0 || ticket.serviceCharges.length > 0;

  return (
    <div className="flex flex-col gap-6">
      <Breadcrumb
        items={[
          { label: 'Customers', href: '/customers' },
          { label: ticket.bike.customer.name, href: `/customers/${ticket.bike.customer.id}` },
          { label: ticket.bike.regNo, href: `/bikes/${ticket.bike.id}` },
          { label: ticket.complaint },
        ]}
      />
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>{ticket.bike.regNo}</CardTitle>
          <StatusBadge status={ticket.status} />
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground flex flex-col gap-1">
          <p>
            {ticket.bike.model} — {ticket.bike.customer.name} ({ticket.bike.customer.phone})
          </p>
          <p className="text-foreground">{ticket.complaint}</p>
          <p>Technician: {ticket.technician?.name ?? 'Unassigned'}</p>
          {ticket.estimateAmount !== null && (
            <p>Estimate: {formatPaiseAsInr(ticket.estimateAmount)}</p>
          )}
          {ticket.deliveredBy && ticket.deliveredAt && (
            <p>
              Delivered by {ticket.deliveredBy.name} on {new Date(ticket.deliveredAt).toLocaleString()}
            </p>
          )}
        </CardContent>
        {(nextActions.length > 0 || (inService && hasBillableWork && canBill) || ticket.invoice) && (
          <CardContent className="flex gap-2 pt-0">
            {nextActions.map((action) => (
              <Button
                key={action.status}
                size="sm"
                onClick={() => statusMutation.mutate(action.status)}
                disabled={statusMutation.isPending}
              >
                {action.label}
              </Button>
            ))}
            {ticket.invoice ? (
              <Button size="sm" variant="outline" onClick={() => router.push(`/invoices/${ticket.invoice!.id}`)}>
                {ticket.invoice.status === 'DRAFT' ? 'Review draft invoice' : 'View invoice'}
              </Button>
            ) : (
              inService &&
              hasBillableWork &&
              canBill && (
                <Button size="sm" onClick={() => billMutation.mutate()} disabled={billMutation.isPending}>
                  {billMutation.isPending ? 'Creating draft…' : 'Bill this ticket'}
                </Button>
              )
            )}
          </CardContent>
        )}
      </Card>

      <EstimateSection existing={ticket.estimate} />

      <div>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-lg font-semibold">Parts used</h2>
            {!inService && (
              <p className="text-xs text-muted-foreground">
                Recorded once the bike is in service — start service first.
              </p>
            )}
          </div>
          {canManageTicket && inService && (
            <Dialog open={partDialogOpen} onOpenChange={setPartDialogOpen}>
              <DialogTrigger render={<Button size="sm">Add part</Button>} />
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add part used</DialogTitle>
                </DialogHeader>
                <div className="flex flex-col gap-3">
                  <BarcodeScanInput onFound={(item: ScannedInventoryItem) => setSelectedItemId(item.id)} />
                  <FormField label="Item" htmlFor="part-item-select">
                    <Select
                      items={inventoryItemLabels}
                      value={selectedItemId}
                      onValueChange={(v) => setSelectedItemId(v ?? '')}
                    >
                      <SelectTrigger
                        id="part-item-select"
                        onFocus={() =>
                          quickCreate.onFocus({
                            entity: 'inventory-item',
                            onCreated: (item) => setSelectedItemId(item.id),
                          })
                        }
                        onBlur={quickCreate.onBlur}
                      >
                        <SelectValue placeholder="Select an item" />
                      </SelectTrigger>
                      <SelectContent>
                        {inventory?.map((item) => (
                          <SelectItem key={item.id} value={item.id}>
                            {item.name} ({item.stockQty} in stock)
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormField>
                  <FormField
                    label="Quantity"
                    hint={
                      inventory?.find((i) => i.id === selectedItemId)?.saleUnit
                        ? `In ${inventory?.find((i) => i.id === selectedItemId)?.saleUnit}`
                        : undefined
                    }
                  >
                    <Input
                      type="number"
                      min={1}
                      value={partQty}
                      onChange={(e) => setPartQty(Number(e.target.value))}
                    />
                  </FormField>
                  <DialogFooter>
                    <Button
                      onClick={() => addPartMutation.mutate()}
                      disabled={!selectedItemId || addPartMutation.isPending}
                    >
                      {addPartMutation.isPending ? 'Adding…' : 'Add part'}
                    </Button>
                  </DialogFooter>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Item</TableHead>
              <TableHead className="text-right">Qty</TableHead>
              <TableHead className="text-right">Price</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {ticket.partsUsed.map((part) => (
              <TableRow key={part.id}>
                <TableCell>{part.inventoryItem.name}</TableCell>
                <TableCell className="text-right">{part.qty}</TableCell>
                <TableCell className="text-right">{formatPaiseAsInr(part.priceAtUse)}</TableCell>
              </TableRow>
            ))}
            {ticket.partsUsed.length === 0 && (
              <TableRow>
                <TableCell colSpan={3} className="text-center text-muted-foreground py-6">
                  No parts recorded yet.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-lg font-semibold">Service charges</h2>
            {!inService && (
              <p className="text-xs text-muted-foreground">
                Recorded once the bike is in service — start service first.
              </p>
            )}
          </div>
          {canManageTicket && inService && (
            <Dialog open={chargeDialogOpen} onOpenChange={setChargeDialogOpen}>
              <DialogTrigger render={<Button size="sm">Add charge</Button>} />
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add service charge</DialogTitle>
                </DialogHeader>
                <div className="flex flex-col gap-3">
                  <FormField label="Description">
                    <Input
                      value={chargeDescription}
                      onChange={(e) => setChargeDescription(e.target.value)}
                      placeholder="e.g. Labor — brake overhaul"
                    />
                  </FormField>
                  <FormField label="Amount (₹)">
                    <Input
                      type="number"
                      step="0.01"
                      min={0}
                      value={chargeAmount}
                      onChange={(e) => setChargeAmount(Number(e.target.value))}
                    />
                  </FormField>
                  <FormField label="GST %" htmlFor="charge-gst-select">
                    <Select
                      items={gstSlabLabels}
                      value={String(chargeGstRateBps)}
                      onValueChange={(v) => setChargeGstRateBps(Number(v))}
                    >
                      <SelectTrigger id="charge-gst-select">
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
                  </FormField>
                  <DialogFooter>
                    <Button
                      onClick={() => addChargeMutation.mutate()}
                      disabled={!chargeDescription || addChargeMutation.isPending}
                    >
                      {addChargeMutation.isPending ? 'Adding…' : 'Add charge'}
                    </Button>
                  </DialogFooter>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Description</TableHead>
              <TableHead className="text-right">GST</TableHead>
              <TableHead className="text-right">Amount</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {ticket.serviceCharges.map((charge) => (
              <TableRow key={charge.id}>
                <TableCell>{charge.description}</TableCell>
                <TableCell className="text-right">{bpsToPercent(charge.gstRate)}%</TableCell>
                <TableCell className="text-right">{formatPaiseAsInr(charge.amount)}</TableCell>
              </TableRow>
            ))}
            {ticket.serviceCharges.length === 0 && (
              <TableRow>
                <TableCell colSpan={3} className="text-center text-muted-foreground py-6">
                  No charges recorded yet.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

// Read-only here — the quote shown to the customer at intake, created (if
// at all) from the "New service ticket" popup. It never changes once set,
// and the record of what actually happened lives in Parts used / Service
// charges below, so this stays collapsed by default and never editable
// from the ticket detail page.
function EstimateSection({ existing }: { existing: Estimate | null }) {
  const [expanded, setExpanded] = useState(false);

  if (!existing) {
    return (
      <div>
        <h2 className="text-lg font-semibold mb-1">Estimate</h2>
        <p className="text-sm text-muted-foreground">No estimate was recorded for this ticket.</p>
      </div>
    );
  }

  const total = calcInvoiceTotal(
    existing.lineItems.map((l) => ({ qty: l.qty, unitPricePaise: l.unitPricePaise, gstRateBps: l.gstRateBps })),
    existing.discount,
  );

  return (
    <div>
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        className="flex items-center justify-between w-full text-left group"
      >
        <div>
          <h2 className="text-lg font-semibold">Estimate</h2>
          <p className="text-sm text-muted-foreground">
            {existing.lineItems.map((l) => `${l.description} ×${l.qty}`).join(', ')}
            {' — '}
            <span className="font-medium text-foreground">{formatPaiseAsInr(total)}</span>
          </p>
        </div>
        <span className="text-xs text-muted-foreground group-hover:text-foreground shrink-0 ml-3">
          {expanded ? 'Hide details' : 'Show details'}
        </span>
      </button>

      {expanded && (
        <div className="mt-3 flex flex-col gap-1 text-sm border-t pt-3">
          {existing.lineItems.map((line, i) => (
            <div key={i} className="flex justify-between text-muted-foreground">
              <span>
                {line.description} × {line.qty} ({bpsToPercent(line.gstRateBps)}% GST)
              </span>
              <span>{formatPaiseAsInr(line.qty * line.unitPricePaise)}</span>
            </div>
          ))}
          {existing.discount > 0 && (
            <div className="flex justify-between text-muted-foreground">
              <span>Discount</span>
              <span>-{formatPaiseAsInr(existing.discount)}</span>
            </div>
          )}
          <div className="flex justify-between text-muted-foreground pt-2 border-t mt-1">
            <span>CGST</span>
            <span>{formatPaiseAsInr(existing.gstBreakup.cgstPaise)}</span>
          </div>
          <div className="flex justify-between text-muted-foreground">
            <span>SGST</span>
            <span>{formatPaiseAsInr(existing.gstBreakup.sgstPaise)}</span>
          </div>
          <div className="flex justify-between text-foreground font-medium">
            <span>Total</span>
            <span>{formatPaiseAsInr(total)}</span>
          </div>
        </div>
      )}
    </div>
  );
}
