## CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Project

aucosto is a personal day-to-day dashboard / hub of tools. Single-user (Josh); partner may get scoped finance access later. Designed so external agents can eventually read/write through token-authenticated API endpoints — but the agent surface is **deferred**. Don't pre-build it.

**Current branch state: `main` IS the live Next.js app.** (The old CRA scaffold is history; `origin/nextjs-rewrite` is a stale remnant of the rewrite.)

## Tool map — go here first

Seven tools, one row each. Every tool follows the same shape: schema → service → page/actions → widget.

| Tool | Schema (`prisma/schema/`) | Service (`src/lib/services/`) | UI (`src/app/app/`) | Widget (`src/lib/widgets/`) | Pure helpers (`src/lib/`) |
|---|---|---|---|---|---|
| time | `time.prisma` (TimeEntry) | `time.ts` | `time/` | `time-tracker.tsx` | `time.ts`, `time-summary.ts` |
| finance | `finance.prisma` (FinanceConnection, FinanceAccount, FinanceGoal, FinanceTransaction) | `finance/` (split: `accounts`, `connections`, `goals`, `transactions`, `teller-sync`, `webhooks`, `shared`, re-exported via `index.ts`) | `finance/` (sections under `_components/`, derive logic in `_lib/derive.ts`) | `finance.tsx` | `money.ts`, `csv.ts`, `finance-*.ts`, `statement-import/` |
| calendar | `calendar.prisma` (CalendarItem) | `calendar.ts` | `calendar/` (derive logic in `_lib/derive.ts`) | `calendar.tsx` | — |
| do (tasks) | `do.prisma` (DoItem) | `do/` (split: `reads`, `mutations`, `shared`, barrel `index.ts`) | `do/` | `do.tsx` | `do.ts` |
| habits | `habits.prisma` (Habit, HabitEntry) | `habits/` (split: `derive`, `reads`, `mutations`, `shared`, barrel `index.ts`) | `habits/` | `habits.tsx` | `habits.ts` |
| projects | `projects.prisma` (Project) | `projects.ts` | `projects/` | — (no widget) | `projects.ts` |
| events (activity log) | `events.prisma` (Event) | `events.ts` (`recordEvent`) | — | `activity.tsx` | `event-types.ts` (label map) |

Note the naming convention: `src/lib/<tool>.ts` = **pure helpers** (no DB, importable anywhere); `src/lib/services/<tool>.ts` = **server-only DB access**. Same basename, different layer.

Cross-tool links (all via nullable FKs with `onDelete: SetNull`, except HabitEntry which cascades):
- `DoItem.projectId` / `DoItem.habitId` — tasks belong to projects; habits spawn linked tasks.
- `TimeEntry.doItemId` / `TimeEntry.habitId` — timers started from a task or habit.
- `CalendarItem.sourceTool` / `sourceRefId` — calendar blocks created from other tools; completing a block syncs back to the linked item (`calendar/actions.ts`).

Other key entry points:
- Hub page: `src/app/app/page.tsx` (fetches + composes; sections/icons/derive live in `_components/`, suggestion engine in `_lib/hub-prompts.ts`, today digest in `_lib/daily-digest.ts`).
- Shared app-level UI lives in `src/app/app/_components/` (icons, start-timer button, hub sections).
- Viewer context: `src/lib/viewer-context.ts` — **read this before touching auth-adjacent code** (see below).
- Teller bank linking: `src/lib/teller.ts` (API client), `src/lib/services/finance/teller-sync.ts`, webhook at `src/app/api/teller/webhook/route.ts` (verified via `src/lib/teller-webhooks.ts`).
- Statement import: `src/lib/statement-import/` (CSV + PDF parsers; `pdf-text.ts` extracts text).
- Privacy/lock UI: `src/app/app/privacy-panel.tsx`, `privacy-actions.ts`, `unlock-screen.tsx`, `lock-now-button.tsx`, `finance/widget-lock-screen.tsx`.

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

`tsx` scripts (seed, `scripts/*.ts`) do **not** auto-load `.env` — run via `tsx --env-file=.env ...`. One-off maintenance scripts live in `scripts/` (`backfill-finance-categories.ts`, `add-researched-habits.ts`, etc.).

To reset the dev DB: `prisma migrate reset` (truncates the Supabase DB and replays migrations). Follow with `db:seed` to recreate the single user.

## Architecture

### Auth split (load-bearing — don't merge these)

- `src/auth.config.ts` — **edge-safe** Auth.js config. No DB, no bcrypt, no providers with secrets. Holds the `authorized`/`jwt`/`session` callbacks. Imported by `src/proxy.ts`.
- `src/auth.ts` — full config. Adds `PrismaAdapter` and the `Credentials` provider (which calls bcrypt + Prisma in `authorize`). Imported by Server Components, Server Actions, and the `/api/auth/[...nextauth]` route handler.

