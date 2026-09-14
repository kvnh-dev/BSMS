# BSMS — Finalized Tech Stack & Hosting Decisions

Supersedes the "Recommended Tech Stack" table in `bike-showroom-implementation-plan.pdf` §2 where they differ.

| Layer | Decision |
|---|---|
| Backend | NestJS (Node.js/TypeScript) |
| Database | **Configurable**: SQLite (embedded, bundled — default) or PostgreSQL (external, installed separately) — see below |
| ORM | Prisma |
| Web frontend | React (Next.js) |
| Mobile | React Native (built after web app reaches full functionality — see `MOBILE_APP_PLAN.md`) |
| Auth | JWT + refresh tokens, RBAC (per plan §5) |
| Packaging | **Electron desktop app** — single installer (.exe/.dmg), bundles the NestJS backend + Next.js UI + SQLite. No end-user setup of Node/Postgres/services. Must be usable by a non-technical owner end-to-end — see `INSTALLATION_UX.md`. |
| Repo layout | Monorepo (npm/pnpm workspaces) — backend, web, and (later) mobile share TypeScript types/DTOs |
| Remote access | LAN-only at launch — other devices in the shop reach the installed machine's local server over WiFi; VPN (e.g. Tailscale) is a candidate for a later phase, not built now. |
| Backups | Automated nightly job: copy the SQLite database file + uploaded files (logos, generated invoice/report PDFs) to Google Drive |

## Revision history
- **2026-09-12, initial:** self-hosted on a local machine, manually set up, PostgreSQL.
- **2026-09-12, revised:** packaged as an Electron desktop app instead, so the showroom owner just runs an installer rather than setting up Node/Postgres/services by hand. This forced a database change (below).
- **2026-09-12, revised again:** database made **configurable** rather than SQLite-only — default install still uses embedded SQLite (zero setup), but PostgreSQL can be installed separately and pointed at, for a showroom that outgrows single-writer SQLite (multi-branch, multiple simultaneous billing counters at high volume).
- **2026-09-12, sequencing:** Electron packaging itself is **deferred to the last implementation phase**. Development and initial delivery run as a plain web app (NestJS on a port + Next.js on a port, no desktop shell) on the dev machine (currently a Mac). All the Electron/installer/non-technical-UX decisions above remain the target end state — they just aren't built until everything else works. Dev database for this phase: PostgreSQL, not SQLite (see "Local dev setup" below) — SQLite gets wired up alongside the eventual Electron packaging work.

## Why Electron for packaging
NestJS backend code is already Node.js — Electron's main process *is* Node, so the backend runs directly inside the desktop app with no extra runtime to bundle or a compiled sidecar binary. (Tauri was the other option surfaced, but Tauri apps are Rust-first; running a Node/NestJS backend inside one means shipping Node as a separate sidecar executable — more packaging complexity for no real benefit here.) The Next.js frontend is served by the same local server the Electron shell wraps.

## Why SQLite by default, with PostgreSQL as an escape hatch
Desktop-app packaging needs a database with **nothing extra to install** for the default path — PostgreSQL would mean bundling and auto-starting a full Postgres server process inside the installer, which is heavier and more fragile across OSes. SQLite ships as a single file embedded directly in the app. For single-showroom scale (low concurrent write volume — a handful of staff, not hundreds), SQLite in WAL mode handles this comfortably (see the concurrency discussion this decision came from — SQLite serializes writes one-at-a-time, which is invisible at this usage level but a real limit worth an escape hatch for).

That escape hatch is: install PostgreSQL separately (a normal Postgres server, not bundled) and point BSMS at it instead, for a showroom that outgrows SQLite — multi-branch, or several billing counters firing high-volume concurrent writes.

**How "configurable" actually works with Prisma:** Prisma ties a generated client to one `provider` per schema file — there's no single schema that runs against both SQLite and Postgres at runtime via just an env var. So the model definitions are written to the **subset both providers support** (see `DATABASE_SCHEMA.md`'s conventions below), and there are two thin schema files differing only in their `datasource` block:
- `prisma/schema.sqlite.prisma` (default)
- `prisma/schema.postgres.prisma` (opt-in)

A first-run/settings choice (embedded vs. external Postgres connection string) picks which generated client the NestJS app loads, and each provider keeps its own Prisma migration history folder.

**Tradeoffs accepted from designing to the shared subset (applies even when running on Postgres):**
- No native enum or array column types (SQLite lacks both) → `DATABASE_SCHEMA.md` uses `String` fields (validated at the app layer) and a join table instead of `Persona[]`.
- Money is stored as **integer paise**, not `Decimal`, since Prisma's SQLite connector has no native decimal type — this is arguably better practice regardless of DB (avoids float rounding errors in GST/invoice math). See `DATABASE_SCHEMA.md` for the full convention.
- Advanced relational reporting queries Postgres would make easy are still doable in SQLite for this data volume; nothing in the plan's reporting requirements (GST export, sales trends) needs Postgres-specific features, so giving them up on the Postgres side too costs nothing.

