'use client';

import { createContext, useContext, useCallback, useState, type ReactNode } from 'react';

// 'bike' is technically a master, not a transactional voucher, but its
// create form is complex/multi-field enough (and reachable standalone via
// F9) that the owner asked for the same pause-and-resume treatment as the
// three real vouchers — so it shares this store rather than getting a
// separate, parallel mechanism for what is otherwise identical behavior.
export type VoucherType = 'sale-order' | 'invoice' | 'service-ticket' | 'bike';

export interface VoucherDraft {
  id: string;
  type: VoucherType;
  label: string;
  data: unknown;
}

interface VoucherDraftsContextValue {
  drafts: VoucherDraft[];
  upsertDraft: (id: string, type: VoucherType, label: string, data: unknown) => void;
  removeDraft: (id: string) => void;
  getDraft: (id: string) => VoucherDraft | undefined;
}

const VoucherDraftsContext = createContext<VoucherDraftsContextValue | null>(null);

// Tally-parity multi-tasking: an in-progress voucher (Invoice, Sale Order,
// Service Ticket) has no backend record until it's submitted, so "pause and
// resume" for the pre-save moment has to be pure client state. Mounted once
// in layout.tsx — that's what survives navigating away and back (the layout
// stays mounted across route changes; only the page inside it remounts) and
// what's lost on a hard refresh, matching the confirmed in-memory-only scope.
export function VoucherDraftsProvider({ children }: { children: ReactNode }) {
  const [drafts, setDrafts] = useState<VoucherDraft[]>([]);

  const upsertDraft = useCallback((id: string, type: VoucherType, label: string, data: unknown) => {
    setDrafts((prev) => {
      const existing = prev.findIndex((d) => d.id === id);
      const next = { id, type, label, data };
      if (existing === -1) return [...prev, next];
      const copy = [...prev];
      copy[existing] = next;
      return copy;
    });
  }, []);

  const removeDraft = useCallback((id: string) => {
    setDrafts((prev) => prev.filter((d) => d.id !== id));
  }, []);

  const getDraft = useCallback((id: string) => drafts.find((d) => d.id === id), [drafts]);

  return (
    <VoucherDraftsContext.Provider value={{ drafts, upsertDraft, removeDraft, getDraft }}>
      {children}
    </VoucherDraftsContext.Provider>
  );
}

export function useVoucherDrafts() {
  const ctx = useContext(VoucherDraftsContext);
  if (!ctx) throw new Error('useVoucherDrafts must be used within VoucherDraftsProvider');
  return ctx;
}
