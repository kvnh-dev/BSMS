'use client';

import { useId, cloneElement, isValidElement, type ReactElement } from 'react';
import { Label } from '@/components/ui/label';

interface FormFieldProps {
  label: string;
  hint?: string;
  error?: string;
  className?: string;
  // For composite widgets (e.g. shadcn's Select) whose root doesn't render a
  // DOM element itself, so cloning `id` onto it wouldn't reach the actual
  // focusable trigger — pass the id you set directly on that inner element
  // (e.g. `<SelectTrigger id="my-id">`) here instead of relying on auto-clone.
  htmlFor?: string;
  children: ReactElement<{ id?: string }>;
}

// Connects a Label to its field via htmlFor/id — plain sibling
// <Label>/<Input> pairs have no programmatic association, which breaks
// screen readers even though they look fine visually.
export function FormField({ label, hint, error, className, htmlFor, children }: FormFieldProps) {
  const generatedId = useId();
  const id = htmlFor ?? generatedId;
  const field = htmlFor ? children : isValidElement(children) ? cloneElement(children, { id }) : children;

  return (
    <div className={className ?? 'flex flex-col gap-1.5'}>
      <Label htmlFor={id}>{label}</Label>
      {field}
      {hint && !error && <p className="text-xs text-muted-foreground">{hint}</p>}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
