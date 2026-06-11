# aucosto audit log

A running record of structural audits. Each entry records the snapshot at the
time of the audit and the follow-ups that came out of it — useful for catching
drift, not for prescribing what to do next.

## 2026-06-10 — navigation + cleanup pass

Convention sweep found zero violations (service-layer rule, requireCan,
recordEvent, zod-validated actions, integer-cents money all held). The drift
was in the docs, not the code. Shipped:

- CLAUDE.md rewritten around a per-tool file map (schema → service → UI →
  widget → helpers) covering all seven tools; README product shape and repo
  layout updated to match. Branch note fixed: `main` is the live app.
- `"projects"` added to the `Tool` union in `can.ts`; `services/projects.ts`
  no longer borrows `"do"` for requireCan/recordEvent. `project.*` event
  labels added to `event-types.ts`.
- `withFinanceUser` generalized: `server-action.ts` now exports a
  tool-agnostic `withViewer` sharing the same core; the four per-file
  `requireUserId()` helpers in calendar/do/projects/habits actions replaced
  with `resolveActiveUserId()` from viewer-context.
- Duplicate do/habits start-timer buttons collapsed into
  `app/_components/start-timer-button.tsx` (server action passed as a prop).
- `services/habits.ts` (733) and `services/do.ts` (594) split into folders
  with barrels, following the finance template.
- Hub `page.tsx` 1154 → ~200 lines (icons, derive, formatters, and section
  components extracted under `_components/`); `calendar/page.tsx` 773 → 120;
  `habits/habit-card.tsx` 746 → ~210.
- New "Today in review" hub digest (`_lib/daily-digest.ts`, pure + tested):
  time tracked today, due habits hit, month-to-date spend pace (gated on
  finance visibility).
- First DB-backed integration test: `npm run test:integration` exercises
  finance import dedup end-to-end against the dev DB with a throwaway user.
- Repo root screenshots moved to `docs/`; stale `origin/nextjs-rewrite`
  branch deleted.

## 2026-05-16 — refactor pass

Architecture remains sound; the work in this pass was about reducing tax on
future changes rather than fixing bugs. Headline changes shipped:

- `services/finance.ts` (964 lines) split into a `services/finance/` folder
  with focused modules (`accounts`, `goals`, `transactions`, `connections`,
  `teller-sync`, `webhooks`) and a barrel `index.ts` preserving the existing
  `@/lib/services/finance` import path.
- `app/finance/page.tsx` (999 lines) dropped to 51; UI primitives,
  section components, and derivation logic now live under `_components/` and
  `_lib/derive.ts`.
- Money / date helpers extracted to `src/lib/money.ts` and consumed by the
  finance page and widget — no more drift between the two surfaces.
- Privacy mutations moved out of `app/privacy-actions.ts` into
  `services/user.ts`; actions keep the cookie / revalidation work.
- A `withFinanceUser` Server Action wrapper removed ~80 lines of repeated
  auth try/catch boilerplate.
- Teller webhook upserts now batch the account + transaction lookups
  (`findMany IN (...)`) instead of running findFirst-per-tx.
- CSV-imported rows get a deterministic `csv:<sha1>` externalId so the
  `@@unique([userId, externalId])` constraint enforces re-import idempotency.
  `createMany` now uses `skipDuplicates: true` as a belt-and-suspenders.
- Activity widget's `describeEvent` map became a registry in
  `src/lib/event-types.ts`; a sweep test fails if a new `recordEvent` type
  appears without a label.
- Hub "Right now" prompts are now derived (running timer, due-soon cards,
  spend pace delta) with fallbacks when there's no data yet.
- `noUncheckedIndexedAccess: true` enabled in tsconfig — surfaced and fixed
  real `undefined` access bugs in `src/lib/statement-import/*` and
  `src/lib/csv.ts`.
- Service-layer + derivation tests added: total grew 35 → 53.

## 2026-05-14 — initial audit

Original architectural snapshot. The structural foundations called out below
were correct and have held up; the recommendations have either landed or
moved into the roadmap.

### Snapshot

aucosto already has a stronger foundation than a typical early app:
- clear service-layer rule
- shared event log
- widget-based dashboard
- multi-file Prisma schema
- auth split between edge-safe and full server config

### What looked good

- Service-layer discipline real for time + finance
- Event log added early so retrofitting is unnecessary
- Tool boundaries (time, finance, auth, widgets, schema) sane
- Finance CSV parser had real tests instead of zero

### Risks called out (now shipped or moved)

- ~~Event log was write-only~~ → activity widget consuming it now
- ~~Finance imports vulnerable to duplicate-row drift~~ → CSV externalId
  hash + DB unique constraint + `skipDuplicates`
- ~~Time summaries thin~~ → today + week totals + category breakdown
  shipped
- ~~Branch / docs drift~~ → README rewritten, ROADMAP pruned, this audit
  log replaces the old standalone audit doc

### Recommendations still open

- A real Supabase-backed verification pass with seeded data
- First cross-tool insight (spend vs. tracked hours)
- First new tool beyond time + finance (tasks vs. planning is the next
  decision)
