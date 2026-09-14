# BSMS — Bike Showroom Management System

Web + mobile app to manage inventory, GST-compliant billing, service history, worker accounts, attendance, and reporting for a single bike showroom. See `bike-showroom-implementation-plan.pdf` for the original plan and `TECH_STACK.md` / `DATABASE_SCHEMA.md` / `WEB_APP_PLAN.md` / `MOBILE_APP_PLAN.md` for the decisions made since.

Current status: **web app (Phases 1-4 of the plan) is implemented and tested.** Mobile app and Electron packaging are deliberately deferred until the web app is fully complete — see `MOBILE_APP_PLAN.md` / `TECH_STACK.md`.

## Prerequisites

- Node.js 24+, npm 11+
- A PostgreSQL 16 instance reachable at `localhost:5433` (dev currently reuses the `garuda-postgres` Docker container from the `autobot` project — see `TECH_STACK.md` "Local dev setup" if you need to point at a different Postgres instance instead)

## First-time setup

```bash
# From the repo root
npm install

# Build the shared package (types/Zod schemas/GST calc used by both apps)
npm run build --workspace=packages/shared

# Create the dev database schema + shadow DB (skip if already created — see TECH_STACK.md)
docker exec garuda-postgres psql -U garuda -d garuda -c "CREATE SCHEMA IF NOT EXISTS bsms AUTHORIZATION garuda;"
docker exec garuda-postgres psql -U garuda -d garuda -c "CREATE DATABASE bsms_shadow TEMPLATE template0;"

# Run migrations
cd apps/backend
npx prisma migrate dev
```

`apps/backend/.env` and `apps/web/.env.local` should already exist with the right values for the dev setup above (`DATABASE_URL`, `SHADOW_DATABASE_URL`, JWT secrets, `NEXT_PUBLIC_API_URL`). If they're missing, see `TECH_STACK.md`'s "Local dev setup" section for the exact values.

## Running it

```bash
# Terminal 1 — backend (NestJS), port 3001
npm run dev:backend

# Terminal 2 — frontend (Next.js), port 3000
npm run dev:web
```

Open http://localhost:3000 — it redirects to `/setup` on first run (no `ShowroomProfile` exists yet), or `/login` afterward.

## Running the tests

```bash
cd apps/backend
npm run test:e2e   # 33 e2e tests against an isolated bsms_test database — see TECH_STACK.md
npm test           # unit tests

cd apps/web
npm test           # component tests (Vitest + React Testing Library + jsdom)

# Also run before considering any frontend change done — it type-checks far
# more strictly than `next dev` and has caught real bugs dev mode missed:
npm run build --workspace=apps/web
```

The e2e suite uses a **separate Postgres database** (`bsms_test`), not the dev database — running it never touches your dev data. If it hasn't been created yet:

```bash
docker exec garuda-postgres psql -U garuda -d garuda -c "CREATE DATABASE bsms_test TEMPLATE template0;"
cd apps/backend
DATABASE_URL="postgresql://garuda:garuda_dev_only@localhost:5433/bsms_test?schema=bsms" npx prisma db push
```

## Project structure

```
apps/
  backend/    NestJS API (port 3001)
  web/        Next.js web app (port 3000)
packages/
  shared/     Zod schemas, TypeScript types, GST/money calc — shared by both apps
```

## Known quirks worth knowing before you dig in

These are documented in more detail in `TECH_STACK.md`, but the short version:
- Prisma 7 moved connection config to `apps/backend/prisma.config.ts` and runtime `PrismaClient` needs an explicit `@prisma/adapter-pg` driver adapter — see `apps/backend/src/prisma/prisma.service.ts`.
- `apps/backend/scripts/link-prisma-client.mjs` (a `postinstall` hook) works around an npm-workspace hoisting issue where Prisma's own CLI can't resolve a hoisted `@prisma/client`. If `prisma generate`/`migrate` fails with "Could not resolve @prisma/client", run `node scripts/link-prisma-client.mjs` manually.
- Never attach a validation pipe via method-level `@UsePipes()` on a NestJS controller method that also takes a `@Param()`/`@Query()` — it validates those too, not just `@Body()`, and breaks with "Expected object, received string". Always scope pipes to `@Body(pipe)` directly.
- Money is stored as **integer paise** everywhere (never `Decimal`/`Float`), and GST rates as **integer basis points** (`1800` = `18.00%`) — see `DATABASE_SCHEMA.md`.
