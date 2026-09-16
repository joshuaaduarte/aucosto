// Re-derive the push nudge cron times from the owner's own activity.
//
// Run:  npx tsx --env-file=.env scripts/derive-nudge-times.ts
//
// Prints the LA hours preferredNudgeHours() picks plus the UTC cron lines to
// paste into vercel.json. Read-only. Re-run every few months, or whenever the
// nudges start feeling mistimed — the point is that these numbers come from
// data, not from a guess.
//
// NOTE on timezones: the timestamp columns are `timestamp without time zone`
// holding UTC, so converting to local needs BOTH casts —
// `(at at time zone 'UTC') at time zone 'America/Los_Angeles'`. A single
// `at time zone 'America/Los_Angeles'` silently shifts the wrong way.

import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { localHourToUtcHour, preferredNudgeHours, type ActivityHour } from "../src/lib/nudge-timing";

const ZONE = process.env.APP_TIMEZONE ?? "America/Los_Angeles";
const LOCAL = `at time zone 'UTC' at time zone '${ZONE}'`;

// Bulk backfills would drown out real usage; count distinct active day-hours
// rather than raw event rows for the same reason.
const EXCLUDED_TYPES = ["time.category_updated"];

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL not set");
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });

  const rows = await prisma.$queryRawUnsafe<Array<{ hour: number; activeDays: number }>>(
    `select extract(hour from (at ${LOCAL}))::int as "hour",
            count(distinct ((at ${LOCAL})::date, extract(hour from (at ${LOCAL}))))::int as "activeDays"
     from "Event"
     where type <> any($1::text[])
     group by 1 order by 1`,
    EXCLUDED_TYPES,
  );

  const hours: ActivityHour[] = rows.map((row) => ({
    hour: Number(row.hour),
    activeDays: Number(row.activeDays),
  }));

  const peak = Math.max(1, ...hours.map((h) => h.activeDays));
  console.log(`Activity by hour (${ZONE}), bulk backfill excluded:\n`);
  for (const row of hours) {
    const bar = "█".repeat(Math.round((row.activeDays / peak) * 30));
    console.log(`  ${String(row.hour).padStart(2, "0")}:00  ${String(row.activeDays).padStart(3)} days  ${bar}`);
  }

  const { morningHour, eveningHour } = preferredNudgeHours(hours);

  // Cron runs in UTC year-round; compute the offset for "now" so the printed
  // lines match the current DST state (re-check after a DST flip).
  const offsetHours = -new Date().getTimezoneOffset() / 60;

  console.log(`\nPreferred local hours: morning ${morningHour}:00, evening ${eveningHour}:00`);
  console.log(`Current offset from UTC: ${offsetHours}\n`);
  console.log("vercel.json crons:");
  console.log(`  { "path": "/api/cron/nudges", "schedule": "0 ${localHourToUtcHour(morningHour, offsetHours)} * * *" }`);
  console.log(`  { "path": "/api/cron/nudges", "schedule": "0 ${localHourToUtcHour(eveningHour, offsetHours)} * * *" }`);

  await prisma.$disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
