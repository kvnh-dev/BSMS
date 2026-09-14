'use client';

import { useEffect, useState } from 'react';
import { comboFromEvent } from '@/lib/use-global-shortcuts';
import { useQuickCreateTargetGetter, type QuickCreateEntity } from '@/lib/quick-create-context';
import { QuickAddCustomerSheet } from '@/components/quick-add-customer-sheet';
import { QuickAddInventoryItemSheet } from '@/components/quick-add-inventory-item-sheet';
import { QuickAddCategorySheet } from '@/components/quick-add-category-sheet';
import { QuickAddGstSlabSheet } from '@/components/quick-add-gst-slab-sheet';
import { QuickAddWorkerSheet } from '@/components/quick-add-worker-sheet';
import { QuickAddBikeSheet } from '@/components/quick-add-bike-sheet';
import { QuickAddSupplierSheet } from '@/components/quick-add-supplier-sheet';

// Real Tally Alt+C: fires while a picker field is focused, creates the
// master that field expects, right there — no menu. Does nothing outside a
// relevant field (see quick-create-context.tsx's registration model).
export function QuickCreateLauncher() {
  const getTarget = useQuickCreateTargetGetter();
  const [activeEntity, setActiveEntity] = useState<QuickCreateEntity | null>(null);
  const [onCreated, setOnCreated] = useState<((record: any) => void) | null>(null);

  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (comboFromEvent(e) !== 'Alt+C') return;
      const target = getTarget();
      if (!target) return;
      e.preventDefault();
      setActiveEntity(target.entity);
      setOnCreated(() => target.onCreated);
    }
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [getTarget]);

  function close() {
    setActiveEntity(null);
    setOnCreated(null);
  }

  function handleCreated(record: any) {
    onCreated?.(record);
  }

  return (
    <>
      <QuickAddCustomerSheet
        open={activeEntity === 'customer'}
        onOpenChange={(o) => !o && close()}
        onCreated={handleCreated}
      />
      <QuickAddInventoryItemSheet
        open={activeEntity === 'inventory-item'}
        onOpenChange={(o) => !o && close()}
        onCreated={handleCreated}
      />
      <QuickAddCategorySheet
        open={activeEntity === 'category'}
        onOpenChange={(o) => !o && close()}
        onCreated={handleCreated}
      />
      <QuickAddGstSlabSheet
        open={activeEntity === 'gst-slab'}
        onOpenChange={(o) => !o && close()}
        onCreated={handleCreated}
      />
      <QuickAddWorkerSheet
        open={activeEntity === 'technician'}
        onOpenChange={(o) => !o && close()}
        onCreated={handleCreated}
      />
      <QuickAddBikeSheet
        open={activeEntity === 'bike'}
        onOpenChange={(o) => !o && close()}
        onCreated={handleCreated}
      />
      <QuickAddSupplierSheet
        open={activeEntity === 'supplier'}
        onOpenChange={(o) => !o && close()}
        onCreated={handleCreated}
      />
    </>
  );
}
