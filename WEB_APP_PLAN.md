# BSMS Web App Plan (Next.js)

**This is the current implementation focus.** Web app + its NestJS backend get built to full functional completeness first; React Native mobile (`MOBILE_APP_PLAN.md`) starts only after that's done — not in parallel.

Covers the web frontend only. Consumes the NestJS API. Built to match Phase 1-4 of the implementation plan (auth/RBAC → service workflow → billing/delivery → reporting).

## 1. Routing / page structure (Next.js App Router)

```
app/
  (auth)/
    login/page.tsx                  # phone + password login
  (setup)/
    setup/page.tsx                  # first-run ShowroomProfile wizard, redirected here if profile missing
  (dashboard)/                      # layout wraps everything below with sidebar/nav gated by persona
    layout.tsx                      # reads current user's personas, renders nav accordingly
    dashboard/page.tsx              # owner: sales trends, GST liability, technician performance
    inventory/
      page.tsx                      # list + search InventoryItem
      [id]/page.tsx                 # item detail/edit, stock adjustments
      new/page.tsx
    customers/
      page.tsx
      [id]/page.tsx                 # customer detail incl. their bikes + service history
    bikes/
      [id]/page.tsx                 # bike detail: reg/chassis, linked customer, service history
    service-tickets/
      page.tsx                      # list, filterable by status (intake/approved/in-service/billed/delivered)
      [id]/page.tsx                 # ticket detail — reworked 2026-09-12 to match the real front-desk
                                     # journey: complaint + Estimate (a customer-facing quote, editable
                                     # any time before billing) sit above Parts used / Service charges,
                                     # which only unlock once the ticket is IN_SERVICE (gated both in the
                                     # UI and server-side — see DATABASE_SCHEMA.md addition #5). "Bill this
                                     # ticket" only appears once at least one part or charge is recorded.
      new/page.tsx                  # intake form
    estimates/
      [ticketId]/page.tsx           # line items, GST breakup, discount, generate PDF
    invoices/
      page.tsx                      # list; "New invoice" dialog has two modes: "Bill a service ticket"
                                     # (pick an IN_SERVICE ticket; the preview and the generated invoice's
                                     # line items come from its recorded ServicePartUsed + ServiceCharge
                                     # rows, never the Estimate — fixed 2026-09-12, see DATABASE_SCHEMA.md
                                     # addition #5) and "Standalone sale" (manual customer + line items,
                                     # unchanged)
      [id]/page.tsx                 # invoice detail, reprint/export PDF
    delivery/
      page.tsx                      # tickets ready for delivery (delivery persona view)
    attendance/
      page.tsx                      # own check-in/out (all personas); owner sees all-staff view
    delegation/
      page.tsx                      # DelegationTask queue (owner: create + approve/reject) / my tasks
                                     # (staff, view-only) — creation is owner-only as of 2026-09-12: the
                                     # owner delegates a task to a worker, not a worker requesting one
    workers/
      page.tsx                      # owner-only: manage worker accounts + personas
    reports/
      page.tsx                      # GST export (GSTR-1 style), HSN-wise summary, sales reports
    audit-log/
      page.tsx                      # owner/auditor: AuditLog viewer
    settings/
      showroom-profile/page.tsx     # edit ShowroomProfile after initial setup
      database/page.tsx             # owner-only, under Advanced: embedded SQLite (default) vs external PostgreSQL connection string
      gst-slabs/page.tsx            # owner/inventory-manager: manage GST rate presets (seeded with standard Indian slabs, extensible)
```

## 2. Persona-gated navigation
Single `layout.tsx` in `(dashboard)` reads the logged-in user's `personas[]` (a user can hold multiple) and renders only the nav items each persona is allowed, matching the RBAC matrix in the plan (§5):
- Owner: everything
- Technician: inventory (if delegated), service-tickets, estimates, attendance
- Cashier: invoices, service-tickets (view), attendance
- Delivery: delivery, service-tickets (view), attendance
- Auditor: dashboard (view), reports (view), audit-log (view) — everything else hidden, read-only

Route-level guards (middleware or a `usePersona()` hook + redirect) back this up server-side too — nav hiding alone isn't enforcement.

## 3. State / data layer
- **Server state**: TanStack Query (React Query) for all API calls — list/detail fetching, mutations, cache invalidation (e.g. creating an Invoice invalidates the InventoryItem stock queries it deducted from).
- **Auth state**: JWT access token in memory + refresh token in an httpOnly cookie set by the NestJS API; a small auth context provides `currentUser` + `personas` app-wide.
- **Forms**: React Hook Form + Zod schemas shared (or mirrored) with the NestJS DTOs for validation consistency.

## 4. Key cross-cutting components
- `GstBreakupTable` — shared by Estimate, Invoice, and Reports views (CGST/SGST vs IGST display logic lives here once)
- `StatusBadge` — ServiceTicket status (intake/approved/in-service/billed/delivered)
- `PdfExportButton` — invoices/estimates → PDF, reports → Excel/CSV. **Export is web-exclusive** (per your direction, 2026-09-12) — this component and the underlying export endpoints have no mobile equivalent; see `MOBILE_APP_PLAN.md`.
- `RoleGate` — wraps UI elements to show/hide by persona, backed by the same permission check used for route guards

## 5. Build order (maps to implementation plan phases)
1. Auth pages + `(dashboard)` shell + persona-gated nav + Setup wizard (Phase 1)
2. Inventory pages (Phase 1)
3. Customers, Bikes, Service Tickets, Estimates (Phase 2)
4. Invoices, Delivery, Delegation queue (Phase 3)
5. Dashboard, Reports/GST export, Audit log (Phase 4)
6. Polish: attendance own-view, workers management, settings (fills in alongside the above as needed)

## Component library
Resolved in `UX_DESIGN_PRINCIPLES.md`: shadcn/ui on Radix + Tailwind, chosen for full visual control to hit the "clean, modern, enterprise-grade" direction rather than a heavier prebuilt kit's default look.

## PDF generation
Resolved (2026-09-12): **server-side.** NestJS generates invoice/estimate PDFs; the web app just downloads them via `PdfExportButton`. Keeps formatting logic in one place — relevant even though export itself is web-only (per the export-scope decision), since reports/GST exports live in the same server-side generation path.
