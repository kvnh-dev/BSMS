'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

function isTypingTarget(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable;
}

// Tally's Page Up/Page Down: on a voucher/record detail screen, move to the
// previous/next record in the current list without going back to it first.
// `list` is whatever the caller already fetched (react-query will already
// have it cached if the user arrived from the list page).
export function usePageUpDownNavigation<T extends { id: string }>(
  list: T[] | undefined,
  currentId: string | undefined,
  getPath: (item: T) => string,
) {
  const router = useRouter();

  useEffect(() => {
    if (!list || !currentId) return;

    function handler(e: KeyboardEvent) {
      if (e.key !== 'PageUp' && e.key !== 'PageDown') return;
      if (isTypingTarget(e.target)) return;
      const index = list!.findIndex((item) => item.id === currentId);
      if (index === -1) return;
      const neighborIndex = e.key === 'PageUp' ? index - 1 : index + 1;
      const neighbor = list![neighborIndex];
      if (!neighbor) return;
      e.preventDefault();
      router.push(getPath(neighbor));
    }

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [list, currentId, router]);
}
