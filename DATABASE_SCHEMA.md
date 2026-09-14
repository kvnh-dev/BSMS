# BSMS Database Schema (Prisma, dual-provider: SQLite default / PostgreSQL optional)

Expands the entity list from `bike-showroom-implementation-plan.pdf` §4 into a full Prisma schema. Additions beyond the original entity list, and adjustments made for dual SQLite/PostgreSQL support, are called out explicitly — review before we scaffold.

## Why this schema looks the way it does
Per `TECH_STACK.md`, the database is **configurable**: embedded SQLite by default (bundled in the Electron installer, zero setup), or an externally-installed PostgreSQL for showrooms that outgrow SQLite's single-writer model. Prisma generates a client per `provider`, so there is no one schema file that runs on both — instead, the model definitions below are written using **only the subset of Prisma features both providers support**, and get dropped into two thin schema files that differ solely in their `datasource` block:

- `prisma/schema.sqlite.prisma` — `datasource db { provider = "sqlite", url = env("DATABASE_URL") }`
- `prisma/schema.postgres.prisma` — `datasource db { provider = "postgresql", url = env("DATABASE_URL") }`

Each keeps its own migration history (`prisma/migrations-sqlite/`, `prisma/migrations-postgres/`). Which one the NestJS app loads at runtime is driven by the Owner's choice in Settings → Database (`WEB_APP_PLAN.md`'s `settings/database`).

**What had to change to fit the shared subset (SQLite is the limiting provider):**
1. **No native enums.** SQLite has no enum type, so `Persona`, `TicketStatus`, `DelegationStatus` are `String` fields instead, validated by Zod/class-validator at the NestJS DTO layer. Allowed values are documented as comments next to each field.
2. **No scalar list/array columns.** SQLite can't store `Persona[]` directly (Prisma arrays require Postgres/CockroachDB). Introduced a `UserPersona` join table instead — this is also just cleaner relationally (easy "find all technicians" queries).
3. **Money as integer paise, not `Decimal`.** Prisma's SQLite connector has no native decimal type. All money fields (`unitPrice`, `priceAtUse`, `estimateAmount`, `actualAmount`, `discount`, `total`) are `Int` storing the smallest currency unit (paise) — ₹1,234.50 is stored as `123450`. This avoids float rounding errors on both providers, so it's a net improvement, not just a compromise.
4. **GST rates as basis points, not `Decimal`.** Same reasoning — `gstRate` (on `InventoryItem`/line items) and `GstSlab.rate` are `Int` where `1800` means `18.00%`.
5. **No `@db.Decimal` / `@db.Date` native-type attributes** — these are provider-specific attributes Prisma doesn't accept for SQLite; removed everywhere.