`proxy.ts` runs the `authorized` callback at the edge for every non-static request (matcher excludes `/api`, `_next/static`, `_next/image`, `favicon.ico`). It redirects unauthed `/app/*` requests to `/login` and bounces logged-in users away from `/login`.

`session.user.id` is set by the JWT/session callbacks and typed via `src/types/next-auth.d.ts`. Every server-side data access path filters by userId — never trust a `userId` from form data.

### Viewer context, demo mode, and the privacy lock

`src/lib/viewer-context.ts` wraps `auth()` and is the entry point app pages should use for "who is looking at this". It returns `{ ownerUserId, effectiveUserId, financeVisible, appLockEnabled, isUnlocked, isDemoMode, ... }`:

- **Demo mode**: the owner has an optional shadow "demo workspace" user (`src/lib/demo-workspace.ts`, populated by `smoke:demo`). When the `aucosto_demo_mode` cookie is set, `effectiveUserId` becomes the demo workspace's id — all services then read/write demo data. **Pass `effectiveUserId` (not the session id) to services from app code.**
- **Privacy lock**: `User.appLockEnabled` + the `aucosto_app_unlock` cookie gate the app behind `unlock-screen.tsx`; `User.financeVisible` hides finance independently (`widget-lock-screen.tsx`). Mutations live in `src/app/app/privacy-actions.ts`.

`src/lib/server-action.ts` exports `withViewer(handler)` (any tool) and `withFinanceUser(handler)` (adds the `assertFinanceVisible()` privacy gate) — wrappers that resolve the viewer and translate thrown errors into `{ ok: false, error }`. Actions using the `useActionState` `{ error?: string }` contract instead call `resolveActiveUserId()` directly — don't add per-file `requireUserId()` helpers.

### Schema layout (multi-file)

The Prisma schema is **split per tool** under `prisma/schema/`: `core.prisma` holds `generator`, `datasource`, and shared models (User, Account, Session, VerificationToken); each tool gets its own file. Prisma 7 merges every `.prisma` file in the directory; `prisma.config.ts` points `schema: "prisma/schema"`. Cross-file relations work.

**Model naming**: prefix tool-owned models with the tool name (`TimeEntry`, `FinanceTransaction`). Reserves grep-ability and prevents collisions as tools multiply.

### Service layer (the chokepoint)

**Tool data access goes through `src/lib/services/<tool>.ts`, never directly through `prisma.<model>.*`** outside the service. (Exceptions: `viewer-context.ts` reads the User row, and `auth.ts` does the credentials lookup — both are infra, not tool data.) This is the single most important architectural rule for keeping tools decoupled.

What lives in a service:
- Typed functions that take `userId` as first arg and call `requireCan(userId, "<tool>", "read"|"write")` at the top.
- `import "server-only"` to prevent accidental client-component import.
- Mutation functions call `recordEvent({ userId, tool, type, refId?, meta? })` after the DB write succeeds.

When a service grows past ~600 lines, split it into a directory with an `index.ts` barrel — `finance/`, `habits/`, and `do/` are the templates.

Why: when Tool B needs Tool A's data, it imports from `@/lib/services/<a>` — never from Prisma. Schema changes inside A don't silently break B.

### Authorization (`src/lib/auth/can.ts`)

`can(userId, tool, action)` is the single permission check. V1 returns true for any authenticated user. Services call `requireCan(...)` which asserts the userId is a string or throws `AuthorizationError`.

The `Tool` union is `"time" | "finance" | "calendar" | "events" | "do" | "habit" | "projects"`. New tools must be added to the union before their service can call `requireCan`.

Adding partner-with-finance-read-only later is **one edit to `can.ts`** — service callsites don't change.

### Event log (`src/lib/services/events.ts`)

A single `Event` table that every tool writes to on meaningful mutations. Schema: `{ userId, tool, type, refId?, meta JSONB?, at }`. Indexed on `(userId, at)` and `(userId, tool, at)`.

