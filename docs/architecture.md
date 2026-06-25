# Per-tool architecture reference

Every tool follows the same shape: **schema → service → page/actions →
widget**. `CLAUDE.md` covers the global rules; this file is the per-tool
map. Paths are relative to repo root.

---

## Hub (`/app`)

The daily command center, composed from every other tool.

- **Page:** `src/app/app/page.tsx` — fetches in one `Promise.all`, derives,
  renders sections in priority order: header → `FocusModuleCard` (hero
  recommendation) → `InsightOfTheDayCard` → `DailyDigestSection` (stat
  tiles with progress ring/bars) → `ReflectSection` (mood dots + evening
  nudge) → `CrossToolCallout` → quick actions → decision prompts →
  connections → workspace.
- **Derives:** `_components/hub-derive.ts` (focus module, top actions,
  connections), `_lib/daily-digest.ts` (stat tiles — exposes
  `progress`/`subtle` per line), `_lib/hub-prompts.ts` (decision prompts).
  All pure and tested.
- **Gotchas:** the page tolerates a missing user (`userId ?` branch). The
  digest's finance tile collapses entirely at $0 spend. Insight-of-the-day
  rotates deterministically by day-of-year through eligible candidates
  (`src/lib/insights/daily.ts`).

## Time (`/app/time`)

- **Schema:** `TimeEntry` (label, category, optional `doItemId`/`habitId`
  links, optional `notes`, startedAt/endedAt — `endedAt: null` = running).
- **Service:** `src/lib/services/time.ts` — start (auto-stops previous),
  stop, list (recent includes linked task/habit titles), range reads,
  `createPastEntry` (backfill), `updateEntry` (edit incl. task link/notes).
- **Page:** `page.tsx` + `start-form.tsx` (custom start + quick-start
  chips), `running-card.tsx` (live timer, describe-row, switch panel,
  stop/reflect flows), `quick-start-chips.tsx` (one-tap starts: calendar
  now/next, tasks, habits, preset categories), `gap-backfill-card.tsx`
  (untracked-gap prompt), `entry-editor.tsx` (add/edit modal — exported
  `EntryModal` is reused by the calendar timeline), `entry-row.tsx`
  (two-step delete + note indicator), `insights-section.tsx`.
- **Pure libs:** `src/lib/time.ts` (formatting, day/week starts),
  `src/lib/time-summary.ts`, `src/lib/time-categories.ts` (preset taxonomy
  + colors), `src/lib/time-insights.ts` (windowed summaries, daily stacks,
  coverage, gap detection, recent labels).
- **Gotchas:** starting a timer never navigates — the global timer bar
  (`_components/running-timer-bar.tsx` + `timer-bar-client.tsx`, rendered
  from the app layout) is the persistent UI. The bar hides itself on
  `/app/time`. Entry add/edit times convert client-side (see lessons #10).

## Do — tasks (`/app/do`)

- **Schema:** `DoItem` (lane today/next/later/someday, status, estimate/
  actual minutes, optional `projectId`/`habitId`).
- **Service:** `src/lib/services/do/` (reads/mutations/shared + barrel).
  `DoItemSummary` adds trackedMinutes (from linked TimeEntries),
  scheduledMinutes (from calendar blocks with `sourceRefId`), and
  `effectiveActualMinutes`.
- **Page:** `page.tsx` (metrics, estimation sparkline, lanes — later/
  someday/done render as collapsed `<details>`), `do-item-card.tsx`
  (start timer, Schedule button when unscheduled, completion modal,
  two-step delete, inline edit `<details>`), `schedule-modal.tsx`
  (creates a linked calendar block + flips status to scheduled).
- **Gotchas:** completing a calendar block sourced from a task marks the
  task done (sync lives in `calendar/actions.ts`). Estimation accuracy
  ("Learning") needs both estimate and actual minutes recorded.

## Calendar (`/app/calendar`)

- **Schema:** `CalendarItem` (kind, status, startsAt/endsAt, allDay,
  `sourceTool`/`sourceRefId` for blocks created from tasks/habits).
- **Service:** `src/lib/services/calendar.ts` — has the canonical
  missing-table guard pattern (P2021).
- **Page:** `page.tsx` (takes `?day=YYYY-MM-DD` for timeline navigation),
  `_lib/derive.ts` (buckets, signals, gap suggestions, `calendarItemColor`),
  `_lib/timeline.ts` (pure plan-vs-actual layout: window expansion, lane
  layout with 22-minute visual minimum and Google-Calendar-style sub-columns
  for overlaps — tested), `_components/day-timeline.tsx` (+ nav header),
  `_components/timeline-block.tsx` (tappable blocks: tracked → entry modal,
  planned → block editor, running → /app/time),
  `_components/timeline-now-line.tsx` (client-clock now line),
  `quick-add-modal.tsx` (FAB-driven block creation with task/habit/gap
  suggestions).
- **Gotchas:** the timeline's now-line is client-rendered (server time goes
  stale); all blocks/lines that overlay others need `pointer-events-none`
  unless interactive. Color language: task blocks = `categoryColor("do")`,
  habit = `"habit"`, native = `"calendar"`.

