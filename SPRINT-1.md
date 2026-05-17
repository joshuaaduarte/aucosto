# aucosto sprint 1 — done

## Theme

**Make aucosto worth opening every morning**

## What shipped

### Dashboard
- [x] Recent activity widget backed by the Event log
- [x] Hub "Right now" prompts derived from real data (timer, due dates, spend delta)

### Time tracker
- [x] "Today" and "this week" summaries on the tool page
- [x] Category rollups (weekly split)

### Finance
- [x] Deterministic `csv:<sha1>` externalId + `@@unique` + `skipDuplicates`
  so repeat imports cannot duplicate rows
- [x] Import result messaging covers `imported`, `deduped`, `skipped`

### Foundation
- [x] `noUncheckedIndexedAccess: true` plus typecheck-clean tests
- [x] Service-layer tests against the import path (35 → 53)
- [x] `services/finance.ts` split into a folder; `finance/page.tsx`
  reduced from 999 → 51 lines
- [x] Privacy mutations routed through `services/user.ts`
- [x] `withFinanceUser` action wrapper removes auth try/catch boilerplate

## Carried into the next sprint

- Build / migrate / seed / smoke pass against a real Supabase env still
  not executed by us — needs secrets.
- Cross-tool insights (spend vs. tracked hours) still pending; was
  always Phase 4 in `ROADMAP.md`, not a regression.
