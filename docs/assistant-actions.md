# Assistant Actions API

The assistant actions layer lets an external AI agent (e.g. OpenClaw) read context and safely write back to the app through a structured, audited HTTP surface.

---

## 1. Overview

Design principles:
- **Preview before execute.** Every write is a two-step flow: preview (validates, returns human-readable summary, records audit) → execute (runs the mutation).
- **Risk levels gate confirmation.** Low-risk actions execute immediately; medium-risk require `confirmed: true`; high-risk are rejected outright.
- **All writes are audited.** Every preview and execute call writes a row to `assistant_action_audits` so Josh can review what the agent has done.
- **No finance writes, no deletes, no bulk ops.** The action surface is intentionally narrow.

---

## 2. Authentication

All endpoints accept **either** of:

1. A valid session cookie — the same session used by the web app. `auth()` is
   verified on every request; `401 Unauthorized` is returned if absent.
2. A bearer token: `Authorization: Bearer $ASSISTANT_API_SECRET`, where the
   secret is configured via the `ASSISTANT_API_SECRET` env var. The token
   resolves to the owner user (single-user app). Constant-time comparison,
   mirroring `/api/location/ingest`. If the env var is unset, bearer auth is
   unavailable and session-cookie access keeps working unchanged.

Security note: the bearer key is **owner-equivalent**. Like a logged-in
session, it bypasses viewer context — demo mode, the app privacy lock, and
the finance visibility gate are not enforced on assistant routes. Treat the
secret like a password (server env only, never logged or committed). See
`docs/agent-api.md` for deploy, rotation, and MCP client setup.

---

## 3. Endpoint Reference

### `GET /api/assistant/snapshot`
Full context read — facts, signals, briefing, and user metadata. No write.

**Response shape:**
```json
{
  "facts": { "today": { ... }, "yesterday": { ... }, "week": { ... } },
  "signals": { "hasRunningTimer": true, "possiblyStaleTimer": false, ... },
  "briefing": { "currentState": "open_morning_timer_commute", "topSignals": [...], ... },
  "user": { "timezone": "America/Los_Angeles" },
  "generatedAt": "2024-06-24T16:30:00.000Z"
}
```

---

### `GET /api/assistant/capabilities`
Returns the full action registry with risk levels and descriptions.

**Response shape:**
```json
{
  "actions": [
    { "action": "stop_timer", "risk": "medium", "confirmationRequired": true, "supported": true, "description": "..." },
    ...
  ]
}
```

---

### `POST /api/assistant/actions/preview`
Validate and preview an action. **No mutation.** Records a `previewed` audit row.

**Request body:**
```json
{
  "action": "stop_timer",
  "input": { "endedAtLocal": "2024-06-24T09:15:00" },
  "source": { "actor": "openclaw", "channel": "chat", "conversationId": "abc123" }
}
```

**Success response (200):**
```json
{
  "ok": true,
  "action": "stop_timer",
  "risk": "medium",
  "requiresConfirmation": true,
  "previewText": "Stop timer: Commute\nStarted: 8:55 AM · Running for 5h 20m\nProposed end: 9:15 AM\nFinal duration: 20m",
  "normalizedInput": { "entryId": "abc", "endedAtIso": "2024-06-24T17:15:00.000Z", "note": null },
  "warnings": [],
  "auditId": "uuid"
}
```

**Error response (400):**
```json
{
  "ok": false,
  "error": "No timer is currently running",
  "auditId": "uuid"
}
```

**Ambiguity error (400):**
```json
{
  "ok": false,
  "error": "Ambiguous habit match for \"Read\" — pass the exact name: \"Read\", \"Read Bible\".",
  "candidates": [
    { "id": "h1", "name": "Read", "bucket": "reading" },
    { "id": "h2", "name": "Read Bible", "bucket": "spiritual" }
  ],
  "auditId": "uuid"
}
```

**Validation notes:**

- Every schema violation is reported, not just the first — e.g.
  `date: date must be YYYY-MM-DD (e.g. 2026-10-16); startTime: startTime must be HH:MM from 00:00 to 23:59`.
- Calendar `date`/`startTime`/`endTime` are validated strictly: impossible
  times (`24:00`) and impossible dates (`2026-02-30`) are rejected instead of
  rolling over into a different day.
- "Not found" errors name where valid ids come from, e.g.
  `Task "abc" not found — list tasks via GET /api/assistant/tasks to get a valid task id`.
