// Stroke-based line icons matching the "Warm Enterprise" design direction
// (see the picked canvas at claude.ai/code/artifact/899b956b-...). Kept as
// plain inline SVG rather than an icon library so they exactly match the
// mockup's hand-drawn set.
import type { SVGProps } from 'react';

function Icon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      width="17"
      height="17"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    />
  );
}

export function DashboardIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <rect x="3" y="3" width="7" height="9" rx="1.5" />
      <rect x="14" y="3" width="7" height="5" rx="1.5" />
      <rect x="14" y="12" width="7" height="9" rx="1.5" />
      <rect x="3" y="16" width="7" height="5" rx="1.5" />
    </Icon>
  );
}

export function CustomersIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="8" r="3.4" />
      <path d="M5 20c0-3.5 3.1-6 7-6s7 2.5 7 6" />
    </Icon>
  );
}

export function ServiceTicketIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="M9 3h6l1 3h3v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V6h3l1-3Z" />
      <path d="M9 11l2 2 4-4" />
    </Icon>
  );
}

export function InvoiceIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="M6 3h9l3 3v15a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" />
      <path d="M9 12h6M9 16h6M9 8h3" />
    </Icon>
  );
}

export function SaleOrderIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="M8 3h8a1 1 0 0 1 1 1v16l-4-2.5L9 20l-4-2.5V4a1 1 0 0 1 1-1h2Z" />
      <path d="M9 8h6M9 12h6" />
    </Icon>
  );
}

export function SuppliersIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="M4 21V8l8-5 8 5v13" />
      <path d="M4 21h16" />
      <path d="M9 21v-6h6v6" />
    </Icon>
  );
}

export function PurchaseOrderIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="M12 3v11" />
      <path d="M7.5 10.5 12 15l4.5-4.5" />
      <path d="M4 19h16" />
    </Icon>
  );
}

export function PurchaseBillIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="M6 3h9l3 3v15a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" />
      <path d="M9 16h6" />
      <path d="M9.5 9.5 12 12l2.5-2.5" />
      <path d="M12 7v5" />
    </Icon>
  );
}

export function DeliveryIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <rect x="2.5" y="9" width="13" height="8" rx="1" />
      <path d="M15.5 12h3.2L21 15v2h-5.5" />
      <circle cx="6.5" cy="18.5" r="1.6" />
      <circle cx="17" cy="18.5" r="1.6" />
    </Icon>
  );
}

export function InventoryIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="M3 8l9-5 9 5-9 5-9-5Z" />
      <path d="M3 8v8l9 5 9-5V8M12 13v8" />
    </Icon>
  );
}

export function WorkersIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <circle cx="9" cy="8" r="3" />
      <path d="M3 20c0-3 2.7-5.2 6-5.2s6 2.2 6 5.2" />
      <circle cx="17.5" cy="7.5" r="2.2" />
      <path d="M15.6 14.8c2.6.3 4.4 2.2 4.4 5.2" />
    </Icon>
  );
}

export function GstIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M8 9h.01M16 15h.01M16 9L8 15" />
    </Icon>
  );
}

export function DelegationIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6l7-3Z" />
      <path d="M9 12l2 2 4-4" />
    </Icon>
  );
}

export function ReportsIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="M4 20V10M11 20V4M18 20v-7" />
    </Icon>
  );
}

export function LedgerIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="M12 3v18" />
      <path d="M5 7h14" />
      <path d="M5 7 3 12a2.5 2.5 0 0 0 5 0L5 7Z" />
      <path d="M19 7l-2 5a2.5 2.5 0 0 0 5 0l-2-5Z" />
    </Icon>
  );
}

export function ExpensesIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <rect x="2.5" y="6" width="19" height="13" rx="2" />
      <path d="M2.5 10h19" />
      <path d="M16 14.5h2.5" />
    </Icon>
  );
}

export function AuditLogIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6l7-3Z" />
      <path d="M12 8v5M12 16h.01" />
    </Icon>
  );
}

export function AttendanceIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 3" />
    </Icon>
  );
}

export function LogoutIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <path d="M16 17l5-5-5-5M21 12H9" />
    </Icon>
  );
}

export function BikeLogoIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon strokeWidth="2.4" {...props}>
      <circle cx="5.5" cy="17.5" r="3.5" />
      <circle cx="18.5" cy="17.5" r="3.5" />
      <path d="M15 6h3l3 6.5M12 17.5H9.5L7 10l3-3h4l1 3h3" />
    </Icon>
  );
}

export function PrintIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="M7 8V3h10v5" />
      <rect x="4" y="8" width="16" height="9" rx="1.5" />
      <path d="M7 14h10v7H7z" />
    </Icon>
  );
}

export function KeyboardIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <rect x="2" y="6" width="20" height="12" rx="2" />
      <path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M7 14h10" />
    </Icon>
  );
}

export function CategoryIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="M3 3h8l10 10-8 8L3 11z" />
      <circle cx="7.5" cy="7.5" r="1.2" fill="currentColor" stroke="none" />
    </Icon>
  );
}

export function ShowroomProfileIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="M4 21V9l8-5 8 5v12" />
      <path d="M4 21h16" />
      <path d="M10 21v-6h4v6" />
    </Icon>
  );
}
