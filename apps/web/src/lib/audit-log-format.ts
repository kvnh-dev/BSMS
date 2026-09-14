// Shared between the full Audit Log page and any entity-scoped activity
// panel (e.g. an inventory item's own stock-adjustment history) — a generic
// before/after diff that works for whatever shape an audited action happens
// to carry, rather than hardcoding one action type.
function formatValue(v: unknown): string {
  const text = typeof v === 'object' && v !== null ? JSON.stringify(v) : String(v);
  return text.length > 60 ? `${text.slice(0, 60)}…` : text;
}

export function describeChange(before: Record<string, unknown> | null, after: Record<string, unknown> | null): string {
  const keys = new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})]);
  const parts: string[] = [];
  for (const key of keys) {
    const b = before?.[key];
    const a = after?.[key];
    if (JSON.stringify(b) === JSON.stringify(a)) continue;
    parts.push(b === undefined ? `${key}: ${formatValue(a)}` : `${key}: ${formatValue(b)} → ${formatValue(a)}`);
  }
  return parts.join(', ') || '—';
}