- Execute always re-runs the full preview validation first; if the preview
  fails, nothing is mutated.

---

### `POST /api/assistant/actions/execute`
Execute an action. Runs the mutation, records an `executed` or `rejected` audit row.

**Request body:**
```json
{
  "action": "stop_timer",
  "input": { "endedAtLocal": "2024-06-24T09:15:00" },
  "confirmed": true,
  "source": { "actor": "openclaw" }
}
```

`confirmed: true` is required for medium-risk actions. High-risk actions always return an error.

**Success response (200):**
```json
{
  "ok": true,
  "action": "stop_timer",
  "summary": "Stopped running timer",
  "recordId": null,
  "recordType": "TimeEntry",
  "auditId": "uuid"
}
```

---

### `GET /api/assistant/actions/history`
Returns recent audit rows for the authenticated user.

**Query params:** `?limit=20` (max 100)

**Response shape:**
```json
{
  "audits": [
    {
      "id": "uuid",
      "action": "stop_timer",
      "status": "executed",
      "riskLevel": "medium",
      "confirmed": true,
      "actor": "openclaw",
      "previewText": "Stop timer: Commute\n...",
      "createdAt": "2024-06-24T16:15:00.000Z"
    }
  ],
  "count": 1
}
```

---

### `GET /api/assistant/tasks`
List tasks/do items with IDs. The snapshot only shows today's open tasks;
use this when you need IDs (e.g. `complete_task` and `update_task` require
`taskId`) or the full backlog.

**Query params:** `?includeDone=false` `?limit=100` (max 200)

**Response shape:**
```json
{
  "items": [
    {
      "id": "task_abc",
      "title": "Write the report",
      "lane": "next",
      "status": "open",
      "bucket": "today",
      "projectId": "p1",
      "projectName": "Aucosto",
      "habitId": null,
      "habitTitle": null,
      "estimatedMinutes": 30,
      "actualMinutes": null,
      "notes": "draft first",
      "completedAt": null,
      "createdAt": "2024-06-23T10:00:00.000Z",
      "updatedAt": "2024-06-24T10:00:00.000Z"
    }
  ],
  "count": 1
}
```

### `GET /api/assistant/habits`
List habits with IDs, streaks, and today's completion state.

**Query params:** `?includeArchived=false`

**Response shape:**
```json
{
  "items": [
    {
      "id": "h1",
      "title": "Read",
      "bucket": "evening",
      "currentStreak": 5,
      "longestStreak": 12,
      "completedToday": true,
      "dueToday": true,
      "needsSaveToday": false,
      "targetLabel": "daily",
      "dayPartLabel": "Evening"
    }
  ],
  "count": 1
}
```

### `GET /api/assistant/projects`
List projects with IDs, status, open task counts, and next actions.

**Response shape:**
```json
{
  "items": [
    {
      "id": "p1",
      "name": "Aucosto",
      "status": "active",
      "openTaskCount": 3,
      "doneTaskCount": 7,
      "nextAction": "Ship the API",
      "lastWorkedAt": "2024-06-24T08:00:00.000Z",
      "daysUntilTarget": 10
    }
  ],
  "count": 1
}
```

### `GET /api/assistant/calendar`
List calendar blocks in a date range (max 90 days).

**Query params:** `?from=<ISO datetime with offset>` `?to=<ISO datetime with offset>`.
Defaults: `from` = now, `to` = from + 7 days.

**Response shape:**
```json
{
  "items": [
    {
      "id": "c1",
      "title": "Deep work",
      "kind": "block",
      "status": "confirmed",
      "startsAt": "2024-06-25T16:00:00.000Z",
      "endsAt": "2024-06-25T18:00:00.000Z",
      "allDay": false,
      "location": "Home office",
      "notes": null,
      "sourceTool": "do"
    }
  ],
  "count": 1
}
```

---

### `GET /api/assistant/people-time`
Per-person time totals for a date range (max 90 days) — "who am I spending time
with?" Minutes are attributed in full to every linked person (a 60-minute
dinner with two people counts 60 minutes each).

**Query params:** `?from=<ISO datetime with offset>` `?to=<ISO datetime with offset>`.
Defaults: `to` = now, `from` = to − 7 days.

