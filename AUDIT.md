# aucosto audit — 2026-05-14

## Snapshot

aucosto already has a stronger foundation than a typical early app:
- clear service-layer rule
- shared event log
- widget-based dashboard
- multi-file Prisma schema
- auth split between edge-safe and full server config

The repo feels structurally thoughtful.

The main challenge now is not architecture from scratch; it is making sure the current architecture starts paying rent in the product.

---

## What looks good

### 1. Service-layer discipline is real
The time and finance tools already route mutations and reads through tool services. That is the right long-term seam for:
- cross-tool reuse
- future API endpoints
- safer schema evolution

### 2. Event log was added early
This was a smart move. It is much easier to add event capture now than retrofit it after several tools diverge.

### 3. Tool boundaries are understandable
Time, finance, auth, widgets, and Prisma schema are laid out in a way that should scale to a few more tools without getting messy immediately.

### 4. Tests exist in at least one meaningful area
The finance CSV parser has real tests instead of zero tests. That is a good sign.

---

## Risks and weak spots

### 1. Event log is write-only right now
Events are recorded, but there is no actual product surface consuming them yet.

**Why it matters:**
If the dashboard does not use the event stream soon, the architecture starts to feel theoretical instead of useful.

**Recommendation:**
Make recent activity a first-class hub widget soon.

### 2. Finance imports are not protected against duplicates
`importTransactions()` uses `createMany()` with no deduping or import identity.

**Risk:**
A repeated CSV import can silently duplicate transactions.

**Recommendation:**
Add a dedupe strategy early, even if it is conservative.

### 3. Time summaries are still thin
The tracker has a good skeleton, but daily/weekly usefulness is still limited.

**Risk:**
The tool feels like a timer demo rather than a habit-forming daily tool.

**Recommendation:**
Add today/this-week/category summaries soon.

### 4. Environment setup is still a real barrier
This got better after adding `.env.example`, but the repo still cannot be fully verified without real local secrets.

**Risk:**
New setup remains fragile until a real build/migrate/seed/smoke pass succeeds with documented env values.

**Recommendation:**
Complete a real environment-backed verification pass when secrets are available.

### 5. Branch/docs drift exists
The repo docs mention a `main` vs `nextjs-rewrite` split that no longer matches current branch state.

**Risk:**
This is small now, but drift compounds trust issues in docs.

**Recommendation:**
Resolve branch strategy explicitly.

---

## Best immediate product opportunities

### Highest leverage
1. recent activity widget from events
2. finance duplicate import protection
3. stronger time summaries

### Why this order
- the event widget converts existing architecture into visible value fast
- duplicate protection addresses the largest practical data-integrity risk
- time summaries improve daily usefulness without major new surface area

---

## Recommended next sprint

### Sprint theme
**Make aucosto worth opening every morning**

### Concrete tasks
1. add recent activity widget to the hub
2. add time rollups for today and this week
3. add duplicate import protection for finance
4. verify build/migrate/seed/smoke with real env
5. resolve branch/docs drift

---

## Overall judgment

aucosto is in a good place.

The repo does not need a reinvention. It needs:
- a few practical safeguards
- one or two product surfaces that prove the architecture matters
- a clean environment verification pass

That is encouraging. The next wins should come from making the current foundation useful, not from adding a lot of new surface area.
