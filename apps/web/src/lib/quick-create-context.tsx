'use client';

import { createContext, useContext, useRef, type ReactNode } from 'react';

export type QuickCreateEntity = 'customer' | 'inventory-item' | 'category' | 'gst-slab' | 'technician' | 'bike';

export interface QuickCreateTarget {
  entity: QuickCreateEntity;
  onCreated: (record: any) => void;
}

interface QuickCreateContextValue {
  setTarget: (target: QuickCreateTarget | null) => void;
  getTarget: () => QuickCreateTarget | null;
}

const QuickCreateContext = createContext<QuickCreateContextValue | null>(null);

// Tally's Alt+C is field-context-aware: it fires while a picker is focused
// and creates whatever master that field expects, right there. This ref
// (not state — no re-render needed) tracks "whichever picker registered
// last, wins" so the global Alt+C handler (quick-create-launcher.tsx) knows
// which entity to create and how to feed the result back into that field.
export function QuickCreateProvider({ children }: { children: ReactNode }) {
  const targetRef = useRef<QuickCreateTarget | null>(null);
  const value: QuickCreateContextValue = {
    setTarget: (target) => {
      targetRef.current = target;
    },
    getTarget: () => targetRef.current,
  };
  return <QuickCreateContext.Provider value={value}>{children}</QuickCreateContext.Provider>;
}

// A picker calls this with its target on focus, and `null` on blur.
export function useRegisterQuickCreateTarget() {
  const ctx = useContext(QuickCreateContext);
  if (!ctx) throw new Error('useRegisterQuickCreateTarget must be used within QuickCreateProvider');

  return {
    onFocus: (target: QuickCreateTarget) => ctx.setTarget(target),
    onBlur: () => ctx.setTarget(null),
  };
}

// Used only by the global Alt+C handler.
export function useQuickCreateTargetGetter() {
  const ctx = useContext(QuickCreateContext);
  if (!ctx) throw new Error('useQuickCreateTargetGetter must be used within QuickCreateProvider');
  return ctx.getTarget;
}
