import Link from 'next/link';

interface BreadcrumbItem {
  label: string;
  href?: string;
}

// A way back out of detail pages — the sidebar nav alone doesn't tell you
// where you came from. Every item but the last is a link; the last renders
// as plain text (it's the current page). No built-in margin — callers
// control spacing to fit their own layout.
export function Breadcrumb({ items, className }: { items: BreadcrumbItem[]; className?: string }) {
  return (
    <nav className={`flex items-center gap-1.5 text-sm text-muted-foreground ${className ?? ''}`} aria-label="Breadcrumb">
      {items.map((item, i) => (
        <span key={i} className="flex items-center gap-1.5">
          {i > 0 && <span className="text-muted-foreground/50">/</span>}
          {item.href ? (
            <Link href={item.href} className="hover:text-foreground hover:underline">
              {item.label}
            </Link>
          ) : (
            <span className="text-foreground font-medium">{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}