## Implications this creates for the build
- Deployment = the Electron installer itself; no CI/CD pipeline to a cloud target, no systemd/pm2 service management.
- The installed machine runs both the Electron app (one client) and the local HTTP server other shop devices connect to over LAN via browser — the "server" isn't a separate headless machine, it's whichever machine has BSMS installed and running.
- Mobile app (React Native, built later) points at that machine's LAN IP, same as before.
- Backup job branches on active provider: copies the SQLite file when embedded, or runs `pg_dump` when pointed at an external Postgres — either way, + the uploads folder, to Google Drive nightly. Needs Drive API credentials configured on first run — a Phase 1/Phase 4 setup task.
- A "Database" section in Settings (Owner-only) exposes the embedded-vs-external choice and, when external, the Postgres connection string — this is new scope beyond the original plan's Settings page (`WEB_APP_PLAN.md`'s `settings/showroom-profile`), worth adding as `settings/database`.

## Local dev setup (current phase)
- **Monorepo**: npm workspaces, `apps/backend` (NestJS), `apps/web` (Next.js), `packages/shared` (types/Zod schemas/GST calc, consumed by both).
- **Backend**: NestJS app in `apps/backend`, run directly with `npm run start:dev` — no Electron shell. Runs on port 3001 (`.env`).
- **Frontend**: Next.js app in `apps/web`, run directly with `npm run dev`.
- **Database**: an existing local PostgreSQL instance at `localhost:5433` (the `garuda-postgres` Docker container from the `autobot` project) is reused for dev rather than standing up a separate Postgres — a dedicated `bsms` schema was created inside its `garuda` database to keep BSMS's tables fully isolated from garuda's own (`auth`, `core`, `insight`, `orchestrator`, `policy` schemas already follow this same one-schema-per-service pattern in that instance). `DATABASE_URL=postgresql://garuda:garuda_dev_only@localhost:5433/garuda?schema=bsms`.
- **Shadow database**: Prisma's `migrate dev` needs a shadow DB to compute diffs. The shared container's `template1` has a Postgres collation-version mismatch (an OS/glibc drift unrelated to BSMS) that breaks Prisma's auto-created shadow DB — rather than touching `template1` on a container another project depends on, a dedicated `bsms_shadow` database was created manually (`CREATE DATABASE bsms_shadow TEMPLATE template0`) and wired via `SHADOW_DATABASE_URL` in `prisma.config.ts`.
- **Prisma 7 config**: connection URLs no longer live in `schema.prisma`'s `datasource` block (a Prisma 7 breaking change) — they're in `apps/backend/prisma.config.ts`. Runtime `PrismaClient` uses the `@prisma/adapter-pg` driver adapter explicitly (see `apps/backend/src/prisma/prisma.service.ts`), not an implicit env-var connection.
- **Known npm-workspace quirk**: Prisma's CLI resolves `@prisma/client`'s location relative to `prisma/schema.prisma`'s directory without walking up through npm's hoisted `node_modules` the way Node itself does — it fails to find a hoisted `@prisma/client`. Fixed with a `postinstall` script (`apps/backend/scripts/link-prisma-client.mjs`) that symlinks it locally wherever it actually resolves, so this self-heals on any machine after `npm install` rather than needing a manual fix each time.
- Prisma schema used for dev is the PostgreSQL variant (`apps/backend/prisma/schema.prisma`, using Prisma's multi-schema feature to target `bsms`) per `DATABASE_SCHEMA.md`'s dual-provider approach — the SQLite variant is built later alongside Electron packaging.
- electron-builder (or Forge) handles producing the installer. Target OS not yet confirmed (2026-09-12) — defaulting to **Windows-only** build tooling for now (most common for small-business desktop setups in India) since it's unconfirmed; revisit before packaging work actually starts, since adding Mac later just means enabling a second electron-builder target, not a rework.

## Backend e2e tests
- `apps/backend/test/*.e2e-spec.ts`, run with `npm run test:e2e --workspace=apps/backend` (Vitest, config: `vitest.config.e2e.ts`).
- Runs against a **fully separate Postgres database** (`bsms_test`, same shared instance, `bsms` schema inside it) — not just a different schema name, since every Prisma model hardcodes `@@schema("bsms")`, so schema-name isolation alone wouldn't separate it from dev data. Created once via `DATABASE_URL=...bsms_test... npx prisma db push` (no migration history needed for a throwaway test DB).
- `test/global-setup.ts` truncates and reseeds this database once per full test run (a showroom profile + one seeded user per persona, credentials in that file) — individual spec files log in as these fixed users rather than re-running the setup wizard. `fileParallelism: false` in the vitest config because spec files share this one database sequentially.
- Covers: setup/auth/RBAC, inventory + audit logging, the full service ticket lifecycle (intake → parts → estimate → status transitions), invoice billing (numbering, double-billing rejection, standalone sales, delivery RBAC), delegation task approval, and reports (including a regression test for the date-range boundary bug below).