**Response shape:**
```json
{
  "items": [
    {
      "personId": "p1",
      "displayName": "Ana",
      "totalMinutes": 150,
      "entryCount": 2,
      "byCategory": [
        { "category": "eating", "minutes": 90 },
        { "category": "social", "minutes": 60 }
      ]
    }
  ],
  "count": 1
}
```

---

### `GET /api/assistant/reflections`
Daily mood/reflection series for a date range (max 90 days) — the data behind
mood/energy trend views and correlations like "do table-tennis days score
higher?" One row per day **that has a reflection record**; days without a
reflection are omitted (not returned as nulls).

**Query params:** `?from=<YYYY-MM-DD>` `?to=<YYYY-MM-DD>`.
Defaults: `to` = today, `from` = to − 30 days.

**Response shape:**
```json
{
  "items": [
    { "date": "2026-10-10", "mood": 4, "note": "Went well: Shipped the PR\nTired by evening" },
    { "date": "2026-10-12", "mood": 5, "note": null }
  ],
  "count": 2
}
```

The `note` combines the reflection's prose fields (`wentWell`, `carryForward`,
`freeNotes`) into a single string, or is `null` when all are empty.

---

### `POST /api/assistant/mcp`
Minimal MCP server (stateless Streamable HTTP, JSON-RPC 2.0 over POST; no
SSE). Same auth as above. Twelve tools: `assistant_snapshot`,
`assistant_capabilities`, `assistant_preview_action`,
`assistant_execute_action`, `assistant_list_tasks`, `assistant_list_habits`,
`assistant_list_projects`, `assistant_list_calendar`,
`assistant_list_people_time`, `assistant_list_planned_vs_actual`,
`assistant_list_reflections`, `assistant_action_history`.

Tool input contracts reuse the executor's zod schemas; preview/execute go
through the same risk gating and audit trail as the REST routes. See
`docs/agent-api.md` for client configuration.

---

## 4. Risk Levels and Confirmation Rules

| Risk | `confirmationRequired` | Behavior |
|------|----------------------|----------|
| `low` | `false` | Executes immediately without `confirmed` |
| `medium` | `true` | Requires `confirmed: true` in execute body |
| `high` | `true` | Always rejected — cannot execute via API |

Current risk assignments:
- `low`: `add_gift_idea`, `add_person_followup`, `add_project_blocker`, `add_project_milestone`, `add_project_question`, `add_reflection`, `add_rolodex_interaction`, `create_habit`, `create_project`, `create_rolodex_person`, `create_task`, `log_habit`, `set_project_next_action`
- `medium`: `complete_task`, `create_calendar_block`, `delete_calendar_event`, `delete_project`, `delete_time_entry`, `edit_time_entry`, `log_time_entries`, `log_time_entry`, `start_timer`, `stop_timer`, `swap_timer`, `update_calendar_event`, `update_project`, `update_project_plan`, `update_rolodex_person`, `update_task`
- `high`: `finance_write` (also `supported: false`)

---

## 5. Request/Response Examples

### Create task (low risk, no confirmation needed)
```
POST /api/assistant/actions/execute
{
  "action": "create_task",
  "input": {
    "title": "Spend 30 minutes on Aucosto actions",
    "projectName": "Aucosto",
    "bucket": "today"
  },
  "source": { "actor": "openclaw" }
}
```

Preview text:
```
Create task: Spend 30 minutes on Aucosto actions
Project: Aucosto
Lane: today
```

### Create project (low risk, no confirmation needed)
```
POST /api/assistant/actions/execute
{
  "action": "create_project",
  "input": {
    "name": "Split-Flap Display",
    "intent": "Build a working split-flap display for the office",
    "timeBudgetMinutes": 180
  },
  "source": { "actor": "openclaw" }
}
```

`status` must be one of `exploring`, `active`, `final_push`, `paused`, `done`;
`energyType` must be one of `deep`, `light`, `creative`, `admin`. Unknown
values are rejected (never silently normalized).

### Delete project (medium risk — preview shows the blast radius)
The preview lists exactly what deletion destroys: project tasks (always
permanently deleted with the project), to-do items (deleted only with
`deleteTasks: true`, otherwise kept but unlinked), and time entries (always
kept but unlinked).

### Create habit (low risk, no confirmation needed)
```
POST /api/assistant/actions/execute
{
  "action": "create_habit",
  "input": {
    "title": "Weigh-in",
    "cadence": "daily",
    "dayPart": "morning"
  },
  "source": { "actor": "openclaw" }
}
```