**Additions beyond the original plan's entity list (unrelated to the SQLite/Postgres split, flagging separately):**
1. **`InvoiceLineItem`** — the plan's `Invoice` entity had no line-item model, only a total + GST breakup. A standalone sale (not tied to a `ServiceTicket`) needs itemized lines referencing `InventoryItem`, so line items get their own table rather than a JSON blob, for reporting joins (e.g. "units of item X sold this month").
2. **`Invoice.customerId`** — made required and direct (not only reachable via `ticket → bike → customer`), so standalone sales have a customer without a ticket, and invoice reporting doesn't need a conditional join path.
3. **`ShowroomProfile.invoiceSeq`** — an integer counter alongside the prefix, so invoice numbering (`SHW-2026-0001`) is generated atomically rather than computed by counting existing invoices.
4. **`GstSlab`** — the plan's setup wizard (§3) implied one hardcoded default GST rate; per your direction (2026-09-12) this is instead a configurable, extensible list of presets. Seeded on first run with the standard Indian slabs (0%, 0.25%, 3%, 5%, 12%, 18%, 28%) with the two-wheeler-relevant one marked `isDefault`; Owner/inventory-manager personas can add more from Settings. `InventoryItem.gstRate` and line-item `gstRate` fields still store the actual applied rate directly (not a foreign key to `GstSlab`) — the slab list is just a UI convenience for picking/pre-filling that value, and keeping the applied rate denormalized means a later edit to a slab's rate can't silently change the tax already recorded on past items/invoices.
5. **`ServiceCharge`, and `ServicePartUsed.gstRateAtUse`** — added 2026-09-12 to fix a workflow gap: `Estimate` is a pre-work quote shown to the customer (informational only, never touches inventory), while `ServicePartUsed` records what's actually consumed once a technician starts work. There was no equivalent for labor/service charges, and billing was reading straight from `Estimate`, letting the invoiced amount diverge from what was really done. Now: intake → estimate (inform the customer) → customer approves → ticket moves `IN_SERVICE` → technician records the *actual* `ServicePartUsed` and `ServiceCharge` rows (both gated server-side to `IN_SERVICE` — see `ServiceTicketsService.assertInService`) → billing (`InvoicesService.create`) derives the invoice's line items exclusively from those two tables, never from `Estimate` and never from client-supplied line items. `ServicePartUsed` also gained `gstRateAtUse` (alongside the existing `priceAtUse`) so a later change to an item's GST rate can't retroactively change tax already recorded on a past service.

## Shared model definitions

