# aucosto roadmap

## Product direction

aucosto is a personal daily dashboard: a hub for tools that help Joshua run day-to-day life with less friction.

Current foundation:
- time tracking
- finance imports and review
- shared event log
- service-layer architecture for future cross-tool intelligence

Near-term goal:
- make aucosto useful enough to open every morning

Long-term goal:
- become a trusted personal operations system with a clean future agent/API surface

---

## Phase 0 — foundation cleanup ✅

Mostly done as of 2026-05-16. Remaining: real env-backed `build / migrate /
seed / smoke` pass (blocked on production secrets, not work).

---

## Phase 1 — make the first two tools genuinely usable ✅

### Time tracker
- [x] Today + this-week rollups
- [x] Category-level summaries (weekly split)
- [ ] Overlapping/running-entry edge cases still informal — revisit if a real
      bug appears
- [ ] Time-tracker tests beyond what summarization already exercises

### Finance
- [x] Duplicate import protection (CSV externalId hash + DB unique + skipDuplicates)
- [x] Monthly spend, projection, deltas, top categories/merchants/recurring
- [x] Service-layer tests for derivation + dedupe (53 tests total)
- [ ] Transaction list filters / search — still useful, not yet built

---

## Phase 2 — make the hub feel like a dashboard

**Goal:** the home page becomes the default place to understand the day at a glance.

### Outcomes
- the dashboard answers “what’s going on?” quickly
- widgets feel cohesive rather than decorative
- event data starts paying off

### Tasks
- [ ] Add a stronger time widget (today so far, active timer, recent pattern)
- [ ] Add a stronger finance widget (month spend, recent outflows, maybe budget signal)
- [ ] Add recent activity feed from the Event log
- [ ] Add a lightweight “attention needed” or “next actions” area
- [ ] Revisit widget ordering and information density for daily use

### Definition of done
- opening `/app` gives a useful daily snapshot, not just links to tools

---

## Phase 3 — add the first high-leverage third tool

**Goal:** add one tool that increases aucosto’s daily value and ties the system together.

### Recommended options

#### Option A — tasks / follow-ups (**recommended**) 
Why:
- pairs naturally with time tracking
- helps the dashboard answer “what should I do next?”
- creates strong value for eventual agent assistance

Possible scope:
- inbox-style capture
- status (`todo`, `waiting`, `done`)
- due date / follow-up date
- dashboard surfacing for overdue or stuck items

#### Option B — daily planning / agenda
Why:
- strong morning-use behavior
- aligns with how Joshua already works
- could tie together time, tasks, and reminders

Possible scope:
- plan for today
- priorities
- follow-ups
- simple daily notes / reflection

#### Option C — subscriptions / recurring bills
Why:
- fits finance directly
- narrower, useful, but less central than tasks/planning

### Definition of done
- aucosto has a third tool that clearly improves daily usage, not just feature count

---

## Phase 4 — cross-tool insight layer

**Goal:** start making the separate tools smarter together.

### Outcomes
- aucosto begins to show relationships, not just records
- the event log and service boundaries start compounding in value

### Tasks
- [ ] Build a daily/weekly activity timeline from Events
- [ ] Add correlations like time tracked vs. spending patterns
- [ ] Add “recently changed” / “what happened today” views
- [ ] Identify which cross-tool summaries are actually worth surfacing

### Definition of done
- the app shows at least a few insights that would not exist if the tools were isolated

---

## Phase 5 — deliberate agent/API surface

**Goal:** define a safe, minimal external interface only after the product model is proven.

### Outcomes
- agent access is intentional, not bolted on
- the service layer remains the single source of truth
- read/write boundaries are explicit

### Tasks
- [ ] Document first agent use cases worth supporting
- [ ] Define route structure for `/api/tools/<tool>/<op>`
- [ ] Decide token model and permission scope
- [ ] Start with read-mostly endpoints unless a write use case is clearly valuable
- [ ] Reuse service-layer functions rather than creating parallel logic
- [ ] Add audit/logging expectations for agent actions

### Definition of done
- the first external interface is small, boring, and trustworthy

---

## Suggested build order

1. Phase 0 — foundation cleanup
2. Phase 1 — real usability for time + finance
3. Phase 2 — dashboard usefulness
4. Phase 3 — first strong third tool
5. Phase 4 — cross-tool insight layer
6. Phase 5 — agent/API surface

---

## Non-goals for now

- building the full agent API before the product earns it
- adding many small tools too early
- introducing complex multi-user permissions before there is a real need
- over-optimizing infrastructure before daily usage patterns are proven

---

## Open decisions

These should be answered soon because they affect roadmap shape:
- Is the third tool more likely to be **tasks**, **planning**, or **journaling**?
- Is aucosto primarily a **personal dashboard**, or eventually a **personal operating system**?
- Do we want the dashboard optimized for **morning planning**, **all-day tracking**, or both?
- Should finance stay lightweight and manual, or grow toward more serious personal finance workflows?