### Update calendar event (medium risk — preview first, then confirm)
```
POST /api/assistant/actions/preview
{
  "action": "update_calendar_event",
  "input": { "eventId": "<id-from-calendar>", "startTime": "16:00", "endTime": "17:00" },
  "source": { "actor": "openclaw" }
}
```
Then execute with `"confirmed": true`. Partial time input keeps the
event's original date; only changed fields are patched.

### Log habit (low risk)
```
POST /api/assistant/actions/execute
{
  "action": "log_habit",
  "input": { "habitName": "Meditate", "value": 1 },
  "source": { "actor": "openclaw" }
}
```

### Stop timer (medium risk — preview first, then confirm)
```
POST /api/assistant/actions/preview
{
  "action": "stop_timer",
  "input": { "endedAtLocal": "2024-06-24T09:15:00" },
  "source": { "actor": "openclaw" }
}
```

Preview text:
```
Stop timer: Commute
Started: 8:55 AM · Running for 5h 20m
Proposed end: 9:15 AM
Final duration: 20m
```

The optional `entryId` must match the currently running timer's id — a
mismatch fails the preview (`entryId "x" does not match the running timer
"Commute" (id "abc") — …`) instead of stopping the wrong timer. Omit it to
stop whatever is running.

Then execute:
```
POST /api/assistant/actions/execute
{
  "action": "stop_timer",
  "input": { "endedAtLocal": "2024-06-24T09:15:00" },
  "confirmed": true,
  "source": { "actor": "openclaw" }
}
```

### Swap timer (medium risk — preview first, then confirm)

Atomically stops the currently running timer and starts a new one in a
single action, replacing the stop → find → edit → start dance. The optional
`note` is saved onto the stopped entry (e.g. what was accomplished);
`categoryName`, `habitName`, and `personNames` apply to the *new* timer.
If no timer is running, it just starts the new one and the note is ignored.
```
POST /api/assistant/actions/preview
{
  "action": "swap_timer",
  "input": {
    "title": "Deep work",
    "note": "Finished the repair dashboard",
    "categoryName": "work",
    "personNames": ["Ana"]
  },
  "source": { "actor": "openclaw" }
}
```

Preview text:
```
Stop "Commute" (running 42m) and start "Deep work" [work] · with Ana
Note saved on stopped entry: "Finished the repair dashboard"
```

Then execute with `"confirmed": true` as usual.

### Edit time entry (medium risk)
```
POST /api/assistant/actions/preview
{
  "action": "edit_time_entry",
  "input": {
    "entryId": "abc123",
    "startedAt": "2024-06-24T08:55:00.000Z",
    "endedAt": "2024-06-24T09:15:00.000Z"
  }
}
```

Preview text:
```
Edit time entry: Commute
Before: 8:55 AM–5:52 PM · 8h 56m
After: 8:55 AM–9:15 AM · 20m
```

The entry is looked up by id directly (any age — not limited to recent entries). The preview rejects an `endedAt` at or before `startedAt` and windows over 24 hours; passing no changes at all is an error, not a silent no-op.

### Delete time entry (medium risk)
```
POST /api/assistant/actions/preview
{
  "action": "delete_time_entry",
  "input": { "entryId": "abc123" }
}
```

Preview text:
```
Delete time entry: Commute
2024-06-24 8:55 AM–9:15 AM · 20m
Category: commute
Linked people (links removed): Ana
```

- Deletes exactly one **completed** time entry by id.
- Entry not found → clean error, no-op.
- A currently **running** timer is refused with an error telling the caller to
  `stop_timer` first (this also gates `execute`, which re-validates via preview).
- `TimeEntryPerson` links for the deleted entry are cleared first, so no
  orphaned people-links remain.

### Batch log time entries (medium risk)
```
POST /api/assistant/actions/preview
{
  "action": "log_time_entries",
  "input": {
    "entries": [
      { "title": "Morning run", "startedAt": "2024-06-24T13:30:00.000Z", "endedAt": "2024-06-24T14:15:00.000Z", "categoryName": "run" },
      { "title": "Deep work", "startedAt": "2024-06-24T16:00:00.000Z", "endedAt": "2024-06-24T18:30:00.000Z", "personNames": ["Ana"] }
    ]
  }
}
```