```prisma
generator client {
  provider = "prisma-client-js"
}

// datasource block differs per file — see note above:
// schema.sqlite.prisma:   datasource db { provider = "sqlite",     url = env("DATABASE_URL") }
// schema.postgres.prisma: datasource db { provider = "postgresql", url = env("DATABASE_URL") }

/// Single row for now (single showroom). Becomes a normal multi-row
/// table if multi-branch is ever built — see plan §9 open items.
model ShowroomProfile {
  id                String   @id @default(cuid())
  name              String
  logoUrl           String?
  address           String
  contactNumber     String
  email             String
  gstin             String
  pan               String
  state             String
  invoicePrefix     String   // e.g. "SHW"
  invoiceSeq        Int      @default(0) // incremented atomically per invoice
  currency          String   @default("INR")
  locale            String   @default("en-IN")
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
}

/// Configurable GST rate presets, so the Owner/inventory manager picks a
/// slab per item instead of the app hardcoding one default. Seeded on
/// first run with the standard Indian slabs; fully editable/extensible
/// after that — see note below.
model GstSlab {
  id         String   @id @default(cuid())
  label      String   // e.g. "Standard - Two-wheelers", "Spare parts"
  rate       Int      // basis points, e.g. 2800 = 28.00%
  isDefault  Boolean  @default(false) // pre-selected in "Add Inventory Item"
  createdAt  DateTime @default(now())

  @@index([isDefault])
}

model User {
  id                    String            @id @default(cuid())
  name                  String
  phone                 String            @unique
  passwordHash          String
  isActive              Boolean           @default(true)
  createdAt             DateTime          @default(now())
  updatedAt             DateTime          @updatedAt

  personas              UserPersona[]
  attendances           Attendance[]
  ticketsAsTechnician   ServiceTicket[]   @relation("TechnicianTickets")
  estimatesCreated      Estimate[]
  invoicesAsCashier     Invoice[]
  tasksAssigned         DelegationTask[]  @relation("AssignedTasks")
  tasksReviewed         DelegationTask[]  @relation("ReviewedTasks")
  auditLogs             AuditLog[]
}

/// Replaces Persona[] (arrays aren't portable to SQLite). A staff account
/// can hold multiple personas, per plan §1.
model UserPersona {
  id       String  @id @default(cuid())
  userId   String
  user     User    @relation(fields: [userId], references: [id])
  persona  String  // one of: OWNER | TECHNICIAN | CASHIER | DELIVERY | AUDITOR

  @@unique([userId, persona])
  @@index([persona])
}

model Attendance {
  id        String    @id @default(cuid())
  userId    String
  user      User      @relation(fields: [userId], references: [id])
  date      DateTime  // truncated to the day at the app layer
  checkIn   DateTime
  checkOut  DateTime?

  @@index([userId, date])
}

model InventoryItem {
  id            String              @id @default(cuid())
  name          String
  category      String
  hsnCode       String
  gstRate       Int                 // basis points, e.g. 1800 = 18.00%
  unitPrice     Int                 // paise
  stockQty      Int                 @default(0)
  reorderLevel  Int                 @default(0)
  createdAt     DateTime            @default(now())
  updatedAt     DateTime            @updatedAt

  partsUsed     ServicePartUsed[]
  lineItems     InvoiceLineItem[]

  @@index([hsnCode])
  @@index([category])
}

model Customer {
  id        String   @id @default(cuid())
  name      String
  phone     String
  address   String?
  createdAt DateTime @default(now())

  bikes     Bike[]
  invoices  Invoice[]

  @@index([phone])
}

model Bike {
  id          String          @id @default(cuid())
  regNo       String          @unique
  chassisNo   String          @unique
  model       String
  customerId  String
  customer    Customer        @relation(fields: [customerId], references: [id])

  serviceTickets ServiceTicket[]
}

model ServiceTicket {
  id              String           @id @default(cuid())
  bikeId          String
  bike            Bike             @relation(fields: [bikeId], references: [id])
  technicianId    String?
  technician      User?            @relation("TechnicianTickets", fields: [technicianId], references: [id])
  complaint       String
  estimateAmount  Int?             // paise
  actualAmount    Int?             // paise
  status          String           @default("INTAKE") // INTAKE | APPROVED | IN_SERVICE | BILLED | DELIVERED
  createdAt       DateTime         @default(now())
  updatedAt       DateTime         @updatedAt

  partsUsed       ServicePartUsed[]
  serviceCharges  ServiceCharge[]
  estimate        Estimate?
  invoice         Invoice?

  @@index([status])
}

/// The actual parts consumed during service — only ever created once the
/// ticket is IN_SERVICE (see addition #5 above). Distinct from `Estimate`,
/// which is a pre-work quote and never touches inventory or billing.
model ServicePartUsed {
  id              String        @id @default(cuid())
  ticketId        String
  ticket          ServiceTicket @relation(fields: [ticketId], references: [id])
  inventoryItemId String
  inventoryItem   InventoryItem @relation(fields: [inventoryItemId], references: [id])
  qty             Int
  priceAtUse      Int           // paise, captured at time of use
  gstRateAtUse    Int           // basis points, captured at time of use
  createdAt       DateTime      @default(now())
}

/// Labor/service charges recorded during IN_SERVICE — the counterpart to
/// ServicePartUsed for non-inventory work. Added 2026-09-12 (see addition #5).
model ServiceCharge {
  id          String        @id @default(cuid())
  ticketId    String
  ticket      ServiceTicket @relation(fields: [ticketId], references: [id])
  description String
  amount      Int           // paise
  gstRate     Int           // basis points
  createdAt   DateTime      @default(now())
}

model Estimate {
  id            String        @id @default(cuid())
  ticketId      String        @unique
  ticket        ServiceTicket @relation(fields: [ticketId], references: [id])
  lineItems     Json          // [{ description, qty, unitPricePaise, gstRateBps }]
  gstBreakup    Json          // { cgstPaise, sgstPaise, igstPaise }
  discount      Int           @default(0) // paise
  createdById   String
  createdBy     User          @relation(fields: [createdById], references: [id])
  createdAt     DateTime      @default(now())
}

model Invoice {
  id              String            @id @default(cuid())
  invoiceNumber   String            @unique // formatted from ShowroomProfile prefix+seq
  ticketId        String?           @unique // null for a standalone sale
  ticket          ServiceTicket?    @relation(fields: [ticketId], references: [id])
  customerId      String
  customer        Customer          @relation(fields: [customerId], references: [id])
  lineItems       InvoiceLineItem[]
  gstBreakup      Json              // { cgstPaise, sgstPaise, igstPaise }
  discount        Int               @default(0) // paise
  total           Int               // paise
  cashierId       String
  cashier         User              @relation(fields: [cashierId], references: [id])
  createdAt       DateTime          @default(now())

  @@index([createdAt])
}

/// Added beyond the original plan — see note at top of file.
model InvoiceLineItem {
  id              String         @id @default(cuid())
  invoiceId       String
  invoice         Invoice        @relation(fields: [invoiceId], references: [id])
  inventoryItemId String?        // null if it's a labor/service charge line, not a part
  inventoryItem   InventoryItem? @relation(fields: [inventoryItemId], references: [id])
  description     String
  qty             Int
  unitPrice       Int            // paise
  gstRate         Int            // basis points
}

model DelegationTask {
  id            String    @id @default(cuid())
  assignedToId  String
  assignedTo    User      @relation("AssignedTasks", fields: [assignedToId], references: [id])
  taskType      String    // e.g. "INVENTORY_EDIT", "DISCOUNT_OVERRIDE"
  payload       Json      // the requested change, shape depends on taskType
  status        String    @default("PENDING") // PENDING | APPROVED | REJECTED
  reviewedById  String?
  reviewedBy    User?     @relation("ReviewedTasks", fields: [reviewedById], references: [id])
  reviewedAt    DateTime?
  createdAt     DateTime  @default(now())

  @@index([status])
}

model AuditLog {
  id        String   @id @default(cuid())
  actorId   String
  actor     User     @relation(fields: [actorId], references: [id])
  action    String   // e.g. "INVENTORY_UPDATE", "INVOICE_CREATE"
  entity    String   // e.g. "InventoryItem"
  entityId  String
  before    Json?
  after     Json?
  timestamp DateTime @default(now())

  @@index([entity, entityId])
  @@index([timestamp])
}
```

