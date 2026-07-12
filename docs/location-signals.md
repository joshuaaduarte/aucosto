# Location signals

aucosto doesn't track your location. It receives **arrive/leave signals at
named places** from iOS Shortcuts geofence automations — the useful primitive
is "arrived at the gym", not a coordinate trail. Signals power the hub's
"📍 At Gym since 6:12pm" line and land in the event log.

## How it works

- `POST /api/location/ingest`, authenticated with a bearer token
  (`LOCATION_WEBHOOK_SECRET` in `.env` — also set it in Vercel).
- Body: `{ "place": "Gym", "kind": "arrive" | "leave" }`, optional
  `latitude`, `longitude`, `occurredAt` (ISO 8601).
- Events are stored in `LocationEvent` (per-user), surfaced via
  `getCurrentPlace()` — the latest fresh `arrive` wins; a `leave` or an
  arrival older than 18h means "no known place".
- Raw coordinates are deliberately **excluded from the assistant snapshot**.

## iOS Shortcuts setup (one automation per place per direction)

1. Shortcuts app → **Automation** → **+** → **When I arrive** (or "When I
   leave") → choose the location → **Run Immediately**.
2. Action: **Get Contents of URL**
   - URL: `https://<your-vercel-domain>/api/location/ingest`
   - Method: `POST`
   - Headers: `Authorization` = `Bearer <LOCATION_WEBHOOK_SECRET>`,
     `Content-Type` = `application/json`
   - Request Body (JSON): `{"place": "Gym", "kind": "arrive"}`
3. Repeat for `leave`, and for each place you care about (Home, Office, Gym…).

Test from a terminal:

```bash
curl -X POST https://<host>/api/location/ingest \
  -H "Authorization: Bearer $LOCATION_WEBHOOK_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"place":"Gym","kind":"arrive"}'
```

## Ideas wired for later

- Suggest starting an Exercise timer when a `location.arrived` event for the
  gym lands (hub prompt engine already reads the event log).
- Tag time entries with the place they happened at.
