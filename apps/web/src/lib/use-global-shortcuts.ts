'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { SHORTCUTS } from './shortcuts-registry';

function isTypingTarget(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable;
}

// Bare F-keys never insert as text, so they always fire. Modifier combos
// (Ctrl/Alt+letter) are real key combinations too — a browser won't type "k"
// into a field when Ctrl is held — so they always fire as well. Only a plain,
// unmodified letter key gets guarded against hijacking normal typing.
//
// e.key is unreliable for Alt combos: on macOS, Option+C reports e.key as
// "ç" (the OS-composed character), not "c". e.code gives the physical key
// ("KeyC") regardless of what modifiers compose it into, so letter matching
// always goes through e.code — this bit the very first draft of Alt+G/Alt+C.
export function comboFromEvent(e: KeyboardEvent): string {
  if (/^F\d+$/.test(e.key)) return e.key;
  const parts: string[] = [];
  if (e.ctrlKey || e.metaKey) parts.push('Ctrl');
  if (e.altKey) parts.push('Alt');
  if (e.shiftKey) parts.push('Shift');
  const letterMatch = /^Key([A-Z])$/.exec(e.code);
  parts.push(letterMatch ? letterMatch[1] : e.key.length === 1 ? e.key.toUpperCase() : e.key);
  return parts.join('+');
}

interface GlobalShortcutHandlers {
  onOpenGoTo: () => void;
  onNavigateHome: () => void;
  onFocusTaskbar: () => void;
}

export function useGlobalShortcuts({ onOpenGoTo, onNavigateHome, onFocusTaskbar }: GlobalShortcutHandlers) {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    function handler(e: KeyboardEvent) {
      const combo = comboFromEvent(e);
      const entry = SHORTCUTS.find((s) => s.combo === combo);
      if (!entry) return;
      if (isTypingTarget(e.target) && !combo.startsWith('F') && !combo.includes('+')) return;

      e.preventDefault();
      if (entry.href) {
        const context = entry.contextParam?.(pathname);
        router.push(context ? `${entry.href}?${context.key}=${context.value}` : entry.href);
      } else if (entry.action === 'open-go-to') onOpenGoTo();
      else if (entry.action === 'navigate-home') onNavigateHome();
      else if (entry.action === 'focus-taskbar') onFocusTaskbar();
    }

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [router, pathname, onOpenGoTo, onNavigateHome, onFocusTaskbar]);
}
