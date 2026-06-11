// Pin the server runtime to the app's display timezone.
//
// Timestamps are stored in UTC and that doesn't change. But Server
// Components format dates with toLocale*() and compute "today"/week
// boundaries in *server-local* time — on Vercel that's UTC, which shifts
// every rendered time and can put entries on the wrong day. Node re-reads
// process.env.TZ on assignment (POSIX), so setting it here at boot makes
// all server-side Date math run in the owner's timezone, matching what
// the browser shows client-side.
//
// Single-user app, single timezone. Override with APP_TIMEZONE (or TZ)
// in the environment if it ever needs to change.

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs" && !process.env.TZ) {
    process.env.TZ = process.env.APP_TIMEZONE ?? "America/Los_Angeles";
  }
}