## Habits (`/app/habits`)

- **Schema:** `Habit` (dayPart, cadence, goalUnit check/count/minutes,
  targetCount, defaultDurationMinutes, fallbackTitle/rescuePrompt,
  archivedAt) + `HabitEntry` (mode full/fallback/recovery, quantity,
  loggedAt). Emoji icons live **in the title** (zero schema cost) —
  `splitLeadingEmoji` in `src/lib/habit-templates.ts` extracts them.
- **Service:** `src/lib/services/habits/` — `derive.ts` is the heart
  (~430 lines): due-ness per cadence, streaks (current/kept-alive/longest),
  30d rates (already 0–100, do NOT multiply by 100 again), `recentDays`
  window, progress that **includes linked TimeEntries for minutes habits**
  (timer minutes auto-credit). Mutations include `logHabitProgress`,
  `removeTodayHabitEntries` (undo), `startTimerForHabit`.
- **Page:** `page.tsx` ("N of M today" header, pending grouped by day part,
  done-today chips — tappable via `DoneHabitChip`, not-due + archived
  collapsed, template picker as the empty state), `habit-card.tsx` (compact
  card: one-tap log by goal type — ✓ Done / +1 counter (bulk "Log…" when
  target > 20) / ▶ start timer; streak hero; opens
  `_components/habit-detail-modal.tsx`: stats, 7-day mini calendar, Today
  row with Add more / two-step Undo, edit form, archive/delete),
  `create-form.tsx` (title + when + track-by; the rest behind More
  options), `_components/template-picker.tsx` (one-tap presets from
  `src/lib/habit-templates.ts`).
- **Gotchas:** `bucket` doubles as the color key via `categoryColor`. The
  `habit-pop` CSS utility re-animates keyed elements on progress change.

## Projects (`/app/projects`)

- **Schema:** `Project`; tasks link via `DoItem.projectId` (SetNull).
  Planning fields (`goal`, `why_it_matters`, `open_questions`, `blockers`,
  `plan_notes`) added via raw SQL ensure (`src/lib/services/project-planning.ts`);
  `nextMilestone`, `nextAction`, `targetDate` already existed in the Prisma schema.
- **Service:** `src/lib/services/projects.ts` — `ProjectSummary` rolls up
  linked-task counts, tracked/scheduled minutes, health flags.
  `deleteProject` takes `{ deleteTasks }` (the delete dialog offers both).
  `src/lib/services/project-planning.ts` — `getProjectPlan`, `updateProjectPlan`,
  array helpers (`addProjectQuestion/Blocker`, `removeProjectQuestion/Blocker`),
  `listProjectPlanSummaries` (feeds assistant snapshot).
- **UI:** `page.tsx`, `create-form.tsx`, `edit-form.tsx`,
  `delete-project-button.tsx` (choice dialog), `project-planning-forms.tsx`
  (task + schedule-block creation), `_components/project-plan-section.tsx`
  (inline-editable planning section on detail page — goal, next action banner,
  milestone, blockers, open questions, notes).
- **Actions:** `plan-actions.ts` — update/add/remove planning field actions.

## Rolodex (`/app/rolodex`)

Contact relationship manager. No Prisma-generated client — uses raw SQL
`ensureRolodexTables()` pattern (three tables: `RolodexPerson`,
`RolodexInteraction`, `RolodexMention`).

- **Schema:** `prisma/schema/rolodex.prisma` (for future `prisma migrate`);
  runtime tables created by `ensureRolodexTables()` in service.