Each entry accepts the same fields as `log_time_entry` (`title`,
`startedAt`, `endedAt`, `categoryName`, `notes`, `personNames`,
`calendarEventId` / `calendarTitle`). 1–50 entries per call; an empty array
is rejected, and batches over 50 must be split into multiple calls.

**All-or-nothing validation:** every entry is validated before any are
written — one bad entry rejects the whole batch, with per-entry errors
carrying the index and title (`entries[1] "Deep work": End time must be
after start time.`). People/calendar resolution is the same warn-and-skip
as `log_time_entry`, with warnings prefixed by the entry index (`[1] ...`)
so the confirmer sees exactly which entry each warning belongs to.

Preview text:
```
Log 2 time entries (3h 15m total)
[0] "Morning run" · 6:30 AM–7:15 AM · 45m · run
[1] "Deep work" · 9:00 AM–11:30 AM · 2h 30m · with Ana
```

Execute writes the entries in order and returns per-entry results (`entries`
on the execute result: `{ index, title, recordId }` per entry, with `error`
set instead of `recordId` for any write that failed mid-batch — nothing is
silently dropped). Use `log_time_entries` instead of N `log_time_entry`
calls when backfilling a day.

### Linking people to time entries (medium risk)

`start_timer`, `swap_timer`, `log_time_entry`, `log_time_entries`, and `edit_time_entry` accept an
optional `personNames` array of Rolodex display names. Names resolve
exact-first, then single fuzzy match; unknown or ambiguous names produce a
warning and are skipped — the action never fails and never guesses.

- On `start_timer` / `swap_timer` / `log_time_entry`, resolved people are
  linked to the new entry (`swap_timer` links them to the newly started timer,
  not the stopped one).
- On `edit_time_entry`, `personNames` uses **replace semantics**: the provided
  list becomes the full linked set. Pass `[]` to clear links; omit the field
  to leave links untouched.
```
POST /api/assistant/actions/preview
{
  "action": "log_time_entry",
  "input": {
    "title": "Tennis",
    "startedAt": "2024-06-24T18:00:00.000Z",
    "endedAt": "2024-06-24T19:30:00.000Z",
    "personNames": ["Ana", "Cecil"]
  }
}
```

Preview text:
```
Log time entry "Tennis"
6:00 PM–7:30 PM · 1h 30m · with Ana, Cecil
```

Links live in the `TimeEntryPerson` join table (many-to-many: one entry can
involve several people). Query them via `GET /api/assistant/people-time` or
the `assistant_list_people_time` MCP tool.

### Linking calendar blocks to time entries (medium risk)

`start_timer`, `log_time_entry`, and `log_time_entries` (per entry) accept an optional `calendarEventId`
(explicit calendar block id — a virtual recurrence-occurrence id like
`parentId::2026-10-15T14:00:00.000Z` also works and resolves to the parent row)
or `calendarTitle` (fuzzy-matched against **today's** calendar blocks: an exact
title (case-insensitive) wins; a single close match warns and skips with a
suggestion instead of linking; unknown/ambiguous names warn and skip — never
fail, never guess). The event must exist and belong to the user; an unknown id
warns and skips rather than failing the action (the warning points at
`GET /api/assistant/calendar` for valid ids). An explicit id always wins over
a title. The link is stored as the backing `CalendarItem` id in
`TimeEntry.calendarEventId`; deleting the calendar event clears the link
(`ON DELETE SET NULL`) without touching the entry.

**Auto-suggestion (never auto-applied):** when no link is given, the preview
also returns `suggestedCalendarLink: { eventId, title }` — when `start_timer`
fires within 15 minutes of a block's start, or when a `log_time_entry` window
overlaps a block's time range. It appears as a dedicated field on the preview
and execute responses (and in `normalizedInput`), so the assistant can show it
and confirm. Nothing is linked without an explicit `calendarEventId` /
`calendarTitle` in a confirmed action.

```json
{
  "action": "log_time_entry",
  "input": {
    "title": "Gym",
    "startedAt": "2024-06-24T18:00:00.000Z",
    "endedAt": "2024-06-24T19:00:00.000Z",
    "calendarTitle": "gym"
  }
}
```
→ preview includes `"suggestedCalendarLink": { "eventId": "abc123", "title": "Gym" }` when the window overlaps the Gym block.

### Planned vs actual

```http
GET /api/assistant/planned-vs-actual?date=2024-06-24
```
(date defaults to today, server-local). For each calendar block that day:
planned window, linked time entries (id, title, actual start/end), and deltas:

