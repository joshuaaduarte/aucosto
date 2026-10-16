# Agent API — deploy guide

The assistant surface (`/api/assistant/*`) now accepts external agents via a
bearer token, adds read-gap list endpoints, and exposes a minimal MCP server.
This doc covers deploying and using it. For the action protocol itself, see
`docs/assistant-actions.md`.

## What was added

1. **Bearer-token auth** (`src/lib/assistant-auth.ts`) — every
   `/api/assistant/*` route now accepts *either* the existing session cookie
   *or* `Authorization: Bearer $ASSISTANT_API_SECRET`, resolving to the owner
   user. Session behavior is unchanged.
2. **List endpoints** (same auth):
   - `GET /api/assistant/tasks?includeDone=false&limit=100` — tasks with IDs
     (needed for `complete_task`/`update_task`, which require `taskId`).
   - `GET /api/assistant/habits?includeArchived=false`
   - `GET /api/assistant/projects`
   - `GET /api/assistant/calendar?from=<ISO>&to=<ISO>` — defaults to the next
     7 days; max 90-day range.
   - `GET /api/assistant/people-time?from=<ISO>&to=<ISO>` — per-person time
     totals; defaults to the last 7 days; max 90-day range.
   - `GET /api/assistant/planned-vs-actual?date=<YYYY-MM-DD>` — planned vs
     actual time for one calendar day; defaults to today.
   - `GET /api/assistant/reflections?from=<YYYY-MM-DD>&to=<YYYY-MM-DD>` —
     daily mood/reflection series (one row per day with a reflection);
     defaults to the last 30 days; max 90-day range.
3. **MCP server** at `POST /api/assistant/mcp` (same auth) — stateless
   Streamable HTTP (JSON-RPC 2.0, no SSE). Twelve tools: `assistant_snapshot`,
   `assistant_capabilities`, `assistant_preview_action`,
   `assistant_execute_action`, `assistant_list_tasks`,
   `assistant_list_habits`, `assistant_list_projects`,
   `assistant_list_calendar`, `assistant_list_people_time`,
   `assistant_list_planned_vs_actual`, `assistant_list_reflections`,
   `assistant_action_history`. Tool input
   contracts reuse the executor's zod schemas; preview/execute go through the
   same risk gating and audit trail as the REST routes.

## Deploy checklist (Vercel)

1. Generate the secret and add it to the **production** environment:
   ```bash
   openssl rand -hex 32
   ```
   In the Vercel dashboard → project → Settings → Environment Variables, add
   `ASSISTANT_API_SECRET` with that value (Production; add to Preview too if
   you want to test against preview deploys).
2. Redeploy (env changes need a new deployment to take effect).
3. Verify (no session cookie needed):
   ```bash
   curl https://<your-host>/api/assistant/capabilities \
     -H "Authorization: Bearer $ASSISTANT_API_SECRET" | head -c 300
   ```
   A wrong or missing token returns `401 {"error":"Unauthorized"}`.
   If the secret is unset, bearer auth is simply unavailable — session-cookie
   access keeps working exactly as before.

## Using it from an agent

Store the secret in the agent's secure credential store (never in chat, logs,
or committed files), then:

```bash
# Context read
curl https://<host>/api/assistant/snapshot \
  -H "Authorization: Bearer $ASSISTANT_API_SECRET"

# Lists
curl "https://<host>/api/assistant/tasks?limit=50" \
  -H "Authorization: Bearer $ASSISTANT_API_SECRET"
curl "https://<host>/api/assistant/calendar?from=2026-10-14T00:00:00-07:00&to=2026-10-21T00:00:00-07:00" \
  -H "Authorization: Bearer $ASSISTANT_API_SECRET"

# Two-step write: preview, then execute
curl -X POST https://<host>/api/assistant/actions/preview \
  -H "Authorization: Bearer $ASSISTANT_API_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"action":"create_task","input":{"title":"Review agent API","bucket":"today"}}'

curl -X POST https://<host>/api/assistant/actions/execute \
  -H "Authorization: Bearer $ASSISTANT_API_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"action":"complete_task","input":{"taskId":"<id-from-list>"},"confirmed":true}'

# MCP (JSON-RPC 2.0)
curl -X POST https://<host>/api/assistant/mcp \
  -H "Authorization: Bearer $ASSISTANT_API_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

An MCP client config (e.g. Claude Code / Claude Desktop `mcpServers`) points
at the URL with the bearer header:

```json
{
  "mcpServers": {
    "aucosto": {
      "url": "https://<host>/api/assistant/mcp",
      "headers": { "Authorization": "Bearer <ASSISTANT_API_SECRET>" }
    }
  }
}
```
(Exact config shape varies by client — check its docs for remote MCP servers
with custom headers.)

## Security notes — read before exposing

- **The bearer key is owner-equivalent.** It resolves directly to the owner
  userId and, like a logged-in session, bypasses viewer context: demo mode,
  the app privacy lock, and the finance visibility gate are **not** enforced
  on assistant routes. Do not share the secret; rotate it if it leaks
  (change the Vercel env var and redeploy).
- **Risk gating is unchanged.** Low-risk actions execute immediately,
  medium-risk need `confirmed: true`, high-risk (finance writes) are rejected.
  Deletes and bulk ops remain deliberately unsupported — that decision stands.
- **Audit everything.** Preview and execute calls (REST and MCP) write to
  `assistant_action_audits`; review via `GET /api/assistant/actions/history`.
- **No rate limiting yet.** The routes have none today. For a single trusted
  agent this is acceptable; add it before widening access. Recommended
  follow-up, not built here.
- **Transport.** Always use HTTPS (Vercel provides it). Never put the secret
  in a URL query param — header only.

## Rotating the secret

1. Generate a new value, update the Vercel env var, redeploy.
2. Update the agent's stored credential.
3. Old value stops working on deploy — there is no grace period by design.