- **Service:** `src/lib/services/rolodex.ts` — full CRUD for persons;
  interaction log (title, body, follow-up flag/date); @mention tracking;
  `findPersonByName` (case-insensitive includes across displayName/firstName/
  lastName/aliases); snapshot helpers: `getUpcomingBirthdays` (30d window),
  `getDueFollowUps`, `getRecentlyMentioned`, `listUnresolvedMentions`.
- **UI:** `page.tsx` (list + search + relationship-type filter; birthday
  countdown chips), `new/page.tsx` (create form via `useActionState`),
  `[id]/page.tsx` (detail: notes, follow-ups, gift ideas, interaction
  timeline), `[id]/edit/page.tsx` + `_edit-form.tsx` (edit person + inline
  log-interaction panel).
- **Actions:** `actions.ts` — `createPersonAction`, `updatePersonAction`,
  `addInteractionAction`, `resolveMentionAction`.
- **Assistant integration:** snapshot includes upcoming birthdays, due
  follow-ups, recently mentioned persons, unresolved @mention count.
  Action executor handles `create_rolodex_person`, `update_rolodex_person`,
  `add_rolodex_interaction`, `add_person_followup`, `add_gift_idea`.

## Finance (`/app/finance`)

Visibility-gated by `User.financeVisible` (check `context.financeVisible`
before fetching; `withFinanceUser` wraps actions). Money is **integer
cents**, negative = outflow. Service split under
`src/lib/services/finance/`; Teller bank sync in `src/lib/teller.ts` +
webhook route; CSV/PDF statement import under `src/lib/statement-import/`.
Largely untouched by recent work except insights consumption.

## Reflect (`/app/reflect`)

- **Schema:** `DailyReflection` — one row per user per local day: four 1–5
  ratings (mood/energy/productivity/day), three prose fields, JSONB
  `contextSnapshot` captured at save time.
- **Service:** `src/lib/services/reflect.ts` — ⚠️ **raw SQL** (see
  CLAUDE.md "known technical debt"). Reads degrade to empty on ANY error;
  `buildReflectionSnapshot` composes tracked minutes, entry notes, tasks
  completed, and habit progress from the other services.
- **UI:** `page.tsx` (context card + mood-dot strip),
  `reflection-form.tsx` (emoji 1–5 scales, pre-filled when today exists),
  `history/page.tsx` (mood-edged expandable rows).
- **Pure lib:** `src/lib/reflect.ts` (MOOD_SCALE, dayKey, snapshot types).
- **Hub/nav hooks:** `ReflectSection` (7 mood dots + 6pm nudge /
  "Reflected ✓"), More-tab badge dot while today is unreflected (layout
  fetches `getReflection` — inside try/catch, keep it that way).

## Insights (`/app/insights`)

- **Pure lib:** `src/lib/insights/` — `shared.ts` (ranges, week/day
  bucketing, rolling averages), `trends.ts` (time allocation, wellbeing
  with 7-day rolling, habit consistency, estimation accuracy with trend
  labels, plan-vs-actual, spend), `patterns.ts` (six correlation findings
  from `DayFacts`), `daily.ts` (insight-of-the-day rotation + tool-page
  sparklines). All tested in `tests/insights.test.ts`.
- **Page:** `page.tsx` (`?range=7d|30d|90d|1y|all`, range-filtered
  queries), `_components/charts.tsx` (hand-rolled SVG/CSS primitives:
  Sparkline, MiniBars, StackedColumns, SimpleColumns),
  `_components/wellbeing-chart.tsx` (client, togglable series).
- **Mini-trends embedded elsewhere:** time page 8-week sparkline, do page
  estimation sparkline, habit-card 30d bar, calendar plan→tracked 7d bar,
  reflect-page mood dots.
- **Gotchas:** charts are deliberately dependency-free. Every section has a
  not-enough-data state; pattern findings have minimum sample thresholds.

## Cross-cutting components (`src/app/app/_components/`)

- `running-timer-bar.tsx` / `timer-bar-client.tsx` — global timer bar
  (layout-rendered; publishes `--timer-bar-height` while visible).
- `mobile-tab-bar.tsx` — bottom tabs (Hub/Time/Do/Calendar) + More sheet
  (Habits/Projects/Finance/Insights/Reflect/Settings, theme, sign-out).
- `use-body-scroll-lock.ts` — reference-counted body scroll lock; every
  modal uses it.
- `start-timer-button.tsx` — shared "start timer from X" (no navigation).
- `insight-of-the-day.tsx`, `reflect-section.tsx` — hub cards.
