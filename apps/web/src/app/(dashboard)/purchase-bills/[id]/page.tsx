'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { formatPaiseAsInr, bpsToPercent } from '@bsms/shared';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { FormField } from '@/components/form-field';
import { Breadcrumb } from '@/components/breadcrumb';
import { RecordSupplierPaymentSheet } from '@/components/record-supplier-payment-sheet';
import { api, ApiError } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { usePageUpDownNavigation } from '@/lib/use-record-navigation';

interface PurchaseBillLineItem {
  id: string;
  description: string;
  qty: number;
  unitPrice: number;
  gstRate: number;
  inventoryItem: { name: string; hsnCode: string } | null;
}

interface PurchaseBillDetail {
  id: string;
  billNumber: string | null;
  createdAt: string;
  discount: number;
  total: number;
  paidAmount: number;
  balanceDue: number;
  supplier: { name: string; phone: string | null; gstin: string | null };
  lineItems: PurchaseBillLineItem[];
}

interface SupplierPayment {
  id: string;
  amount: number;
  mode: string;
  reference: string | null;
  voided: boolean;
  voidedReason: string | null;
  createdAt: string;
  recordedBy: { name: string };
}

export default function PurchaseBillDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { hasPersona } = useAuth();
  const isOwner = hasPersona('OWNER');
  const queryClient = useQueryClient();
  const [paymentSheetOpen, setPaymentSheetOpen] = useState(false);
  const [voidTarget, setVoidTarget] = useState<SupplierPayment | null>(null);
  const [voidReason, setVoidReason] = useState('');

  const { data: bill, isLoading } = useQuery({
    queryKey: ['purchase-bills', id],
    queryFn: () => api.get<PurchaseBillDetail>(`/purchase-bills/${id}`),
  });

  const { data: billList } = useQuery({
    queryKey: ['purchase-bills'],
    queryFn: () => api.get<{ id: string }[]>('/purchase-bills'),
  });
  usePageUpDownNavigation(billList, id, (b) => `/purchase-bills/${b.id}`);

  const { data: payments } = useQuery({
    queryKey: ['purchase-bills', id, 'payments'],
    queryFn: () => api.get<SupplierPayment[]>(`/purchase-bills/${id}/payments`),
    enabled: !!bill,
  });

  const voidMutation = useMutation({
    mutationFn: ({ paymentId, reason }: { paymentId: string; reason: string }) =>
      api.patch(`/supplier-payments/${paymentId}/void`, { reason }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase-bills', id] });
      queryClient.invalidateQueries({ queryKey: ['purchase-bills', id, 'payments'] });
      queryClient.invalidateQueries({ queryKey: ['purchase-bills'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      toast.success('Payment voided');
      setVoidTarget(null);
      setVoidReason('');
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Failed to void payment'),
  });

  if (isLoading || !bill) {
    return <p className="text-muted-foreground text-sm">Loading…</p>;
  }

  const balanceLabel = bill.balanceDue <= 0 ? 'Paid in full' : formatPaiseAsInr(bill.balanceDue);

  return (
    <div className="flex flex-col gap-6">
      <Breadcrumb items={[{ label: 'Purchase Bills', href: '/purchase-bills' }, { label: bill.billNumber ?? 'Untitled' }]} />

      <Card className="max-w-2xl w-full mx-auto">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>{bill.supplier.name}</CardTitle>
          <span className="text-sm text-muted-foreground">
            {new Date(bill.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
          </span>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="text-sm text-muted-foreground">
            {bill.supplier.phone && <p>{bill.supplier.phone}</p>}
            {bill.supplier.gstin && <p>GSTIN {bill.supplier.gstin}</p>}
            {bill.billNumber && <p>Supplier&apos;s bill #: {bill.billNumber}</p>}
          </div>

          <div className="flex flex-col gap-1 text-sm border-t pt-3">
            {bill.lineItems.map((line) => (
              <div key={line.id} className="flex justify-between">
                <span>
                  {line.description} × {line.qty} ({bpsToPercent(line.gstRate)}% GST)
                  {line.inventoryItem && <span className="text-muted-foreground"> — {line.inventoryItem.hsnCode}</span>}
                </span>
                <span>{formatPaiseAsInr(line.qty * line.unitPrice)}</span>
              </div>
            ))}
            {bill.discount > 0 && (
              <div className="flex justify-between text-muted-foreground">
                <span>Discount</span>
                <span>-{formatPaiseAsInr(bill.discount)}</span>
              </div>
            )}
            <div className="flex justify-between text-foreground font-medium border-t pt-2 mt-1">
              <span>Total</span>
              <span>{formatPaiseAsInr(bill.total)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="max-w-2xl w-full mx-auto">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Payments</CardTitle>
          <div className="flex items-center gap-3">
            <span
              className={
                bill.balanceDue <= 0 ? 'text-success font-semibold text-sm' : 'text-destructive font-semibold text-sm'
              }
            >
              Balance due: {balanceLabel}
            </span>
            {bill.balanceDue > 0 && (
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

      <RecordSupplierPaymentSheet
        open={paymentSheetOpen}
        onOpenChange={setPaymentSheetOpen}
        purchaseBillId={bill.id}
        balanceDue={bill.balanceDue}
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
                onClick={() => voidTarget && voidMutation.mutate({ paymentId: voidTarget.id, reason: voidReason })}
              >
                {voidMutation.isPending ? 'Voiding…' : 'Void payment'}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
