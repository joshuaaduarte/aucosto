# aucosto

aucosto is a personal daily dashboard: a hub for tools that help Joshua run day-to-day life with less friction.

Right now it is centered on two practical tools:
- **calendar / planning blocks**
- **time tracking**
- **finance imports and review**

Under the hood, it is being shaped to grow into a broader personal operations system with:
- a shared event log
- clear service boundaries between tools
- a dashboard/home hub for daily use
- a future agent/API surface built on top of the same service layer

## Current product shape

### Time tracker
- one running timer at a time
- recent completed entries
- category support
- server-action based mutations

### Calendar
- native personal calendar blocks
- today agenda + week view
- signals informed by time + finance context
- foundation for future external calendar sync

### Finance
- CSV import for transactions
- Teller-based read-only bank linking for balances + transactions
- recent transaction list
- money stored as integer cents
- foundation for monthly summaries and safer import workflows

### Hub
- widget-based dashboard under `/app`
- each tool registers a widget
- intended to become the daily command center

## Tech stack

- **Next.js 16.2** (App Router)
- **React 19**
- **Prisma 7**
- **Auth.js v5 beta**
- **Tailwind 4**
- **Supabase Postgres**
- **Vitest**
- **Pino**

## Architecture notes

A few repo rules matter a lot here:

### 1. Service layer is the chokepoint
Tool code should go through `src/lib/services/<tool>.ts`.

App pages, widgets, server actions, and future API routes should **not** scatter direct `prisma.<model>` usage across the codebase. This keeps each tool easier to evolve.

### 2. Event log is shared across tools
Meaningful mutations write to the `Event` table.

This is the backbone for:
- recent activity feeds
- cross-tool timelines
- future summaries and agent-friendly traces

### 3. Widgets are the dashboard contract
The hub renders from `src/lib/widgets/index.tsx`.

Each tool can expose a widget and become visible on the dashboard without hand-wiring the home page each time.

### 4. Agent/API work is deferred on purpose
The repo is being prepared for future external/agent access, but that surface should stay small and deliberate until the first tools feel solid.

## Repo layout

```text
src/
  app/
    app/
      finance/
      calendar/
      time/
    api/auth/[...nextauth]/
    login/
  lib/
    auth/
    services/
    widgets/
  auth.ts
  auth.config.ts
  proxy.ts

prisma/
  schema/
    core.prisma
    events.prisma
    finance.prisma
    calendar.prisma
    time.prisma
  migrations/
  seed.ts

scripts/
  smoke.ts

tests/
  csv.test.ts
```

## Getting started

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment
Copy `.env.example` to `.env` and fill in the values.

Required variables:

```bash
DATABASE_URL=...
DIRECT_URL=...
AUTH_SECRET=...
SEED_USER_EMAIL=...
SEED_USER_PASSWORD=...
SEED_USER_NAME=...
TELLER_ENV=development
TELLER_APPLICATION_ID=...
TELLER_WEBHOOK_SIGNING_SECRETS=...
TELLER_CERT_PEM=...
TELLER_PRIVATE_KEY_PEM=...
```

Notes:
- `DATABASE_URL` is the **runtime** connection string used by the app and Prisma client
- for Supabase, this should be the **transaction pooler / pooled runtime URL**
- `DIRECT_URL` is used for **Prisma migrations**
- for Supabase, this should be the **session pooler / direct migration URL**
- `DIRECT_URL` falls back to `DATABASE_URL` if omitted, but explicit is safer
- seed values are used by `prisma/seed.ts`
- `AUTH_SECRET` should be a long random secret
- Teller linking is optional; when enabled, linked-account access tokens are encrypted at rest using `AUTH_SECRET`
- Teller development/production requests require the client certificate + private key from the Teller dashboard
- Teller webhooks should point at `/api/teller/webhook`; use `TELLER_WEBHOOK_SIGNING_SECRETS` for one or more active webhook signing secrets

### 3. Generate client + run migrations

```bash
npm run db:generate
npm run db:migrate
```

### 4. Seed the single user

```bash
npm run db:seed
```

### 5. Start the app

```bash
npm run dev
```

Then open <http://localhost:3000>.

## Useful commands

```bash
npm run dev          # start Next dev server
npm run build        # prisma generate + production build
npm run lint         # eslint
npm test             # vitest once
npm run test:watch   # vitest watch mode
npm run db:migrate   # prisma migrate dev
npm run db:generate  # regenerate Prisma client
npm run db:seed      # seed the single local user
npm run db:studio    # Prisma Studio
npm run smoke        # non-destructive smoke verification
npm run smoke:demo   # replace seeded-user finance/time data with demo fixtures
```

## Smoke path

There is a lightweight dev smoke script at:

```bash
scripts/smoke.ts
```

### Safe default

```bash
npm run smoke
```

This mode is **non-destructive**. It verifies:
- seeded-user lookup
- CSV parsing
- current finance row count
- current time row count

### Explicit demo-data mode

```bash
npm run smoke:demo
```

This mode is **destructive for the seeded user**. It replaces that user's finance/time data with demo fixtures so the app has known sample state.

## Testing

Current automated test coverage is light and centered on finance CSV parsing:

```bash
npm test
```

As aucosto grows, the next valuable areas for tests are:
- time tracker behavior
- finance import safety / duplicate handling
- service-layer business rules

## Product direction

The near-term goal is simple:

**make aucosto worth opening every morning.**

That means:
- dependable time tracking
- useful finance visibility
- a dashboard that tells you something meaningful at a glance
- one or two more carefully chosen tools, not a pile of half-built ones

See `ROADMAP.md` for the phased plan.

## Working in this repo

If you are building here, a few rules matter:
- verify framework behavior instead of assuming older Next.js conventions
- prefer extending the service layer over adding ad hoc data access
- keep money values in integer minor units
- keep the dashboard cohesive; don’t let it turn into a random widget junk drawer
- don’t prematurely build the full agent/API layer

## Status

aucosto is already more than a scaffold, but it is still early.

The foundation is promising. The next job is to turn it from a well-structured prototype into a tool that earns daily use.
