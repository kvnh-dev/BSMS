'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter, SheetTrigger } from '@/components/ui/sheet';
import { FormField } from '@/components/form-field';
import { api, ApiError } from '@/lib/api-client';

// Tally-parity quick-adjust: fix a stock shortfall discovered mid-billing
// without abandoning the invoice/sale-order line the cashier is on.
export function QuickAdjustStockSheet({
  itemId,
  itemName,
  currentStock,
  onAdjusted,
}: {
  itemId: string;
  itemName: string;
  currentStock?: number;
  onAdjusted?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [delta, setDelta] = useState(0);
  const [reason, setReason] = useState('');
  const queryClient = useQueryClient();

  const adjustMutation = useMutation({
    mutationFn: () => api.post(`/inventory/${itemId}/adjust-stock`, { delta, reason }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      queryClient.invalidateQueries({ queryKey: ['inventory', itemId] });
      toast.success('Stock adjusted');
      setOpen(false);
      setDelta(0);
      setReason('');
      onAdjusted?.();
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Failed to adjust stock'),
  });

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger render={<Button type="button" variant="ghost" size="sm">Adjust stock</Button>} />
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Adjust stock — {itemName}</SheetTitle>
        </SheetHeader>
        <div className="flex flex-col gap-3">
          {currentStock !== undefined && (
            <p className="text-sm text-muted-foreground">Current stock: {currentStock}</p>
          )}
          <FormField label="Change (+ to add, − to remove)">
            <Input type="number" value={delta} onChange={(e) => setDelta(Number(e.target.value))} />
          </FormField>
          <FormField label="Reason">
            <Input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Restock from supplier, damaged stock write-off"
            />
          </FormField>
        </div>
        <SheetFooter>
          <Button onClick={() => adjustMutation.mutate()} disabled={!delta || !reason || adjustMutation.isPending}>
            {adjustMutation.isPending ? 'Saving…' : 'Save adjustment'}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
