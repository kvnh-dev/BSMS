# BSMS Mobile App Plan (React Native)

**Sequencing: built after the web app is feature-complete**, not in parallel. All personas will use the web app (including on shop-floor tablets/phones via the browser if needed) until the full functionality list is done; React Native development starts only once `WEB_APP_PLAN.md`'s build order is finished. This supersedes the "usable subset ships earlier" framing below — kept here for reference on *what* to build, not *when* to start it.

Same NestJS API as the web app, same LAN-only server (see `TECH_STACK.md`). Mobile is used on the shop floor by Technician, Cashier, and Delivery personas primarily — Owner gets a lighter read-mostly view.

## 1. Why mobile matters most for these three personas
- **Technician**: walks the floor, needs to pull up a bike's service history and log parts used without going to a desktop.
- **Cashier**: generates invoices at a counter — could be a tablet register, but a phone works too.
- **Delivery**: confirms handoff to the customer, ideally right at the bike, not back at a desk.

Owner/Auditor read-heavy work (dashboards, reports, GST export) is comfortable on web/desktop and lower priority on mobile.

**Export is a web-only feature (per your direction, 2026-09-12).** Mobile has no export/download/print-to-file option anywhere — not for invoices/estimates (PDF) and not for reports (Excel/CSV/GST export). Mobile can still *display* an invoice or estimate it created (e.g. a cashier reviewing what they just generated), but there is no export/share/download action attached to that view. Anyone who needs a physical or exported copy uses the web app.

## 2. Navigation structure (React Navigation)

```
RootNavigator
  AuthStack (unauthenticated)
    Login
  AppTabs (authenticated, tabs shown filtered by persona)
    ServiceTab (Technician)
      ServiceTicketList
      ServiceTicketDetail
      NewServiceTicket (intake)
      PartsUsedEntry
    BillingTab (Cashier)
      InvoiceList
      NewInvoice (from ticket or standalone sale)
      InvoiceDetail
    DeliveryTab (Delivery)
      ReadyForDeliveryList
      DeliveryConfirm
    AttendanceTab (all personas)
      CheckInOut
    MoreTab
      MyDelegationTasks
      Profile / Logout
      (Owner only) OwnerSummary — lightweight dashboard read view
```

Tabs are built dynamically from the user's `personas[]`, same gating logic as web's `RoleGate`, driven by the same API-side RBAC so there's one source of truth for who can do what.

## 3. Connectivity (LAN-only constraint)
Per `TECH_STACK.md`, the server has no public endpoint — the app must be on the shop WiFi to reach it.
- App config screen (or first-run setup) lets the device store the server's LAN IP/hostname (e.g. `http://192.168.1.50:3000`) — no hardcoded API URL, since it's not a public domain.
- Show a clear "not connected to shop network" state rather than a generic network-error screen, since staff won't otherwise know why the app has stopped working when they step outside WiFi range.
- No offline-first sync in v1 — out of scope until LAN-only proves insufficient (matches the "LAN-only for now" hosting decision).

## 4. State / data layer
- Same TanStack Query approach as web, for consistency and easy logic-sharing.
- Auth: JWT stored in secure storage (`react-native-keychain` or Expo SecureStore), refresh flow mirrors the web client.
- Shared code candidate: API client, Zod validation schemas, GST calculation logic, and TypeScript types can live in a shared package/workspace (e.g. a monorepo with `packages/shared`) consumed by both Next.js and React Native — worth setting up early since NestJS is already TypeScript, so all three apps can share types end-to-end.

## 5. Device/hardware considerations
- Barcode/QR scanning for InventoryItem lookup — nice-to-have, not in the original plan; flag as an open item if you want it.
- Camera access for attaching photos to a ServiceTicket (bike condition at intake) — also not in the original plan's data model; would need a field added to `ServiceTicket` if wanted.
- Invoice/estimate detail screens render the same data read-only in native components (not a rendered PDF) — since export is web-only (see above), there's no need for a PDF viewer/WebView on mobile at all.

## 6. Build order
Starts only after the web app covers all functionality (see sequencing note above). Once started:
1. Login + persona-gated tabs shell + Attendance check-in/out
2. Service ticket list/detail/intake + parts-used entry
3. Invoice creation/detail for Cashier
4. Delivery confirmation flow
5. Delegation task list (My Requests)
6. Full parity pass + owner summary view + hardening

## Open questions for you
- Expo (managed) vs. bare React Native CLI? Expo is faster to get running and fine for LAN-only use without exotic native modules; bare RN needed only if the barcode/camera features above turn out to need something Expo doesn't support well. Leaning Expo unless you know of a reason not to.
- Should Owner get a mobile presence at all in v1, or is web-only fine for that persona until Phase 5?
