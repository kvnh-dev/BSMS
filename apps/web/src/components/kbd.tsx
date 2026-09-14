export function Kbd({ children, className }: { children: string; className?: string }) {
  return (
    <kbd
      className={`inline-flex items-center justify-center rounded-md border border-foreground/15 bg-muted px-2 py-0.5 text-xs font-semibold text-foreground shadow-[0_1px_0_0_rgb(0_0_0_/_0.08)] ${className ?? ''}`}
    >
      {children}
    </kbd>
  );
}
