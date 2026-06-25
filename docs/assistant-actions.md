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

All endpoints require a valid session cookie — the same session used by the web app. Call `auth()` is verified on every request; `401 Unauthorized` is returned if absent.

There is no separate API key. The assistant must be in an authenticated browser session or use session cookie forwarding.

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
  "error": "Ambiguous habit match for \"Read\"",
  "candidates": [
    { "id": "h1", "name": "Read", "bucket": "reading" },
    { "id": "h2", "name": "Read Bible", "bucket": "spiritual" }
  ],
  "auditId": "uuid"
}
```

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

## 4. Risk Levels and Confirmation Rules

| Risk | `confirmationRequired` | Behavior |
|------|----------------------|----------|
| `low` | `false` | Executes immediately without `confirmed` |
| `medium` | `true` | Requires `confirmed: true` in execute body |
| `high` | `true` | Always rejected — cannot execute via API |

Current risk assignments:
- `low`: `create_task`, `log_habit`, `add_reflection`
- `medium`: `complete_task`, `update_task`, `create_calendar_block`, `start_timer`, `stop_timer`, `edit_time_entry`, `update_project`
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

When a name lookup matches 0 or 2+ records, the preview returns `ok: false` with a `candidates` array.

**0 matches:**
```json
{
  "ok": false,
  "error": "No habit found matching 'Meditate'",
  "candidates": []
}
```

**2+ matches:**
```json
{
  "ok": false,
  "error": "Ambiguous habit match for \"Read\"",
  "candidates": [
    { "id": "h1", "name": "Read", "bucket": "reading" },
    { "id": "h2", "name": "Read Bible", "bucket": "spiritual" }
  ]
}
```

The agent should show the candidates to Josh and ask for disambiguation, then retry with the exact name or ID.

Applies to: `log_habit` (habitName), `update_project` (projectName).

---

## 8. Rolodex & @mention Actions

### Rolodex assistant actions (via `/api/assistant/actions`)

| Action | Risk | Description |
|--------|------|-------------|
| `create_person` | low | Create a new Rolodex contact |
| `add_interaction` | low | Add an interaction note to an existing contact |
| `resolve_person_mention` | low | Link an unresolved @mention to a contact |

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
- **Deletes** — no `delete_task`, `delete_time_entry`, etc.
- **Bulk operations** — no "complete all tasks in lane" or "delete all today's entries."
- **Task lookup by name** — `complete_task` and `update_task` require a `taskId`. There is no name-based task lookup (task names are non-unique).
- **Running timer edits by name** — `edit_time_entry` requires an `entryId`. Use the snapshot to find the running timer's ID first.