## Enforcing the "allowed string values" that used to be enums
Since `Persona`, `ServiceTicket.status`, and `DelegationTask.status` are now plain `String` columns (no DB-level enum constraint on either provider, to keep them identical), validity is enforced only in the NestJS layer:
- Zod schemas / class-validator `@IsIn([...])` decorators on every DTO that writes these fields.
- A shared TypeScript union type + `as const` array of allowed values, imported by both the validation layer and the frontend (so dropdowns, badges, etc. can't drift from what the backend accepts) — lives in the shared workspace package per `WEB_APP_PLAN.md`/`MOBILE_APP_PLAN.md`'s shared-code note.

## Notes on GST calc
`gstBreakup` is stored as JSON (`{ cgstPaise, sgstPaise, igstPaise }`) rather than separate columns, but per your direction (2026-09-12) this showroom's customers are local-only — **CGST/SGST always applies, `igstPaise` is always `0`.** No `state` field on `Customer`/`Bike`, and no inter-state branching logic in the GST calc for v1. If this ever changes (an out-of-state customer shows up), the JSON shape already has room for `igstPaise` to be populated without a schema migration — only the calc logic and a `Customer.state` field would need adding then.

## Migration/seed notes
- `ShowroomProfile` is seeded once via the Phase 1 setup wizard (not a Prisma seed script) — see plan §3.
- Switching a running installation from embedded SQLite to external PostgreSQL (or vice versa) is a data migration, not just a config flip — needs an export/import tool (dump all tables from one provider's client, insert via the other's) since Prisma migration history is provider-specific. Worth building as a one-off CLI script when `settings/database` ships, not a live/automatic conversion.
- Tally migration (plan §6) lands data into `InventoryItem` (opening stock) and needs a one-off `Customer`/`Bike` backfill if historical service records are migrated too — not modeled above since the plan only mentions stock/ledger import, not historical tickets. Flag if historical service history import is actually wanted.
