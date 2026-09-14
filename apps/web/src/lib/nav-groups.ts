import type { Persona } from '@bsms/shared';
import {
  DashboardIcon,
  CustomersIcon,
  ServiceTicketIcon,
  InvoiceIcon,
  SaleOrderIcon,
  DeliveryIcon,
  InventoryIcon,
  WorkersIcon,
  GstIcon,
  DelegationIcon,
  ReportsIcon,
  AuditLogIcon,
  AttendanceIcon,
  ShowroomProfileIcon,
  KeyboardIcon,
  CategoryIcon,
} from '@/components/nav-icons';

export interface NavItem {
  href: string;
  label: string;
  icon: (props: { className?: string }) => React.ReactElement;
  personas?: Persona[]; // omit = visible to everyone authenticated
}

// Shared between the sidebar (layout.tsx) and the Go To bar's static
// destination search — one list of "everywhere you can navigate," so the
// bar can jump anywhere the sidebar itself would show, no more and no less.
export const NAV_GROUPS: { label: string; items: NavItem[] }[] = [
  {
    label: 'Overview',
    items: [
      { href: '/dashboard', label: 'Dashboard', icon: DashboardIcon },
      { href: '/shortcuts', label: 'Keyboard Shortcuts', icon: KeyboardIcon },
    ],
  },
  {
    label: 'Operations',
    items: [
      { href: '/customers', label: 'Customers', icon: CustomersIcon },
      { href: '/service-tickets', label: 'Services', icon: ServiceTicketIcon },
      { href: '/sale-orders', label: 'Sale Orders', icon: SaleOrderIcon, personas: ['OWNER', 'CASHIER'] },
      { href: '/invoices', label: 'Invoices', icon: InvoiceIcon, personas: ['OWNER', 'CASHIER'] },
      { href: '/delivery', label: 'Delivery', icon: DeliveryIcon, personas: ['OWNER', 'DELIVERY'] },
      { href: '/inventory', label: 'Inventory', icon: InventoryIcon },
      { href: '/attendance', label: 'Attendance', icon: AttendanceIcon },
    ],
  },
  {
    label: 'Admin',
    items: [
      { href: '/workers', label: 'Workers', icon: WorkersIcon, personas: ['OWNER'] },
      {
        href: '/settings/showroom-profile',
        label: 'Showroom Profile',
        icon: ShowroomProfileIcon,
        personas: ['OWNER'],
      },
      { href: '/settings/categories', label: 'Categories', icon: CategoryIcon, personas: ['OWNER'] },
      { href: '/settings/gst-slabs', label: 'GST Slabs', icon: GstIcon, personas: ['OWNER'] },
      { href: '/delegation', label: 'Delegation', icon: DelegationIcon },
    ],
  },
  {
    label: 'Insights',
    items: [
      { href: '/reports', label: 'Reports', icon: ReportsIcon, personas: ['OWNER', 'AUDITOR'] },
      { href: '/reports/receivables', label: 'Receivables', icon: InvoiceIcon, personas: ['OWNER', 'AUDITOR'] },
      { href: '/audit-log', label: 'Audit Log', icon: AuditLogIcon, personas: ['OWNER', 'AUDITOR'] },
    ],
  },
];
