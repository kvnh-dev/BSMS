'use client';

import { useRouter, usePathname } from 'next/navigation';
import { useVoucherDrafts, type VoucherType } from '@/lib/voucher-drafts-context';

const BASE_PATH: Record<VoucherType, string> = {
  'sale-order': '/sale-orders/new',
  invoice: '/invoices/new',
  'service-ticket': '/service-tickets/new',
  bike: '/bikes/new',
  'purchase-order': '/purchase-orders/new',
  'purchase-bill': '/purchase-bills/new',
};

// Tally-style multi-tasking taskbar: shows every in-progress, not-yet-saved
// voucher so you can jump back into one from anywhere. Hidden entirely when
// there's nothing in progress — no permanent screen cost. Chips for the
// voucher type you're currently viewing are suppressed since that page's own
// in-page UI (e.g. Sale Orders' tab bar) already shows them.
export function VoucherTaskbar() {
  const { drafts, removeDraft } = useVoucherDrafts();
  const router = useRouter();
  const pathname = usePathname();

  const visible = drafts.filter((d) => BASE_PATH[d.type] !== pathname);
  if (visible.length === 0) return null;

  return (
    <div data-slot="voucher-taskbar" className="flex shrink-0 items-center gap-2 border-t bg-muted/50 px-4 py-2 print:hidden">
      <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">In progress</span>
      <div className="flex flex-wrap items-center gap-1.5">
        {visible.map((draft) => (
          <div
            key={draft.id}
            className="flex items-center gap-1.5 rounded-full border bg-background px-3 py-1 text-xs"
          >
            <button
              type="button"
              onClick={() => router.push(`${BASE_PATH[draft.type]}?draft=${draft.id}`)}
              className="hover:underline"
            >
              {draft.label}
            </button>
            <button
              type="button"
              onClick={() => removeDraft(draft.id)}
              className="text-muted-foreground/60 hover:text-foreground"
              aria-label={`Discard ${draft.label}`}
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
