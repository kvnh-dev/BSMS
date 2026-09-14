'use client';

import { useEffect, useMemo, useState, type KeyboardEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { NAV_GROUPS } from '@/lib/nav-groups';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api-client';

interface CustomerResult {
  id: string;
  name: string;
  phone: string;
}

interface InventoryResult {
  id: string;
  name: string;
  stockQty: number;
  baseUnit: string;
  saleUnit: string | null;
}

interface BikeResult {
  id: string;
  regNo: string;
  model: string;
  customer: { name: string };
}

interface ResultItem {
  key: string;
  label: string;
  sublabel?: string;
  href: string;
}

// The Tally-parity "Go To" bar (Alt+G, also Ctrl/Cmd+K): static navigation
// destinations plus live search across the app's master entities. Opened
// externally via `open`/`onOpenChange` — the global shortcut dispatcher
// (use-global-shortcuts.ts) decides *when* to open it, this component only
// renders the result.
export function GoToBar({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [query, setQuery] = useState('');
  const [highlighted, setHighlighted] = useState(0);
  const router = useRouter();
  const { hasPersona } = useAuth();

  useEffect(() => {
    if (!open) {
      setQuery('');
      setHighlighted(0);
    }
  }, [open]);

  const staticResults: ResultItem[] = useMemo(() => {
    const q = query.trim().toLowerCase();
    const items: ResultItem[] = [];
    for (const group of NAV_GROUPS) {
      for (const item of group.items) {
        if (item.personas && !hasPersona(...item.personas)) continue;
        if (q && !item.label.toLowerCase().includes(q)) continue;
        items.push({ key: `nav:${item.href}`, label: item.label, href: item.href });
      }
    }
    return items;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  const liveSearchEnabled = query.trim().length >= 2;

  const { data: customers } = useQuery({
    queryKey: ['go-to-customers', query],
    queryFn: () => api.get<CustomerResult[]>(`/customers/search?q=${encodeURIComponent(query)}`),
    enabled: liveSearchEnabled,
  });
  const { data: inventoryItems } = useQuery({
    queryKey: ['go-to-inventory', query],
    queryFn: () => api.get<InventoryResult[]>(`/inventory/search?q=${encodeURIComponent(query)}`),
    enabled: liveSearchEnabled,
  });
  const { data: bikes } = useQuery({
    queryKey: ['go-to-bikes', query],
    queryFn: () => api.get<BikeResult[]>(`/bikes/search?q=${encodeURIComponent(query)}`),
    enabled: liveSearchEnabled,
  });

  const customerResults: ResultItem[] = (customers ?? []).slice(0, 5).map((c) => ({
    key: `customer:${c.id}`,
    label: c.name,
    sublabel: c.phone,
    href: `/customers/${c.id}`,
  }));
  const inventoryResults: ResultItem[] = (inventoryItems ?? []).slice(0, 5).map((i) => ({
    key: `inventory:${i.id}`,
    label: i.name,
    sublabel: `${i.stockQty} ${i.saleUnit ?? i.baseUnit} in stock`,
    href: `/inventory/${i.id}`,
  }));
  const bikeResults: ResultItem[] = (bikes ?? []).slice(0, 5).map((b) => ({
    key: `bike:${b.id}`,
    label: b.regNo,
    sublabel: `${b.model} — ${b.customer.name}`,
    href: `/bikes/${b.id}`,
  }));

  const sections: { label: string; items: ResultItem[] }[] = [
    { label: 'Go to', items: staticResults },
    ...(customerResults.length ? [{ label: 'Customers', items: customerResults }] : []),
    ...(inventoryResults.length ? [{ label: 'Inventory', items: inventoryResults }] : []),
    ...(bikeResults.length ? [{ label: 'Bikes', items: bikeResults }] : []),
  ].filter((s) => s.items.length > 0);
  const flat = sections.flatMap((s) => s.items);

  function activate(item: ResultItem) {
    router.push(item.href);
    onOpenChange(false);
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlighted((h) => Math.min(h + 1, flat.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlighted((h) => Math.max(h - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const item = flat[highlighted];
      if (item) activate(item);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Go To</DialogTitle>
        </DialogHeader>
        <input
          autoFocus
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setHighlighted(0);
          }}
          onKeyDown={handleKeyDown}
          placeholder="Search customers, inventory, bikes, or jump to a page…"
          className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        />
        <div className="flex flex-col gap-2 max-h-80 overflow-y-auto">
          {sections.map((section) => (
            <div key={section.label}>
              <p className="px-2 pb-1 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                {section.label}
              </p>
              {section.items.map((item) => {
                const index = flat.indexOf(item);
                return (
                  <button
                    key={item.key}
                    type="button"
                    onMouseEnter={() => setHighlighted(index)}
                    onClick={() => activate(item)}
                    className={`flex w-full flex-col items-start rounded-md px-2 py-1.5 text-left text-sm ${
                      index === highlighted ? 'bg-accent' : 'hover:bg-accent/50'
                    }`}
                  >
                    <span>{item.label}</span>
                    {item.sublabel && <span className="text-xs text-muted-foreground">{item.sublabel}</span>}
                  </button>
                );
              })}
            </div>
          ))}
          {flat.length === 0 && <p className="text-sm text-muted-foreground px-2 py-1.5">No matches.</p>}
        </div>
      </DialogContent>
    </Dialog>
  );
}
