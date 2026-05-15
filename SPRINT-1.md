# aucosto sprint 1

## Theme

**Make aucosto worth opening every morning**

## Goals

- make the hub more informative
- reduce obvious data-integrity risk in finance
- make time tracking more useful beyond a running timer
- finish practical setup verification

## Proposed task list

### Dashboard
- [ ] Add recent activity widget backed by the Event log
- [ ] Improve dashboard information density and ordering if needed after the widget lands

### Time tracker
- [ ] Add "today" summary on the tool page
- [ ] Add "this week" summary on the tool page or widget
- [ ] Add category rollups

### Finance
- [ ] Define duplicate detection strategy
- [ ] Prevent accidental duplicate imports
- [ ] Improve import result messaging when rows are skipped or deduped

### Foundation
- [ ] Verify build with real `.env`
- [ ] Verify migrate / seed / smoke path with real `.env`
- [ ] Resolve `main` vs `nextjs-rewrite` doc drift

## Suggested implementation order

1. recent activity widget
2. finance duplicate protection
3. time summaries
4. env-backed verification
5. branch/docs cleanup

## Definition of success

By the end of this sprint:
- the dashboard gives useful daily signal
- finance is safer to use repeatedly
- time tracker data is more actionable
- setup is documented and verified well enough to trust