- `plannedMinutes` — rounded planned block duration
- `actualMinutes` — sum of linked **completed** entry durations (running
  entries are listed with `actualEnd: null` but excluded from the sum)
- `deltaMinutes` = `actualMinutes − plannedMinutes` (negative = under plan)
- `startDriftMinutes` — first linked entry's start minus the block's planned
  start, in minutes (positive = started late; `null` when nothing is linked)

Blocks with no linked entries still appear (empty `actualEntries`) so gaps are
visible. Also available as the `assistant_list_planned_vs_actual` MCP tool.

```json
{
  "date": "2024-06-24",
  "blocks": [
    {
      "eventId": "abc123",
      "title": "Gym",
      "plannedStart": "2024-06-24T18:00:00.000Z",
      "plannedEnd": "2024-06-24T19:00:00.000Z",
      "plannedMinutes": 60,
      "actualEntries": [
        {
          "entryId": "e1",
          "title": "Gym",
          "actualStart": "2024-06-24T18:05:00.000Z",
          "actualEnd": "2024-06-24T18:50:00.000Z"
        }
      ],
      "actualMinutes": 45,
      "deltaMinutes": -15,
      "startDriftMinutes": 5
    }
  ],
  "count": 1
}
```

---

## 6. Stale Timer Repair — End-to-End Example

OpenClaw detects `signals.possiblyStaleTimer = true` in the snapshot. The running timer is `Commute`, started at 8:55 AM, and it's now 2:15 PM (5h 20m elapsed, threshold for commute is 90 min).

**Step 1 — Read snapshot**
```
GET /api/assistant/snapshot
→ signals.possiblyStaleTimer: true
→ facts.today.time.runningTimer.title: "Commute"
→ facts.today.time.runningTimer.elapsedMinutes: 320
```

**Step 2 — Preview stop**
```
POST /api/assistant/actions/preview
{
  "action": "stop_timer",
  "input": { "endedAtLocal": "2024-06-24T09:15:00" }
}
→ previewText: "Stop timer: Commute\nStarted: 8:55 AM · Running for 5h 20m\nProposed end: 9:15 AM\nFinal duration: 20m"
→ risk: "medium", requiresConfirmation: true
```

**Step 3 — Show preview to Josh, get confirmation**

**Step 4 — Execute**
```
POST /api/assistant/actions/execute
{
  "action": "stop_timer",
  "input": { "endedAtLocal": "2024-06-24T09:15:00" },
  "confirmed": true
}
→ summary: "Stopped running timer"
```

---

## 7. Ambiguity Error Handling

Every name lookup across actions follows one policy — **exact wins, never
guess**:

- **Exact (case-insensitive) match** → used, no warning.
- **Single close (substring) match** → never picked silently.
- **Zero or ambiguous matches** → never guessed.

What "never picked silently" means depends on whether the name is required:

**Required names** (`log_habit` → `habitName`, `update_project` and the
project-planning actions → `projectName`, Rolodex actions → `personName`)
fail the preview with `ok: false` and a `candidates` array:

- single close match → `No habit exactly matching "morn" — did you mean "Morning Run"? Pass the exact name and retry.` (candidate included)
- ambiguous → `Ambiguous habit match for "read" — pass the exact name: "Read Books", "Read Bible".`
- no match → `No habit found matching "zzz". Known habits: "Morning Run", "Read". List habits via GET /api/assistant/habits.`

**Optional names** (`personNames`, `projectName` on `create_task` /
`update_task`, `habitName` on `start_timer` / `swap_timer`, `calendarTitle`,
`categoryName`) warn-and-skip: the preview stays `ok: true`, the link is left
out, and `warnings` explains what happened plus the suggestion, e.g.
`"morn" is close to "Morning Run" but not an exact match — not linked. Timer will start without a habit link. Pass the exact name to link it.`

**Categories** (`categoryName` on `start_timer`, `swap_timer`,
`log_time_entry`, `edit_time_entry`) resolve against your time categories: an
exact match normalizes to the stored name (`"deep work"` → `"Deep Work"`); a
close or ambiguous match is not set (warning explains); a name matching
nothing is saved as-is — categories are free text, so this creates a new one —
with a warning naming the existing categories.

**0 matches:**
```json
{
  "ok": false,
  "error": "No habit found matching 'Meditate'",
  "candidates": []
}
```

