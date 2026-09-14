// Single source of truth for every *global, non-contextual* shortcut — the F-key
// route jumps plus the two imperative actions (Go To, Home) that need a callback
// instead of a plain route. Consumed by use-global-shortcuts.ts (the dispatcher),
// the shortcuts help page, and inline <Kbd> hint badges next to matching buttons.
//
// Deliberately aligned to Tally's actual keybindings where a clean concept
// exists — see memory/feedback_tally_parity_fidelity.md: F8 = Sales in Tally,
// which maps to "New Invoice" here; Ctrl+M is Tally's literal "Gateway of
// Tally" (home) key; Alt+G is Tally's actual "Go To" key. BSMS has no general-
// ledger vouchers, so F4/F6/F7 (Service/Customer/Inventory) have no Tally
// equivalent to align to and keep their existing, app-specific bindings.
//
// Alt+C ("Create master on the fly") is NOT in this table — it's context-aware
// (fires only while a picker field is focused; see quick-create-context.tsx),
// not a plain global dispatch entry.
// Matches a flat, one-level detail route (`/bikes/:id`, never a deeper path
// like `/invoices/:id/revise`) and returns just the `:id` segment, or null
// when the current page isn't that kind of detail page at all.
function idFromPath(pathname: string, prefix: string): string | null {
  const match = new RegExp(`^${prefix}/([^/]+)$`).exec(pathname);
  return match ? match[1] : null;
}

export interface ShortcutEntry {
  combo: string;
  label: string;
  href?: string;
  action?: 'open-go-to' | 'navigate-home' | 'focus-taskbar';
  // Context-aware prefill (the owner's ask: "if I'm on the bike's page, F4
  // should default-select the current bike, same for every page action") —
  // given the current pathname, returns a query param to append to `href`
  // pre-selecting whatever entity is already on screen, or null when this
  // page has no relevant context for this shortcut. The target page must
  // itself support that query param (see e.g. service-tickets/new's
  // `?bikeId=`, invoices/new's `?ticketId=`, bikes/new's `?customerId=`) —
  // an existing in-progress draft's own value always wins over this, so
  // it can never clobber a resumed draft.
  contextParam?: (pathname: string) => { key: string; value: string } | null;
}

export const SHORTCUTS: ShortcutEntry[] = [
  {
    combo: 'F4',
    label: 'New Service',
    href: '/service-tickets/new',
    contextParam: (pathname) => {
      const bikeId = idFromPath(pathname, '/bikes');
      return bikeId ? { key: 'bikeId', value: bikeId } : null;
    },
  },
  { combo: 'F5', label: 'Attendance', href: '/attendance' },
  { combo: 'F6', label: 'New Customer', href: '/customers/new' },
  { combo: 'F7', label: 'New Inventory Item', href: '/inventory/new' },
  {
    combo: 'F8',
    label: 'New Invoice',
    href: '/invoices/new',
    contextParam: (pathname) => {
      const ticketId = idFromPath(pathname, '/service-tickets');
      return ticketId ? { key: 'ticketId', value: ticketId } : null;
    },
  },
  {
    combo: 'F9',
    label: 'New Bike',
    href: '/bikes/new',
    contextParam: (pathname) => {
      const customerId = idFromPath(pathname, '/customers');
      return customerId ? { key: 'customerId', value: customerId } : null;
    },
  },
  {
    combo: 'F10',
    label: 'New Purchase Bill',
    href: '/purchase-bills/new',
    contextParam: (pathname) => {
      const supplierId = idFromPath(pathname, '/suppliers');
      return supplierId ? { key: 'supplierId', value: supplierId } : null;
    },
  },
  { combo: 'Ctrl+K', label: 'Go To — search & jump', action: 'open-go-to' },
  { combo: 'Alt+G', label: 'Go To — search & jump', action: 'open-go-to' },
  { combo: 'Ctrl+M', label: 'Home / Dashboard', action: 'navigate-home' },
  // Jumps focus straight to the bottom "In progress" voucher taskbar — added
  // because it's the very last thing in the DOM (see voucher-taskbar.tsx),
  // so reaching it by plain Tabbing could mean 20+ presses on a busy page.
  { combo: 'Alt+I', label: 'Jump to In Progress bar', action: 'focus-taskbar' },
];

// Maps a sidebar nav item's href to the shortcut that opens it, so the menu
// item itself can carry a <Kbd> hint (Tally-style) — e.g. F8 opens
// /invoices/new, so the "Invoices" nav item (/invoices) shows F8. Derived
// from SHORTCUTS via longest-path-prefix matching rather than a second,
// hand-maintained table, since SHORTCUTS is this file's stated single
// source of truth and a create-page href (/invoices/new) never exactly
// equals its list-page nav href (/invoices).
export function shortcutForNavHref(navHref: string): string | undefined {
  return SHORTCUTS.find((s) => {
    const target = s.href ?? (s.action === 'navigate-home' ? '/dashboard' : undefined);
    return target === navHref || target?.startsWith(`${navHref}/`);
  })?.combo;
}
