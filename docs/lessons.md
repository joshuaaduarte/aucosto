# Lessons learned (hard-won)

Debugging war stories from building this app. Read these before touching
the corresponding areas — each one cost real time, and one took production
down entirely.

## 1. The DailyReflection migration that never applied

**What happened:** the reflect feature shipped with a hand-written migration
(`20260612090000_add_daily_reflection`). The owner's `npm run db:migrate`
run failed silently-to-them (likely a connection or wrong-directory issue —
the telltale was that `src/generated/prisma` was never regenerated, and
`prisma migrate dev` always regenerates after applying). Production code
queried a table that didn't exist for days.

**Avoid it:** after any migration, run the relevant health-check script
(`scripts/check-reflect.ts` is the template — copy the pattern for new
tables). If `src/generated/prisma` timestamps didn't change after
`db:migrate`, the run did not complete. A fallback SQL file
(`scripts/create-reflect-table.sql`) plus
`npx prisma migrate resolve --applied <name>` recovers from a stuck
migration without fighting Prisma.

## 2. `date >= integer` — the raw-SQL bug that took prod down

**What happened:** `listRecentMoods` used
`"date" >= (now()::date - ${days - 1})`. Postgres types an unknown
parameter to match the *other operand* — here `date` — so the expression
resolved as `date - date = integer`, and the comparison became
`date >= integer` → error 42883 on **every page** (the layout reads
reflections). It only detonated once the table finally existed, because the
missing-table guard had been short-circuiting the query until then.

**Rule:** never do parameterized date arithmetic in `$queryRaw`. Compute
boundaries in JS (the runtime is pinned to the owner's timezone — the DB's
`now()` is UTC and subtly wrong anyway) and pass them as
`${dateString}::date`. Every comparison parameter gets an explicit cast.

## 3. Missing-table guards must match error CODES, not strings

**What happened:** the first version of `isMissingTableError` sniffed for
raw pg strings (`42P01`, `"DailyReflection" does not exist`). The pg driver
adapter translates 42P01 into Prisma **P2021**, whose message uses
*backticks*. The guard never matched in production.

**Rule:** check `error instanceof Prisma.PrismaClientKnownRequestError &&
error.code === "P2021"` (see `src/lib/services/reflect.ts` and the calendar
service). Message-text matching is a fallback only.

## 4. Layout reads must never throw

Anything awaited in `src/app/app/layout.tsx` runs on **every page**. A
cosmetic read (the reflection badge dot) crashing means the entire app
500s. Two layers of defense now exist and must be preserved: service
*reads* catch all errors and degrade to empty (logging non-expected ones),
and the layout wraps its read in try/catch regardless. Writes stay strict.

## 5. Same error digest = same build, not necessarily the same bug

Next.js error digests hash the error including its minified stack, which
changes between builds. If a digest survives a deploy, suspect that the
deploy didn't actually go out — but don't over-index: if Vercel deployed
fine and the error message is identical, message-dominant hashing can keep
digests stable too. Use `/api/health` (returns the live commit sha, DB
reachability, and reflect-table presence) to settle which build production
is running before debugging "the code".

## 6. Retained CSS transforms break position:fixed

The `fade-in` section animations originally ended on
`transform: translateY(0)` with `animation-fill-mode: both`. A retained
transform — **even identity** — makes that element the containing block for
`position: fixed` descendants, so modals rendered inside animated sections
anchored to the page instead of the viewport (appearing "off-screen, scroll
to find it"). Fixes that must both stay: `blockFade` ends at
`transform: none`, and the entry-editor modal portals to `document.body`.
New modals inside animated sections should portal too.

## 7. Mobile bottom-stack: CSS variables + fixed z-index ladder

Three fixed elements share the bottom of the screen. The contract:

- `--mobile-tabbar-height` — 3.25rem under `lg`, 0 on desktop (globals.css)
- `--timer-bar-height` — published via a `<style>` tag **only while the
  timer bar renders**, so dependents collapse when no timer runs
- z-index ladder: tab bar **40** → timer bar **41** → FABs **42** →
  modal backdrops **50**
- FABs and page content offset by
  `calc(var(--mobile-tabbar-height) + var(--timer-bar-height) [+ safe-area])`

Anything new pinned to the bottom must join this system, not invent its own
offsets. Safe-area insets require `viewport-fit=cover` (the `viewport`
export in `src/app/layout.tsx`) to resolve.

## 8. `pointer: coarse` for touch-only affordances

Hover-revealed controls are invisible on touch (no hover exists). The
pattern: keep `opacity-0 group-hover:opacity-100` for desktop, add
`[@media(pointer:coarse)]:opacity-100` for touch. Touch targets grow via
`@media (pointer: coarse) { min-height/min-width: 2.5rem }` inside the
`btn-icon` / `btn-ink` / `btn-ghost` utilities — `min-*` so explicit sizes
can only grow, and desktop is untouched. Also: `.field` inputs bump to 1rem
under 640px or iOS Safari zooms the viewport on focus.

## 9. `useBodyScrollLock` — token-set scroll lock

All modals call `useBodyScrollLock(open)` (or unconditionally when the
component only mounts while open). It sets `overflow: hidden` on `<body>`
backed by a **module-level set of per-instance tokens** (`useId()`-keyed),
not a plain counter — so overlapping/nested modals only release the lock
when the last one closes, and a double-fired effect (React dev
double-invoke, or two modals racing open/close) can never desync the lock,
since `Set.add`/`delete` are idempotent per token. Never set body overflow
directly; never forget the hook on a new modal (the More sheet, every
calendar-modal consumer, and the habit modals all use it).

## 10. Wall-clock times convert in the BROWSER

Forms with date/start/end fields must convert to absolute timestamps
client-side (`fillIsoWindowFields` in `src/lib/wall-clock.ts`) and server
actions consume the ISO fields (`windowFromFormData`). Parsing naive
`"YYYY-MM-DDTHH:mm"` strings on the server lets the server's timezone
decide what they mean — which shipped a bug where every manually-entered
time was stored 7–8 hours off. The server timezone pin
(`src/instrumentation.ts`, set **unconditionally** — Vercel presets
`TZ=UTC`, so a "set only if unset" guard silently does nothing) keeps
server-side *rendering* and day-boundary math correct, but data entry must
not depend on it.