**1 close match (never auto-picked):**
```json
{
  "ok": false,
  "error": "No exact project match for \"split\" — did you mean \"Split-Flap Display\"? Retry with the exact project name, or pass projectId to pick one.",
  "candidates": [{ "id": "p1", "name": "Split-Flap Display" }]
}
```

**2+ matches:**
```json
{
  "ok": false,
  "error": "Ambiguous habit match for \"Read\" — pass the exact name: \"Read\", \"Read Bible\".",
  "candidates": [
    { "id": "h1", "name": "Read", "bucket": "reading" },
    { "id": "h2", "name": "Read Bible", "bucket": "spiritual" }
  ]
}
```

The agent should show the candidates to Josh and ask for disambiguation, then retry with the exact name or ID.

Applies to: `log_habit` (habitName), `update_project` / `delete_project` /
`update_project_plan` / `add_project_milestone` / `add_project_question` /
`add_project_blocker` / `set_project_next_action` (projectName, or projectId),
and the Rolodex actions below (personName). Every project action accepts an
explicit `projectId`, which wins over `projectName` when both are given.

**Validation errors** name every offending field and what's wrong with it:
```json
{
  "ok": false,
  "error": "Invalid input: \"status\": status must be one of: exploring, active, final_push, paused, done; \"targetDate\": targetDate must be YYYY-MM-DD"
}
```

---

## 8. Rolodex & @mention Actions

### Rolodex assistant actions (via `/api/assistant/actions`)

| Action | Risk | Description |
|--------|------|-------------|
| `create_rolodex_person` | low | Create a new Rolodex contact. Warns (does not block) if a contact with the same display name already exists, pointing at `update_rolodex_person` instead. `birthday` must be `YYYY-MM-DD`. |
| `update_rolodex_person` | medium | Update a contact's details (confirmation required). Fails with "No changes specified" when nothing is passed. |
| `add_rolodex_interaction` | low | Log an interaction with a contact. `followUpDate` must be `YYYY-MM-DD`. |
| `add_person_followup` | low | Add a follow-up reminder for a contact. `followUpDate` must be `YYYY-MM-DD`. |
| `add_gift_idea` | low | Add a gift idea for a contact. Warns if the idea is already saved for them. |

Person matching follows the same never-guess rules as projects (see §7):
exact display-name match wins; a single close match returns a "did you mean"
suggestion; zero matches point at `create_rolodex_person`; ambiguous matches
list candidates.

### Unresolved mentions in the snapshot

The snapshot (`GET /api/assistant/snapshot`) includes a `rolodex` key when the user has the Rolodex feature:

```json
{
  "rolodex": {
    "unresolvedMentionCount": 3,
    "unresolvedMentions": [
      { "id": "m1", "mentionedName": "Ana", "sourceTool": "reflection", "createdAt": "..." }
    ]
  }
}
```

### `resolve_person_mention` action

Resolves an unresolved `@mention` by linking it to an existing Rolodex person.

**Input:**
```json
{
  "action": "resolve_person_mention",
  "input": {
    "mentionId": "m1",
    "personId": "p_abc"
  }
}
```

**Ambiguity handling**: if the agent encounters an `@mention` in a note and wants to resolve it without a `mentionId`, it should search for the person by name via `find_person` (if available) or ask Josh for disambiguation before proceeding.

### Handling unresolved mentions

When the snapshot shows `unresolvedMentionCount > 0`, the agent may:
1. Show Josh the unresolved mentions list
2. For each mention, propose matching existing contacts or suggest creating new ones
3. Call `resolve_person_mention` with confirmed `mentionId` + `personId`

If a mention matches 0 or 2+ existing contacts, treat it as ambiguous — do not auto-resolve.

---

## 9. What's Explicitly NOT Supported

- **Finance writes** — `finance_write` is in the registry as `supported: false`, `risk: "high"`. Any attempt returns a 400.
- **Deletes** — `delete_project`, `delete_calendar_event`, and
  `delete_time_entry` are supported (all medium risk, confirmation required).
  No `delete_task`, etc.
- **Bulk operations** — no "complete all tasks in lane" or "delete all today's entries."
- **Task lookup by name** — `complete_task` and `update_task` require a `taskId`. There is no name-based task lookup (task names are non-unique).
- **Running timer edits by name** — `edit_time_entry` requires an `entryId`. Use the snapshot to find the running timer's ID first.
