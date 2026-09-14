import { z } from 'zod';
import { PERSONAS, TICKET_STATUSES, DELEGATION_TASK_TYPES, PAYMENT_MODES } from './constants';

export const loginSchema = z.object({
  phone: z.string().min(10).max(15),
  password: z.string().min(1),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const showroomProfileSchema = z.object({
  name: z.string().min(1),
  logoUrl: z.string().url().optional().nullable(),
  address: z.string().min(1),
  contactNumber: z.string().min(10).max(15),
  email: z.string().email(),
  gstin: z.string().min(15).max(15),
  pan: z.string().min(10).max(10),
  state: z.string().min(1),
  invoicePrefix: z.string().min(1).max(10),
  // Not `.default()` — that makes the zodResolver's input/output types
  // diverge (input optional, output required), which breaks react-hook-form's
  // type inference. The setup wizard form already supplies these explicitly
  // via defaultValues; callers that omit them should just pass them.
  currency: z.string().min(1),
  locale: z.string().min(1),
});
export type ShowroomProfileInput = z.infer<typeof showroomProfileSchema>;

export const setupWizardSchema = z.object({
  profile: showroomProfileSchema,
  owner: z.object({
    name: z.string().min(1),
    phone: z.string().min(10).max(15),
    password: z.string().min(8),
  }),
  defaultGstSlabId: z.string().min(1).optional(),
});
export type SetupWizardInput = z.infer<typeof setupWizardSchema>;

export const gstSlabSchema = z.object({
  label: z.string().min(1),
  rate: z.number().int().min(0).max(10000), // basis points, e.g. 2800 = 28.00%
  isDefault: z.boolean().default(false),
});
export type GstSlabInput = z.infer<typeof gstSlabSchema>;

// A managed inventory-category list with a default GST rate — a UI
// convenience for pre-filling InventoryItem.gstRate, same reasoning as
// GstSlab above. InventoryItem.category stays free text (see schema comment).
export const categorySchema = z.object({
  name: z.string().min(1),
  gstRate: z.number().int().min(0).max(10000), // basis points
});
export type CategoryInput = z.infer<typeof categorySchema>;

export const createUserSchema = z.object({
  name: z.string().min(1),
  phone: z.string().min(10).max(15),
  password: z.string().min(8),
  personas: z.array(z.enum(PERSONAS)).min(1),
});
export type CreateUserInput = z.infer<typeof createUserSchema>;

export const updateUserSchema = z.object({
  name: z.string().min(1).optional(),
  personas: z.array(z.enum(PERSONAS)).min(1).optional(),
  isActive: z.boolean().optional(),
});
export type UpdateUserInput = z.infer<typeof updateUserSchema>;

export const checkInSchema = z.object({});
export const checkOutSchema = z.object({});

export const inventoryItemSchema = z.object({
  name: z.string().min(1),
  category: z.string().min(1),
  hsnCode: z.string().min(1),
  gstRate: z.number().int().min(0).max(10000), // basis points
  unitPrice: z.number().int().min(0), // paise — price per saleUnit
  stockQty: z.number().int().min(0).default(0),
  reorderPoint: z.number().int().min(0).default(0),
  sku: z.string().min(1).optional(),
  barcode: z.string().min(1).optional(),
  baseUnit: z.string().min(1).default('PCS'),
  purchaseUnit: z.string().min(1).optional(),
  purchaseUnitFactor: z.number().int().min(1).default(1),
  saleUnit: z.string().min(1).optional(),
  saleUnitFactor: z.number().int().min(1).default(1),
});
export type InventoryItemInput = z.infer<typeof inventoryItemSchema>;

export const inventoryStockAdjustSchema = z.object({
  delta: z.number().int(), // positive to add stock, negative to remove
  reason: z.string().min(1),
  unit: z.enum(['BASE', 'PURCHASE']).default('BASE'),
});
export type InventoryStockAdjustInput = z.infer<typeof inventoryStockAdjustSchema>;

export const customerSchema = z.object({
  name: z.string().min(1),
  phone: z.string().min(10).max(15),
  address: z.string().optional(),
});
export type CustomerInput = z.infer<typeof customerSchema>;

export const bikeSchema = z.object({
  regNo: z.string().min(1),
  chassisNo: z.string().min(1),
  model: z.string().min(1),
  customerId: z.string().min(1),
});
export type BikeInput = z.infer<typeof bikeSchema>;

export const serviceTicketIntakeSchema = z.object({
  bikeId: z.string().min(1),
  complaint: z.string().min(1),
  technicianId: z.string().min(1).optional(),
});
export type ServiceTicketIntakeInput = z.infer<typeof serviceTicketIntakeSchema>;

// BILLED is excluded here deliberately — it's set only by creating an
// Invoice (Phase 3), not by manual status update, so ticket/invoice state
// can't drift apart. See ServiceTicketsService.
export const serviceTicketStatusUpdateSchema = z.object({
  status: z.enum(TICKET_STATUSES.filter((s) => s !== 'BILLED') as [string, ...string[]]),
});
export type ServiceTicketStatusUpdateInput = z.infer<typeof serviceTicketStatusUpdateSchema>;

export const servicePartUsedSchema = z.object({
  inventoryItemId: z.string().min(1),
  qty: z.number().int().min(1),
});
export type ServicePartUsedInput = z.infer<typeof servicePartUsedSchema>;

// Labor/service charges recorded during the IN_SERVICE phase — distinct from
// Estimate (a pre-work quote) and what invoices are actually generated from,
// alongside ServicePartUsed. See DATABASE_SCHEMA.md's ServiceCharge note.
export const serviceChargeSchema = z.object({
  description: z.string().min(1),
  amount: z.number().int().min(0), // paise
  gstRate: z.number().int().min(0).max(10000), // basis points
});
export type ServiceChargeInput = z.infer<typeof serviceChargeSchema>;

export const estimateLineItemSchema = z.object({
  description: z.string().min(1),
  qty: z.number().int().min(1),
  unitPricePaise: z.number().int().min(0),
  gstRateBps: z.number().int().min(0).max(10000),
});
export type EstimateLineItemInput = z.infer<typeof estimateLineItemSchema>;

export const createEstimateSchema = z.object({
  lineItems: z.array(estimateLineItemSchema).min(1),
  discount: z.number().int().min(0).default(0), // paise
});
export type CreateEstimateInput = z.infer<typeof createEstimateSchema>;

export const invoiceLineItemSchema = z.object({
  inventoryItemId: z.string().min(1).optional(), // omit for a labor/service charge line
  description: z.string().min(1),
  qty: z.number().int().min(1),
  unitPrice: z.number().int().min(0), // paise
  gstRate: z.number().int().min(0).max(10000), // basis points
});
export type InvoiceLineItemInput = z.infer<typeof invoiceLineItemSchema>;

// ticketId present = billing an existing service ticket (moves it to
// BILLED) — lineItems are auto-derived server-side from the ticket's actual
// ServicePartUsed + ServiceCharge records (what was really used/charged
// during service), never from the Estimate and never from client input, so
// `lineItems` is omitted entirely for this case. customerId present (no
// ticketId) = a standalone sale, which requires lineItems directly since
// there's no ticket to derive them from.
export const createInvoiceSchema = z
  .object({
    ticketId: z.string().min(1).optional(),
    customerId: z.string().min(1).optional(),
    lineItems: z.array(invoiceLineItemSchema).optional(),
    discount: z.number().int().min(0).default(0), // paise
  })
  .refine((v) => v.ticketId || v.customerId, {
    message: 'Either ticketId or customerId is required',
  })
  .refine((v) => v.ticketId || (v.lineItems && v.lineItems.length > 0), {
    message: 'lineItems is required for a standalone sale',
  });
export type CreateInvoiceInput = z.infer<typeof createInvoiceSchema>;

// Editing a still-DRAFT standalone-sale invoice, or an Owner correcting an
// already-FINAL invoice ("revise") — see InvoicesService.update/revise.
// Ticket-based invoices reject this entirely: their lineItems are always
// re-derived from the ticket's actual ServicePartUsed/ServiceCharge records,
// never edited directly, to preserve the 2026-09-12 billing-derivation fix.
export const editInvoiceLineItemsSchema = z.object({
  lineItems: z.array(invoiceLineItemSchema).min(1),
  discount: z.number().int().min(0).default(0), // paise
});
export type EditInvoiceLineItemsInput = z.infer<typeof editInvoiceLineItemsSchema>;

// Tally-style Sales Order (2026-09-13) — a pre-invoice customer commitment,
// always a standalone lineItems array (no ticket-derivation concept, unlike
// Invoice). See SaleOrdersService.
export const saleOrderSchema = z.object({
  customerId: z.string().min(1),
  lineItems: z.array(invoiceLineItemSchema).min(1),
  discount: z.number().int().min(0).default(0), // paise
});
export type SaleOrderInput = z.infer<typeof saleOrderSchema>;

// Owner-created only (2026-09-12): the owner delegates a task to a worker,
// not a worker requesting one for themselves — see DelegationTasksController.
export const delegationTaskSchema = z.object({
  taskType: z.enum(DELEGATION_TASK_TYPES),
  payload: z.record(z.string(), z.unknown()),
  assignedToId: z.string().min(1),
});
export type DelegationTaskInput = z.infer<typeof delegationTaskSchema>;

export const delegationReviewSchema = z.object({
  status: z.enum(['APPROVED', 'REJECTED']),
});
export type DelegationReviewInput = z.infer<typeof delegationReviewSchema>;

// Payment against a FINAL invoice (2026-09-14) — see PaymentsService. No
// upper bound on amount: an overpayment/advance is allowed through and
// surfaced in the UI rather than rejected.
export const recordPaymentSchema = z.object({
  amount: z.number().int().positive(), // paise
  mode: z.enum(PAYMENT_MODES),
  reference: z.string().optional(),
});
export type RecordPaymentInput = z.infer<typeof recordPaymentSchema>;

export const voidPaymentSchema = z.object({
  reason: z.string().min(1),
});
export type VoidPaymentInput = z.infer<typeof voidPaymentSchema>;
