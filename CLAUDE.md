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

Three Next.js 16 / Prisma 7 gotchas that bit during scaffolding and will bite again:

1. `middleware.ts` is renamed to `proxy.ts`. Must export `proxy` or a default function — destructured re-exports may not be detected.
2. Prisma 7 does **not** accept `url = env("...")` in `schema.prisma`. The URL lives in `prisma.config.ts`, and the runtime client requires a driver adapter (`new PrismaClient({ adapter: new PrismaPg({ connectionString }) })`).
3. Tailwind 4 uses `@import "tailwindcss"` and `@theme inline` blocks — no JS config file to edit.

## Commands

```bash
npm run dev          # Next.js dev server (Turbopack) on :3000
npm run build        # production build (also runs type/lint checks)
npm run lint         # eslint
npm run db:migrate   # prisma migrate dev — creates/applies migrations
npm run db:generate  # prisma generate — regenerates src/generated/prisma
npm run db:seed      # tsx prisma/seed.ts — upserts the single user from SEED_USER_* env vars
npm run db:studio    # prisma studio GUI
```

`tsx` scripts (seed, scripts/smoke.ts) do **not** auto-load `.env` — they're run via `tsx --env-file=.env ...`.

To reset the dev DB: `prisma migrate reset` (truncates the Supabase DB and replays migrations). Follow with `db:seed` to recreate the single user.

## Architecture

### Auth split (load-bearing — don't merge these)

- `src/auth.config.ts` — **edge-safe** Auth.js config. No DB, no bcrypt, no providers with secrets. Holds the `authorized`/`jwt`/`session` callbacks. Imported by `src/proxy.ts`.
- `src/auth.ts` — full config. Adds `PrismaAdapter` and the `Credentials` provider (which calls bcrypt + Prisma in `authorize`). Imported by Server Components, Server Actions, and the `/api/auth/[...nextauth]` route handler.

`proxy.ts` runs the `authorized` callback at the edge for every non-static request (matcher excludes `/api`, `_next/static`, `_next/image`, `favicon.ico`). It redirects unauthed `/app/*` requests to `/login` and bounces logged-in users away from `/login`.

`session.user.id` is set by the JWT/session callbacks and typed via `src/types/next-auth.d.ts`. Every server-side data access path filters by `session.user.id` — never trust a `userId` from form data.

### Widget registry (how new tools are added)

`src/lib/widgets/index.tsx` exports `widgets: WidgetDescriptor[]`. Each tool registers `{ id, name, href, Widget }`. The hub (`src/app/app/page.tsx`) iterates the registry and renders each `Widget` directly — they're async Server Components that call `auth()` themselves and fetch their own slice of data.

Pattern for adding a new tool, e.g. `meals`:

1. Add the Prisma model(s) → `db:migrate`.
2. Create `src/app/app/meals/` with `page.tsx`, `actions.ts` (all `"use server"`, all gated by `await auth()`), and any client components for forms / interactive UI.
3. Create `src/lib/widgets/meals.tsx` exporting an async Server Component `MealsWidget` that uses `<WidgetCard name="..." href="/app/meals">`.
4. Register it in `src/lib/widgets/index.tsx`.

The widget appears on the hub automatically; the tool page is reachable through the card.

### Server Actions pattern

Each tool's mutations live in a co-located `actions.ts` with `"use server"`. The conventions used in `src/app/app/time/actions.ts` and `src/app/app/finance/actions.ts`:

- Always start with `const session = await auth(); if (!session?.user?.id) return ...`
- Validate input with `zod` before touching the DB.
- After writes, call `revalidatePath("/app")` AND `revalidatePath("/app/<tool>")` so both the widget on the hub and the tool page refresh.
- Forms wire up via `useActionState` (client component) with the action's state-shaped return type (`{ error?: string }` or `{ ok: true, ... } | { ok: false, error }`).

### Per-request DB client

`src/lib/prisma.ts` is a global singleton (dev-mode protected against HMR re-instantiation). New code should `import { prisma } from "@/lib/prisma"` — do not `new PrismaClient()` anywhere except in scripts (`prisma/seed.ts`, `scripts/smoke.ts`) where a one-shot is desired.

The Prisma client is imported from `@/generated/prisma/client` (output dir, gitignored), not from `@prisma/client`. Prisma 7 generates per-project TypeScript.

### Server Component time-purity caveat

ESLint enforces `react-hooks/purity` even in async Server Components — `Date.now()` and `new Date()` directly in a component body fail lint. Pattern: branch on the running state (which doesn't need "now") and only fall through to time-math on the completed-only path. See `src/lib/widgets/time-tracker.tsx`.

## Environment

`.env` (gitignored) holds `DATABASE_URL`, `AUTH_SECRET`, and the `SEED_USER_*` triplet used by `db:seed`. Changing the seed password requires re-running `npm run db:seed` to hash and persist the new value — there is no in-app password change flow yet.

## Repo layout notes

- `main` branch = the original CRA scaffold (rollback baseline).
- `nextjs-rewrite` branch = current work.
- `scripts/smoke.ts` is a one-shot dev fixture loader (CSV-parses sample data, inserts a running TimeEntry + completed entry, inserts transactions). Not part of any test suite — just run with `tsx --env-file=.env scripts/smoke.ts` to repopulate demo state.

## Doc lookup

Before using a Next.js feature, grep `node_modules/next/dist/docs/` first. Files referenced repeatedly during initial build:
- `01-app/01-getting-started/15-route-handlers.md`
- `01-app/01-getting-started/07-mutating-data.md` (Server Actions, async `cookies()`, `revalidatePath`, `redirect`)
- `01-app/01-getting-started/16-proxy.md` (middleware → proxy migration)
- `01-app/02-guides/authentication.md` (DIY patterns; for Auth.js v5 specifics also check `node_modules/next-auth/`)