- `type` convention: `"<tool>.<verb>"` — e.g. `"time.started"`, `"finance.imported"`, `"habit.logged"`.
- `refId`: id of the originating row when applicable. `meta`: small JSON for extras — not whole rows.
- **Every new event type needs a human-readable label in `src/lib/event-types.ts`** (the activity widget renders from it; it's deliberately not server-only).

Not transactional with the originating mutation at V1 (acceptable trade-off for personal use).

### Logging (`src/lib/logger.ts`)

Pino, JSON output, ISO timestamps. `logger` is the base logger; `getRequestLogger()` returns a child logger pre-bound to the current `x-request-id` (set by `src/proxy.ts` and propagated via `next/headers`). Use the request logger from Server Components / Server Actions; the base logger is fine from services.

### Widget registry (how new tools are added)

`src/lib/widgets/index.tsx` exports `widgets: WidgetDescriptor[]` — currently calendar, time, do, habits, finance, activity. Each `Widget` is an async Server Component that resolves the viewer itself and fetches via the service layer. The hub (`src/app/app/page.tsx`) renders the registry.

Pattern for adding a new tool, e.g. `meals`:

1. Add `prisma/schema/meals.prisma` with the model(s) → `npm run db:migrate`.
2. Add `"meals"` to the `Tool` union in `src/lib/auth/can.ts`.
3. Create `src/lib/services/meals.ts` (`import "server-only"`, every fn calls `requireCan`, mutations call `recordEvent`); add event labels to `src/lib/event-types.ts`.
4. Create `src/app/app/meals/` with `page.tsx`, `actions.ts` (all `"use server"`, gated by viewer context / `auth()`, delegating DB ops to the service), and any client components.
5. Create `src/lib/widgets/meals.tsx` exporting an async Server Component using `<WidgetCard name="..." href="/app/meals">`. Read via the service.
6. Register it in `src/lib/widgets/index.tsx`. Add it to the sidebar (`src/app/app/sidebar.tsx`).
7. Add `tests/meals.test.ts` for any meaningful pure logic.

### Server Actions pattern

Each tool's mutations live in a co-located `actions.ts` with `"use server"`. Conventions:

- Always resolve the viewer first (`getViewerContext()` / `withFinanceUser` / `await auth()`) and bail if absent.
- Validate input with `zod` before delegating to the service.
- **Delegate DB writes to `src/lib/services/<tool>`** — don't touch `prisma.X` from an action.
- After writes, call `revalidatePath("/app")` AND `revalidatePath("/app/<tool>")` so both the widget and the tool page refresh.
- Forms wire up via `useActionState` with state-shaped returns (`{ error?: string }` or `{ ok: true, ... } | { ok: false, error }`).

Decision: **Server Actions stay for the UI**; future agent endpoints will be route handlers under `/api/tools/<tool>/<op>` that call the **same service functions**. The service layer is the unification point, not the HTTP surface.

### Money conventions

**Money is stored as integer minor units (cents for USD). Never `Float`.** Sign: negative = debit / outflow, positive = credit / inflow. Parsers emit cents; display layers divide by 100. `FinanceTransaction.currency` defaults to `"USD"`.

### Time / timezone

`User.timezone` (default `"UTC"`). Store timestamps in UTC; format for display in the user's TZ. No date library is bundled — plain `Date` + `toLocaleX(...)` with explicit options. If formatting needs grow, install `date-fns`.

### Per-request DB client

`src/lib/prisma.ts` is a global singleton (dev-mode protected against HMR re-instantiation). **Services** `import { prisma } from "@/lib/prisma"`; app code does not. Do not `new PrismaClient()` anywhere except in scripts where a one-shot is desired.

The Prisma client is imported from `@/generated/prisma/client` (output dir, gitignored), not from `@prisma/client`.

### Server Component time-purity caveat

ESLint enforces `react-hooks/purity` even in async Server Components — `Date.now()` / `new Date()` directly in a component body fail lint. Pattern: branch on the running state (which doesn't need "now") and only fall through to time-math on the completed-only path. See `src/lib/widgets/time-tracker.tsx`.

## Environment

`.env` (gitignored) holds `DATABASE_URL`, `DIRECT_URL`, `AUTH_SECRET`, the `SEED_USER_*` triplet, and (optional) Teller credentials: `TELLER_ENV`, `TELLER_APPLICATION_ID`, `TELLER_WEBHOOK_SIGNING_SECRETS`, `TELLER_CERT_PEM`, `TELLER_PRIVATE_KEY_PEM`. Linked-account access tokens are encrypted at rest using `AUTH_SECRET` (`src/lib/secrets.ts`). Changing the seed password requires re-running `npm run db:seed`.

Optional: `LOG_LEVEL` overrides the Pino level (defaults to `debug` in dev, `info` in prod).

## Tests

Vitest, `tests/` — pure-logic coverage (derive functions, parsers, summaries, webhook verification, dedup). When adding logic that can be expressed as a pure function, extract it (`_lib/derive.ts` or `src/lib/*.ts`) and test it there.

DB-backed integration tests live in `tests/integration/` and run via `npm run test:integration` (separate config `vitest.integration.config.ts`; loads `.env`, stubs `server-only`, runs serially against the dev DB with throwaway users). Currently covers finance import dedup. `npm run smoke` remains the quick non-destructive data-layer check.

## Doc lookup

Before using a Next.js feature, grep `node_modules/next/dist/docs/` first. Frequently needed:
- `01-app/01-getting-started/15-route-handlers.md`
- `01-app/01-getting-started/07-mutating-data.md` (Server Actions, async `cookies()`, `revalidatePath`, `redirect`)
- `01-app/01-getting-started/16-proxy.md` (middleware → proxy migration)
- `01-app/02-guides/authentication.md` (for Auth.js v5 specifics also check `node_modules/next-auth/`)
