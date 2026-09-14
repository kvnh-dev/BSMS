'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';

function isTypingTarget(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable;
}

// Tally's universal "back out of this" key. Base UI's Dialog/Sheet already
// close on Esc by default when one is open, so this only handles the case
// where nothing is open: strip the last path segment. Every detail route in
// this app is flat, one level under its list (/invoices/:id, /invoices/:id
// /revise, /settings/categories/new, …), so popping a segment always lands
// on the sensible parent without needing to plumb per-page breadcrumb data
// through a global handler. Guarded against firing while typing, so it can
// never yank focus away from an in-progress edit.
export function useEscapeBack() {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (e.key !== 'Escape') return;
      if (isTypingTarget(e.target)) return;
      const popupOpen = document.querySelector('[data-slot="dialog-content"], [data-slot="sheet-content"]');
      if (popupOpen) return; // Base UI already closes it on Esc

      const segments = pathname.split('/').filter(Boolean);
      if (segments.length <= 1) return;
      router.push('/' + segments.slice(0, -1).join('/'));
    }

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [pathname, router]);
}
