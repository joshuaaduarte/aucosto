## CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Project

aucosto is a personal day-to-day dashboard / hub of tools (time tracking, finance, more to come). Single-user for now; partner may get scoped finance access later. Designed so that external agents (e.g. openclaw) can eventually read/write through token-authenticated API endpoints — but the agent surface is **deferred until the first tool ships**. Don't pre-build it.

## Stack (all bleeding-edge — verify, don't assume)

- **Next.js 16.2** (App Router, Turbopack, React 19.2)
- **Prisma 7** (`prisma-client` generator → `src/generated/prisma/`, requires explicit driver adapter at client construction)
- **Auth.js v5 beta** (Credentials + JWT sessions; Prisma adapter present so adding OAuth later is a no-migration change)
- **Tailwind 4** (CSS-based config in `globals.css` via `@theme inline`; no `tailwind.config.*` file)
- **Supabase Postgres + `@prisma/adapter-pg`**. `DATABASE_URL` is the transaction pooler (runtime); `DIRECT_URL` is the session pooler (used only by `prisma migrate` — the transaction pooler can't run prepared statements). Both live in `.env` and are read in `prisma.config.ts`.
- **Pino** for structured JSON logging. **Vitest** for unit tests (`tests/`).

Three Next.js 16 / Prisma 7 gotchas that bit during scaffolding and will bite again:

1. `middleware.ts` is renamed to `proxy.ts`. Must export `proxy` or a default function — destructured re-exports may not be detected.
2. Prisma 7 does **not** accept `url = env("...")` in `schema.prisma`. The URL lives in `prisma.config.ts`, and the runtime client requires a driver adapter (`new PrismaClient({ adapter: new PrismaPg({ connectionString }) })`).
3. Tailwind 4 uses `@import "tailwindcss"` and `@theme inline` blocks — no JS config file to edit.

## Commands

```bash
npm run dev          # Next.js dev server (Turbopack) on :3000
npm run build        # production build (also runs type/lint checks)
npm run lint         # eslint
npm test             # vitest run — runs once
npm run test:watch   # vitest in watch mode
npm run db:migrate   # prisma migrate dev — creates/applies migrations
npm run db:generate  # prisma generate — regenerates src/generated/prisma
npm run db:seed      # tsx prisma/seed.ts — upserts the single user from SEED_USER_* env vars
npm run db:studio    # prisma studio GUI
npm run smoke        # non-destructive smoke verification
npm run smoke:demo   # destructive demo-fixture load for seeded user
```

`tsx` scripts (seed, scripts/smoke.ts) do **not** auto-load `.env` — they're run via `tsx --env-file=.env ...`.

To reset the dev DB: `prisma migrate reset` (truncates the Supabase DB and replays migrations). Follow with `db:seed` to recreate the single user.

## Architecture

### Auth split (load-bearing — don't merge these)

- `src/auth.config.ts` — **edge-safe** Auth.js config. No DB, no bcrypt, no providers with secrets. Holds the `authorized`/`jwt`/`session` callbacks. Imported by `src/proxy.ts`.
- `src/auth.ts` — full config. Adds `PrismaAdapter` and the `Credentials` provider (which calls bcrypt + Prisma in `authorize`). Imported by Server Components, Server Actions, and the `/api/auth/[...nextauth]` route handler.

`proxy.ts` runs the `authorized` callback at the edge for every non-static request (matcher excludes `/api`, `_next/static`, `_next/image`, `favicon.ico`). It redirects unauthed `/app/*` requests to `/login` and bounces logged-in users away from `/login`.

`session.user.id` is set by the JWT/session callbacks and typed via `src/types/next-auth.d.ts`. Every server-side data access path filters by `session.user.id` — never trust a `userId` from form data.

### Schema layout (multi-file)

The Prisma schema is **split per tool** under `prisma/schema/`:

- `core.prisma` — `generator`, `datasource`, and shared models (User, Account, Session, VerificationToken).
- `<tool>.prisma` — one file per tool (`time.prisma`, `finance.prisma`, `events.prisma`).

Prisma 7 merges every `.prisma` file in the directory; `prisma.config.ts` points `schema: "prisma/schema"`. Cross-file relations work (e.g. `User.timeEntries TimeEntry[]` references `time.prisma`).

**Model naming**: prefix tool-owned models with the tool name (`TimeEntry`, `FinanceTransaction`). Reserves grep-ability and prevents collisions as tools multiply (e.g. `Transaction` could mean finance, pharmacy, or DB transaction — `FinanceTransaction` cannot).

### Service layer (the chokepoint)

**Tool data access goes through `src/lib/services/<tool>.ts`, never directly through `prisma.<model>.*`** outside the service. This is enforced by convention — there's a sweep in the verification step — and is the single most important architectural rule for keeping tools decoupled.

What lives in a service:
- Typed functions that take `userId` as first arg and call `requireCan(userId, "<tool>", "read"|"write")` at the top.
- `import "server-only"` to prevent accidental client-component import.
- Mutation functions call `recordEvent({ userId, tool, type, refId?, meta? })` after the DB write succeeds.

Why: when Tool B needs Tool A's data (e.g. a "spending vs. tracked-hours" dashboard, or an agent summarizing the day), it imports from `@/lib/services/<a>` — never from Prisma. Schema changes inside A don't silently break B.

### Authorization (`src/lib/auth/can.ts`)

`can(userId, tool, action)` is the single permission check. V1 returns true for any authenticated user (single-user phase). Services call `requireCan(...)` which asserts the userId is a string or throws `AuthorizationError`.

Adding partner-with-finance-read-only later is **one edit to `can.ts`** — service callsites don't change.

### Event log (`src/lib/services/events.ts`)

A single `Event` table that every tool writes to on meaningful mutations. Schema: `{ userId, tool, type, refId?, meta JSONB?, at }`. Indexed on `(userId, at)` and `(userId, tool, at)`.

- `type` convention: `"<tool>.<verb>"` — e.g. `"time.started"`, `"finance.imported"`, `"finance.cleared"`.
- `refId`: id of the originating row when applicable (`TimeEntry.id`, etc).
- `meta`: small JSON for extras (counts, labels) — not whole rows.

Not transactional with the originating mutation at V1 (acceptable trade-off for personal use; revisit if an agent depends on the log for state reconstruction).

### Logging (`src/lib/logger.ts`)

Pino, JSON output, ISO timestamps. `logger` is the base logger; `getRequestLogger()` returns a child logger pre-bound to the current `x-request-id` (set by `src/proxy.ts` on every authorized request and propagated via `next/headers`). Use the request logger from Server Components / Server Actions; the base logger is fine from services.

### Widget registry (how new tools are added)

`src/lib/widgets/index.tsx` exports `widgets: WidgetDescriptor[]`. Each tool registers `{ id, name, href, Widget }`. The hub (`src/app/app/page.tsx`) iterates the registry and renders each `Widget` directly — they're async Server Components that call `auth()` themselves and fetch data via the service layer.

Pattern for adding a new tool, e.g. `meals`:

1. Add `prisma/schema/meals.prisma` with the model(s) → `npm run db:migrate`.
2. Add `"meals"` to the `Tool` union in `src/lib/auth/can.ts`.
3. Create `src/lib/services/meals.ts` (`import "server-only"`, every fn calls `requireCan`, mutations call `recordEvent`).
4. Create `src/app/app/meals/` with `page.tsx`, `actions.ts` (all `"use server"`, all gated by `await auth()`, delegating DB ops to the service), and any client components.
5. Create `src/lib/widgets/meals.tsx` exporting an async Server Component `MealsWidget` that uses `<WidgetCard name="..." href="/app/meals">`. Read via the service.
6. Register it in `src/lib/widgets/index.tsx`.
7. (Optional) Add `tests/meals.test.ts` for any meaningful logic.

The widget appears on the hub automatically; the tool page is reachable through the card.

### Server Actions pattern

Each tool's mutations live in a co-located `actions.ts` with `"use server"`. Conventions:

- Always start with `const session = await auth(); if (!session?.user?.id) return ...`
- Validate input with `zod` before delegating to the service.
- **Delegate DB writes to `src/lib/services/<tool>`** — don't touch `prisma.X` from an action.
- After writes, call `revalidatePath("/app")` AND `revalidatePath("/app/<tool>")` so both the widget on the hub and the tool page refresh.
- Forms wire up via `useActionState` (client component) with the action's state-shaped return type (`{ error?: string }` or `{ ok: true, ... } | { ok: false, error }`).

Decision: **Server Actions stay for the UI**; future agent endpoints will be route handlers under `/api/tools/<tool>/<op>` that call the **same service functions**. The service layer is the unification point, not the HTTP surface.

### Money conventions

**Money is stored as integer minor units (cents for USD). Never `Float`.** Sign: negative = debit / outflow, positive = credit / inflow. CSV parser emits cents; display layers divide by 100. The `FinanceTransaction.currency` column defaults to `"USD"` so adding currencies later doesn't need a migration.

### Time / timezone

`User.timezone` (default `"UTC"`). Store timestamps in UTC; format for display in the user's TZ. No date library is bundled yet — plain `Date` + `toLocaleX(...)` with explicit options is sufficient. If formatting needs grow, install `date-fns`.

### Per-request DB client

`src/lib/prisma.ts` is a global singleton (dev-mode protected against HMR re-instantiation). **Services** `import { prisma } from "@/lib/prisma"`; app code does not. Do not `new PrismaClient()` anywhere except in scripts (`prisma/seed.ts`, `scripts/smoke.ts`) where a one-shot is desired.

The Prisma client is imported from `@/generated/prisma/client` (output dir, gitignored), not from `@prisma/client`. Prisma 7 generates per-project TypeScript.

### Server Component time-purity caveat

ESLint enforces `react-hooks/purity` even in async Server Components — `Date.now()` and `new Date()` directly in a component body fail lint. Pattern: branch on the running state (which doesn't need "now") and only fall through to time-math on the completed-only path. See `src/lib/widgets/time-tracker.tsx`.

## Environment

`.env` (gitignored) holds `DATABASE_URL`, `DIRECT_URL`, `AUTH_SECRET`, and the `SEED_USER_*` triplet used by `db:seed`. Changing the seed password requires re-running `npm run db:seed` to hash and persist the new value — there is no in-app password change flow yet.

Optional: `LOG_LEVEL` overrides the Pino level (defaults to `debug` in dev, `info` in prod).

## Repo layout notes

- `main` branch = the original CRA scaffold (rollback baseline).
- `nextjs-rewrite` branch = current work.
- `scripts/smoke.ts` now defaults to a non-destructive verification pass. Use `npm run smoke:demo` (or `tsx --env-file=.env scripts/smoke.ts --write-demo`) only when you explicitly want to replace the seeded user's finance/time data with demo fixtures.

## Doc lookup

Before using a Next.js feature, grep `node_modules/next/dist/docs/` first. Files referenced repeatedly during initial build:
- `01-app/01-getting-started/15-route-handlers.md`
- `01-app/01-getting-started/07-mutating-data.md` (Server Actions, async `cookies()`, `revalidatePath`, `redirect`)
- `01-app/01-getting-started/16-proxy.md` (middleware → proxy migration)
- `01-app/02-guides/authentication.md` (DIY patterns; for Auth.js v5 specifics also check `node_modules/next-auth/`)
