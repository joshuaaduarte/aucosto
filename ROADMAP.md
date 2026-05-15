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

## Phase 0 — foundation cleanup

**Goal:** make the repo stable, understandable, and safe to build on.

### Outcomes
- branch strategy is clarified (`main` vs `nextjs-rewrite`)
- README reflects the real product instead of default Next.js scaffold text
- local setup is reproducible end-to-end
- build/lint/test/smoke path is reliable
- docs match reality

### Tasks
- [ ] Decide canonical branch strategy and update docs
- [ ] Replace scaffold README with real project overview
- [ ] Verify `npm run build`, `npm run lint`, and `npm test`
- [ ] Verify DB setup, seed, and `scripts/smoke.ts`
- [ ] Review `CLAUDE.md` / repo docs for drift and fix mismatches
- [ ] Add a short "how to work in this repo" contributor section if needed

### Definition of done
- a new session can clone, install, seed, run, and understand the project without guesswork

---

## Phase 1 — make the first two tools genuinely usable

**Goal:** turn time + finance from promising scaffolds into tools worth using regularly.

### Time tracker

#### Outcomes
- starting/stopping time feels solid
- recent history is easy to scan
- basic summaries make the data useful

#### Tasks
- [ ] Improve start/stop/delete UX and empty states
- [ ] Add validation and edge-case handling around overlapping/running entries
- [ ] Add category-level summaries
- [ ] Add “today” and “this week” rollups
- [ ] Add tests for key time calculations and behavior

### Finance

#### Outcomes
- importing transactions is safe and repeatable
- the transaction list is useful after import
- basic spending summaries exist

#### Tasks
- [ ] Add duplicate import protection or import identity strategy
- [ ] Improve CSV import feedback and error reporting
- [ ] Add filters/search for transactions
- [ ] Add monthly spend summary and recent trends
- [ ] Add tests for import behavior beyond CSV parsing

### Definition of done
- time and finance each solve a real daily problem without feeling fragile

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

## Recommended immediate sprint

If we want the best next move, I’d make the first working sprint:

### Sprint: “Make aucosto worth opening every morning”

#### Sprint goals
- clean up repo/docs enough to move fast confidently
- make time + finance feel dependable
- make the dashboard show useful daily signal

#### Candidate sprint tasks
- [ ] replace README scaffold with real project overview
- [ ] verify local run/build/lint/test/smoke flow
- [ ] add finance duplicate-import guard
- [ ] add time tracker summaries for today/this week
- [ ] add event feed widget to the hub
- [ ] improve hub copy/layout so it feels like a personal command center

#### Sprint success metric
- Joshua can open the app in the morning and immediately get value from it

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
