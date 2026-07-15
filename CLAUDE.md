## CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Project

aucosto is a personal day-to-day dashboard / hub of tools. Single-user (Josh); partner may get scoped finance access later. External agents read/write through the **assistant surface** (`/api/assistant/*` — snapshot read + preview/execute action API, session-cookie authed, audited; see `docs/assistant-actions.md`). Keep that surface narrow — new write actions need a risk level and an audit trail, and finance writes/deletes/bulk ops stay excluded.

**Current branch state: `main` IS the live Next.js app.** (The old CRA scaffold is history; `origin/nextjs-rewrite` is a stale remnant of the rewrite.)

**Deeper docs:** `docs/architecture.md` (per-tool file map and gotchas), `docs/lessons.md` (hard-won debugging lessons — read before touching raw SQL, migrations, mobile layout, or modals), and `docs/assistant-actions.md` (agent-facing snapshot + action API). Deployed on **Vercel** (auto-deploy from `main`); `/api/health` reports the live commit sha + DB reachability.

## Tool map — go here first

One row per tool. Every tool follows the same shape: schema → service → page/actions → widget.

| Tool | Schema (`prisma/schema/`) | Service (`src/lib/services/`) | UI (`src/app/app/`) | Widget (`src/lib/widgets/`) | Pure helpers (`src/lib/`) |
|---|---|---|---|---|---|
| time | `time.prisma` (TimeEntry) | `time.ts` | `time/` | `time-tracker.tsx` | `time.ts`, `time-summary.ts`, `time-categories.ts` (preset category taxonomy + colors), `time-insights.ts` (windowed summaries, daily stacks, coverage, gap detection) |
| finance | `finance.prisma` (FinanceConnection, FinanceAccount, FinanceGoal, FinanceTransaction) | `finance/` (split: `accounts`, `connections`, `goals`, `transactions`, `teller-sync`, `webhooks`, `shared`, re-exported via `index.ts`) | `finance/` (sections under `_components/`, derive logic in `_lib/derive.ts`) | `finance.tsx` | `money.ts`, `csv.ts`, `finance-*.ts`, `statement-import/` |
| calendar | `calendar.prisma` (CalendarItem) | `calendar.ts` | `calendar/` (derive logic in `_lib/derive.ts`) | `calendar.tsx` | — |
| do (tasks) | `do.prisma` (DoItem) | `do/` (split: `reads`, `mutations`, `shared`, barrel `index.ts`) | `do/` | `do.tsx` | `do.ts` |
| habits | `habits.prisma` (Habit, HabitEntry) | `habits/` (split: `derive`, `reads`, `mutations`, `shared`, barrel `index.ts`) | `habits/` | `habits.tsx` | `habits.ts`, `habit-templates.ts` (one-tap presets, emoji-in-title icon convention) |
| projects | `projects.prisma` (Project) | `projects.ts` | `projects/` | — (no widget) | `projects.ts` |
| reflect | `reflect.prisma` (DailyReflection) | `reflect.ts` (⚠️ raw SQL — see "Known technical debt") | `reflect/` (+ `reflect/history/`) | — (hub `ReflectSection`) | `reflect.ts` (mood scale, dayKey, snapshot types) |
| rhythms | `rhythms.prisma` (RhythmSession) | `rhythms.ts` (⚠️ raw SQL — same reflect pattern; fallback `scripts/create-rhythm-table.sql`) | **no page** — hub-only contextual cards (`_components/rhythm-hub-card.tsx` + `sleep-backfill-card.tsx`); `rhythms/page.tsx` just redirects to `/app` | — (hub morning/bedtime check-in) | `rhythms.ts` (5 rhythm defs + checklists, hour→rhythm suggestion, duration fmt); `insights/rhythms.ts` (weekly consistency) |
| insights | — (reads everything) | — (queries via other services) | `insights/` | — (hub `InsightOfTheDayCard`) | `insights/` (shared buckets, trends, patterns, daily — all pure + tested) |
| rolodex (contacts) | `rolodex.prisma` (RolodexPerson, RolodexInteraction, RolodexMention, RolodexRelation) | `rolodex.ts` (⚠️ raw SQL + runtime `ensureRolodexTables()`) + `rolodex-mentions.ts` | `rolodex/` (list, `new/`, `[id]/`, `[id]/edit/`) | — (no widget) | `rolodex.ts` (shared types), `mention-parser.ts` (@Name / @[Full Name] / @insight parsing) |
| captured insights (@insight notes) | `insights-capture.prisma` (CapturedInsight, CapturedInsightPerson) | `captured-insights.ts` (⚠️ raw SQL + runtime `ensureInsightTables()`) | — (surfaces on `time/captured-today.tsx`, rolodex person pages) | — | `mention-processor.ts` (cross-tool orchestrator: text → mentions + insights via the rolodex/captured-insights services) |
| assistant (agent surface) | — (audit table via runtime DDL) | `assistant-audit.ts` | `assistant/` (snapshot control panel) + `src/app/api/assistant/*` routes | — | `assistant-snapshot.ts` (aggregates every service, no DB), `assistant-signals.ts`, `assistant-actions.ts` (action registry), `assistant-action-executor.ts` (zod-validated, service-delegating) |
| work (job hub) | `work.prisma` (WorkWorkspace, WorkArea, WorkProject, WorkPerson, WorkMeeting, WorkTask, WorkNote, WorkReview) — **a context layer, not a silo**: WorkTask.doItemId → DoItem, WorkMeeting.calendarItemId → CalendarItem, WorkPerson.rolodexPersonId → RolodexPerson, WorkProject.projectId → Project; reads LEFT JOIN the canonical rows | `work/` (split: `shared` ⚠️ raw SQL + runtime `ensureWorkTables()`, `reads`, `mutations`, `integrations` — orchestrators that create/sync through the do/calendar/rolodex/projects services + cross-surface reads for /app/do chips, rolodex work context, project work chips, assistant summary — barrel `index.ts`) | `work/` (single page, `?tab=` sections: today/projects/areas/people/meetings/notes/review; forms in `_components/`; empty workspace shows `setup-section.tsx`) | `work.tsx` (today's meetings + must-do tasks) | `work.ts` (day/week keys, meeting recurrence-on-day, today task grouping, due labels, linked-status resolution, coworker-candidate filter, task-lane + calendar-window mapping) |
| events (activity log) | `events.prisma` (Event) | `events.ts` (`recordEvent`) | — | `activity.tsx` | `event-types.ts` (label map) |
| push (notifications) | `push.prisma` (PushSubscription) | `push.ts` (subscriptions + `web-push` sends) | `settings/notifications-panel.tsx` + `/api/push` + `/api/cron/nudges` (vercel.json crons, CRON_SECRET) + `public/sw.js` (push-only SW, **no caching**) | — | — |
| whoop (integration) | `whoop.prisma` (WhoopConnection, tokens encrypted via `secrets.ts`) | `whoop.ts` (connect/status/`getWhoopMorningPrefill`) | `settings/whoop-panel.tsx` + `/api/whoop/{connect,callback,disconnect}` | — (feeds the hub morning card) | `whoop.ts` (OAuth + v2 API client), `whoop-morning.ts` (pure sleep→prefill mapping, tested) |
| location (signals) | `location.prisma` (LocationEvent) | `location.ts` (record + `getCurrentPlace`) | `/api/location/ingest` (bearer `LOCATION_WEBHOOK_SECRET`, iOS Shortcuts — `docs/location-signals.md`) + hub header 📍 line | — | `location.ts` (pure current-place derivation, tested) |

Cross-cutting pure helpers: `wall-clock.ts` (browser-side date/time → ISO conversion for forms — **mandatory** for any date+start+end form, see lessons #10).

Note the naming convention: `src/lib/<tool>.ts` = **pure helpers** (no DB, importable anywhere); `src/lib/services/<tool>.ts` = **server-only DB access**. Same basename, different layer.

Cross-tool links (all via nullable FKs with `onDelete: SetNull`, except HabitEntry which cascades):
- `DoItem.projectId` / `DoItem.habitId` — tasks belong to projects; habits spawn linked tasks.
- `TimeEntry.doItemId` / `TimeEntry.habitId` — timers started from a task or habit.
- `CalendarItem.sourceTool` / `sourceRefId` — calendar blocks created from other tools; completing a block syncs back to the linked item (`calendar/actions.ts`).

Other key entry points:
- Hub page: `src/app/app/page.tsx` (fetches + composes; sections/icons/derive live in `_components/`, suggestion engine in `_lib/hub-prompts.ts`, today digest in `_lib/daily-digest.ts`).
- Shared app-level UI lives in `src/app/app/_components/` (icons, start-timer button, hub sections, **global running-timer bar**, **mobile bottom tab bar + More sheet**, `use-body-scroll-lock.ts`).
- App layout (`src/app/app/layout.tsx`): renders sidebar/tab bar/timer bar and a reflection badge read — **anything awaited here runs on every page; reads here must never throw** (wrapped in try/catch, keep it that way).
- Health probe: `src/app/api/health/route.ts` — live commit sha, DB reachability, reflect-table presence. First stop when production misbehaves.
- Viewer context: `src/lib/viewer-context.ts` — **read this before touching auth-adjacent code** (see below).
- Teller bank linking: `src/lib/teller.ts` (API client), `src/lib/services/finance/teller-sync.ts`, webhook at `src/app/api/teller/webhook/route.ts` (verified via `src/lib/teller-webhooks.ts`).
- Statement import: `src/lib/statement-import/` (CSV + PDF parsers; `pdf-text.ts` extracts text).
- Privacy/lock UI: `src/app/app/privacy-panel.tsx`, `privacy-actions.ts`, `unlock-screen.tsx`, `lock-now-button.tsx`, `finance/widget-lock-screen.tsx`.
- Assistant surface: `src/app/app/assistant/page.tsx` (human-readable snapshot) + `/api/assistant/{snapshot,capabilities,actions/preview,actions/execute,actions/history}` route handlers — every route re-checks `auth()` itself (the proxy matcher excludes `/api`); audit trail lives in `src/lib/services/assistant-audit.ts`.
- @mention / @insight capture: `src/lib/mention-parser.ts` (pure) → `src/lib/mention-processor.ts` (orchestrator), called from time/calendar/reflect/do/projects actions; suggestions API at `src/app/api/rolodex/mention-suggestions/route.ts`.
- PiP mini timer: `src/components/pip-timer-widget.tsx` (Document Picture-in-Picture, desktop Chrome only), launched from the timer bar.

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
npm run setup-hooks  # install the git pre-push type-check hook (run once after cloning)
```

## Pre-push hook

Run `npm run setup-hooks` once after cloning to install the git pre-push hook.
The hook runs `prisma generate && tsc --noEmit` before every push and blocks the
push on any type error — preventing bad deploys from ever reaching Vercel.

`tsx` scripts (seed, `scripts/*.ts`) do **not** auto-load `.env` — run via `tsx --env-file=.env ...`. Maintenance/diagnostic scripts live in `scripts/` — each has a header comment explaining what it does and when to run it. Notable: `check-reflect.ts` (post-migration health check), `create-reflect-table.sql` (idempotent fallback if the reflect migration is stuck), `shift-times.ts` (repair timezone-shifted timestamps, dry-run by default).

To reset the dev DB: `prisma migrate reset` (truncates the Supabase DB and replays migrations). Follow with `db:seed` to recreate the single user.

### Migration workflow (and recovery)

1. Add/edit `prisma/schema/<tool>.prisma` → `npm run db:migrate` (uses `DIRECT_URL`; also regenerates the client). **Verify it ran:** `src/generated/prisma` timestamps must change — if they didn't, the run failed before applying (see `docs/lessons.md` #1).
2. If a checked-in migration is stuck (table missing but migration recorded as pending), apply its SQL manually (psql with `DIRECT_URL`, the Supabase SQL editor, or `npx tsx --env-file=.env scripts/apply-sql.ts <file.sql>`), then `npx prisma migrate resolve --applied <migration_name>` so Prisma records it, then `npm run db:generate`.
   ⚠️ **`prisma migrate dev` currently demands a full reset** — the DB's recorded migrations diverge from `prisma/migrations/` (a migration applied remotely was never checked in). NEVER accept the reset (it truncates live data). New tables go in via idempotent SQL + `apply-sql.ts` (template: `scripts/create-push-whoop-location.sql`, named to match what `prisma migrate` would generate) followed by `npm run db:generate`.
3. Verify with the matching health-check script (`scripts/check-reflect.ts` is the template).

`DATABASE_URL` = transaction pooler (runtime; can't run prepared DDL); `DIRECT_URL` = session pooler (migrations only).

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

**Tool data access goes through `src/lib/services/<tool>.ts`, never directly through `prisma.<model>.*`** outside the service. (Exceptions: `viewer-context.ts` reads the User row, `auth.ts` does the credentials lookup, `demo-workspace.ts` manages the shadow demo user, and the health probe pings the DB — all infra, not tool data.) This is the single most important architectural rule for keeping tools decoupled. Cross-tool orchestrators (`mention-processor.ts`, `assistant-snapshot.ts`, `assistant-action-executor.ts`) live in `src/lib/` but compose **only service functions** — no direct prisma there either.

What lives in a service:
- Typed functions that take `userId` as first arg and call `requireCan(userId, "<tool>", "read"|"write")` at the top.
- `import "server-only"` to prevent accidental client-component import.
- Mutation functions call `recordEvent({ userId, tool, type, refId?, meta? })` after the DB write succeeds.

When a service grows past ~600 lines, split it into a directory with an `index.ts` barrel — `finance/`, `habits/`, and `do/` are the templates.

Why: when Tool B needs Tool A's data, it imports from `@/lib/services/<a>` — never from Prisma. Schema changes inside A don't silently break B.

### Authorization (`src/lib/auth/can.ts`)

`can(userId, tool, action)` is the single permission check. V1 returns true for any authenticated user. Services call `requireCan(...)` which asserts the userId is a string or throws `AuthorizationError`.

The `Tool` union currently covers `time`, `finance`, `calendar`, `events`, `do`, `habit`, `projects`, `reflect`, `rhythm`, `rolodex`, and `insight` — see `src/lib/auth/can.ts` for the authoritative list. New tools must be added to the union before their service can call `requireCan`; never borrow another tool's name (that's how partner-scoped permissions would leak later).

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

Timestamps are stored in UTC. Display-side, the **server runtime is pinned to the owner's timezone** via `src/instrumentation.ts` (sets `process.env.TZ`, default `America/Los_Angeles`, override with `APP_TIMEZONE`). This makes server-rendered `toLocaleX(...)` calls and day/week-boundary math (`startOfToday`, timeline windows, gap detection) agree with what the browser renders — without it, Vercel's UTC servers shift every displayed time. `User.timezone` exists in the schema but is currently unused. No date library is bundled — plain `Date` + `toLocaleX(...)` with explicit options. If formatting needs grow (e.g. multi-timezone), install `date-fns` and thread `User.timezone` through instead.

### Shared color palette

`src/lib/time-categories.ts` is the single color system. `categoryColor(name)` resolves preset time categories (work, reading, exercise, …), linked-tool colors (`"do"` green, `"habit"` teal, `"calendar"` rose), and stable hash-based colors for any custom string. **Everything colored uses it**: time chips/insights, calendar item dots and timeline blocks (`calendarItemColor` in calendar derive), habit cards (via `Habit.bucket`, which doubles as the color key), Do bucket pills, hub progress indicators. Don't introduce ad-hoc colors — pass a category/bucket string through `categoryColor`.

### Mobile layout system (bottom stack + touch)

Three fixed elements share the bottom of the viewport, coordinated by CSS variables in `globals.css`:

- `--mobile-tabbar-height` — 3.25rem under `lg`, 0 on desktop.
- `--timer-bar-height` — published via a `<style>` tag by the timer bar **only while it renders**, so offsets collapse when no timer runs.
- z-index ladder: tab bar **40** → timer bar **41** → FABs (`.calendar-fab`) **42** → modal backdrops **50**. New bottom-pinned elements must join this ladder and offset with `calc(var(--mobile-tabbar-height) + var(--timer-bar-height) + var(--safe-area-bottom))`.

Touch affordances: hover-revealed controls add `[@media(pointer:coarse)]:opacity-100`; `btn-icon`/`btn-ink`/`btn-ghost` grow to ≥2.5rem targets under `pointer: coarse` via `min-*` (desktop untouched); `.field` inputs are ≥1rem under 640px (iOS zoom prevention). Safe-area insets need the `viewport-fit=cover` export in `src/app/layout.tsx`. Modals: bottom sheets on mobile, centered on desktop (`.calendar-modal*`); every modal calls `useBodyScrollLock` (reference-counted) and any modal nested in an animated section should portal to `document.body` (see lessons #6).

### Error handling — degrade, don't die

The pattern, learned the hard way (two production outages — `docs/lessons.md` #2–#4):

- **Service reads that power cosmetic UI return empty on failure** (log unexpected errors via `console.error`), never throw. See `src/lib/services/reflect.ts`.
- **Missing-table guards match Prisma error codes** (`P2021`; `P2010` + 42P01 in meta), not message strings — the pg adapter rewrites messages.
- **Layout-level awaits get their own try/catch** regardless of service guarantees — `src/app/app/layout.tsx` runs on every page.
- Server actions return `{ error }` state for form errors; writes stay strict and throw.

### Known technical debt

- **Reflect service uses `$queryRaw`** (`src/lib/services/reflect.ts`): the DailyReflection model was authored in an environment that couldn't run `prisma generate`, so the generated client predates it. Once `npm run db:generate` has run with the current schema, the raw queries can be swapped for `prisma.dailyReflection.*` without changing callers. Until then: every date parameter needs an explicit `::date` cast, and **never** do parameterized date arithmetic (lessons #2).
- `origin/nextjs-rewrite` is a stale branch; `User.timezone` column exists but is unused (the runtime TZ pin supersedes it for now).

### Per-request DB client

`src/lib/prisma.ts` is a **lazy** global singleton (dev-mode protected against HMR re-instantiation): the client is constructed on first property access, so importing the module — and therefore `next build`'s page-data collection — never requires `DATABASE_URL`. **Services** `import { prisma } from "@/lib/prisma"`; app code does not. Do not `new PrismaClient()` anywhere except in scripts where a one-shot is desired.

The Prisma client is imported from `@/generated/prisma/client` (output dir, gitignored), not from `@prisma/client`.

### Server Component time-purity caveat

ESLint enforces `react-hooks/purity` even in async Server Components — `Date.now()` / `new Date()` directly in a component body fail lint. Pattern: branch on the running state (which doesn't need "now") and only fall through to time-math on the completed-only path. See `src/lib/widgets/time-tracker.tsx`.

## Rhythms (the connective tissue, not a tool)

Rhythms have no dedicated page. They live entirely on the hub as smart,
time-of-day contextual cards (`src/app/app/_components/rhythm-hub-card.tsx`,
a `"use client"` component that gates on the **browser's** local hour):

- **Morning check-in** (05:00–10:00): log wake time → `RhythmSession` of type
  `wakeup` with `metadata.wakeTime` + carried-over `metadata.sleepMinutes` →
  morning-habit chips (`dayPart = "morning"`) → "Done with morning" ends the
  session and the card disappears for the day.
- **Bedtime check-in** (21:00–05:00): reflection nudge + "Going to bed" opens a
  `sleep` session; the morning side closes it (or the sleep-backfill card does).

Service: `startMorning` / `completeMorning` / `getTodayMorning` /
`listRhythmSessionsBetween` in `src/lib/services/rhythms.ts`. The morning wake
time also seeds the time tool's "since you woke up" gap baseline, and sleep /
morning sessions render as read-only context blocks on the calendar timeline.

## Integrations

### Whoop (implemented, activates with credentials)

OAuth connect lives at Settings → Whoop; hidden guidance shows until `WHOOP_CLIENT_ID`/`WHOOP_CLIENT_SECRET` are set (create the app at developer.whoop.com with redirect URL `<host>/api/whoop/callback`). While today's wake is uncaptured, the hub calls `getWhoopMorningPrefill()` (v2 sleep + recovery, tokens auto-refresh) and the morning card one-tap confirms Whoop's wake time, carrying its scored sleep minutes into `RhythmSession.metadata`. Editing the prefilled time drops the Whoop sleep duration on purpose. Raw Whoop records are never stored.

### Web Push (implemented)

`public/sw.js` is push-only — **never add a fetch/caching handler**. Nudges are sent by `/api/cron/nudges` (two vercel.json crons, UTC times chosen for LA mornings/evenings), each skipped when the thing it nudges for already happened. iOS only delivers pushes to the installed home-screen app.

### Location signals (implemented)

Arrive/leave events at named places via `/api/location/ingest` — see `docs/location-signals.md` for the iOS Shortcuts setup. Deliberately not a tracker; keep raw coordinates out of the assistant snapshot.

## Environment

`.env` (gitignored) holds `DATABASE_URL`, `DIRECT_URL`, `AUTH_SECRET`, the `SEED_USER_*` triplet, and (optional) Teller credentials: `TELLER_ENV`, `TELLER_APPLICATION_ID`, `TELLER_WEBHOOK_SIGNING_SECRETS`, `TELLER_CERT_PEM`, `TELLER_PRIVATE_KEY_PEM`. Linked-account access tokens are encrypted at rest using `AUTH_SECRET` (`src/lib/secrets.ts`). Changing the seed password requires re-running `npm run db:seed`.

Optional: `LOG_LEVEL` overrides the Pino level (defaults to `debug` in dev, `info` in prod). `APP_TIMEZONE` overrides the server timezone pin (defaults to `America/Los_Angeles`; set **unconditionally** in `src/instrumentation.ts` because Vercel presets `TZ=UTC`).

Integration env (all optional — each feature degrades cleanly when unset, but **production needs them in Vercel too**): `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_SUBJECT` (Web Push), `CRON_SECRET` (authenticates `/api/cron/nudges`; Vercel sends it as the Bearer token automatically), `LOCATION_WEBHOOK_SECRET` (location ingest bearer token), `WHOOP_CLIENT_ID` / `WHOOP_CLIENT_SECRET` (Whoop OAuth).

## Tests

Vitest, `tests/` — pure-logic coverage (derive functions, parsers, summaries, webhook verification, dedup). When adding logic that can be expressed as a pure function, extract it (`_lib/derive.ts` or `src/lib/*.ts`) and test it there.

DB-backed integration tests live in `tests/integration/` and run via `npm run test:integration` (separate config `vitest.integration.config.ts`; loads `.env`, stubs `server-only`, runs serially against the dev DB with throwaway users). Currently covers finance import dedup. `npm run smoke` remains the quick non-destructive data-layer check.

## Doc lookup

Before using a Next.js feature, grep `node_modules/next/dist/docs/` first. Frequently needed:
- `01-app/01-getting-started/15-route-handlers.md`
- `01-app/01-getting-started/07-mutating-data.md` (Server Actions, async `cookies()`, `revalidatePath`, `redirect`)
- `01-app/01-getting-started/16-proxy.md` (middleware → proxy migration)
- `01-app/02-guides/authentication.md` (for Auth.js v5 specifics also check `node_modules/next-auth/`)
