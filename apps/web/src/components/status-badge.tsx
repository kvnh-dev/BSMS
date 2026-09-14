import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

// Centralizes status -> color mapping so every ServiceTicket/DelegationTask
// status badge in the app looks consistent — see WEB_APP_PLAN.md's
// cross-cutting components list.
const STATUS_STYLES: Record<string, string> = {
  INTAKE: 'bg-warning-soft text-warning',
  APPROVED: 'bg-accent text-accent-foreground',
  IN_SERVICE: 'bg-accent text-accent-foreground',
  BILLED: 'bg-info-soft text-info',
  DELIVERED: 'bg-success-soft text-success',
  PENDING: 'bg-warning-soft text-warning',
  REJECTED: 'bg-destructive/10 text-destructive',
  DRAFT: 'bg-warning-soft text-warning',
  FINAL: 'bg-success-soft text-success',
  OPEN: 'bg-accent text-accent-foreground',
  CONVERTED: 'bg-success-soft text-success',
  CANCELLED: 'bg-destructive/10 text-destructive',
};

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        'border-transparent font-semibold',
        STATUS_STYLES[status] ?? 'bg-secondary text-secondary-foreground',
        className,
      )}
    >
      {status.replace('_', ' ')}
    </Badge>
  );
}
