// Prisma models store these as plain strings (SQLite has no enum type — see
// DATABASE_SCHEMA.md). These are the single source of truth for valid values,
// consumed by both backend validation and frontend UI.

export const PERSONAS = ['OWNER', 'TECHNICIAN', 'CASHIER', 'DELIVERY', 'AUDITOR'] as const;
export type Persona = (typeof PERSONAS)[number];

export const TICKET_STATUSES = ['INTAKE', 'APPROVED', 'IN_SERVICE', 'BILLED', 'DELIVERED'] as const;
export type TicketStatus = (typeof TICKET_STATUSES)[number];

export const DELEGATION_STATUSES = ['PENDING', 'APPROVED', 'REJECTED'] as const;
export type DelegationStatus = (typeof DELEGATION_STATUSES)[number];

export const DELEGATION_TASK_TYPES = ['INVENTORY_EDIT', 'DISCOUNT_OVERRIDE'] as const;
export type DelegationTaskType = (typeof DELEGATION_TASK_TYPES)[number];

export const PAYMENT_MODES = ['CASH', 'UPI', 'CARD', 'BANK_TRANSFER', 'CHEQUE', 'OTHER'] as const;
export type PaymentMode = (typeof PAYMENT_MODES)[number];
