// Inspect and repair timestamps that were saved with the wrong timezone.
//
// Background: before the wall-clock fix, manually entered times (time-entry
// editor, calendar quick-add, project/habit scheduling) were parsed in the
// SERVER's timezone. On the UTC production server, a time typed as 2:30 PM
// Pacific was stored as 2:30 PM UTC — 7 hours early. Timer-tracked entries
// (start/stop, one-tap chips, gap backfill) used real timestamps and were
// never wrong.
//
// Usage (dry run by default — prints what it WOULD do):
//   npx tsx --env-file=.env scripts/shift-times.ts --tool time --since 2026-06-09
//   npx tsx --env-file=.env scripts/shift-times.ts --tool calendar --since 2026-06-09 --hours 7
//
// Apply for real with --apply. Target specific rows with --ids id1,id2.
//   npx tsx --env-file=.env scripts/shift-times.ts --tool time --ids cmb...,cmb... --hours 7 --apply
//
// --hours is how much to ADD to the stored timestamps. Rows saved as UTC
// wall-clock that should have been Pacific need +7 (PDT) or +8 (PST).

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

type Args = {
  tool: "time" | "calendar";
  hours: number;
  since: Date | null;
  until: Date | null;
  ids: string[] | null;
  apply: boolean;
};

function parseArgs(): Args {
  const argv = process.argv.slice(2);
  const get = (flag: string) => {
    const index = argv.indexOf(flag);
    return index >= 0 ? argv[index + 1] : undefined;
  };
  const tool = get("--tool");
  if (tool !== "time" && tool !== "calendar") {
    throw new Error("Pass --tool time or --tool calendar");
  }
  const hoursRaw = get("--hours");
  const hours = hoursRaw === undefined ? 7 : Number(hoursRaw);
  if (!Number.isFinite(hours) || Math.abs(hours) > 24) {
    throw new Error("--hours must be a number between -24 and 24");
  }
  const sinceRaw = get("--since");
  const untilRaw = get("--until");
  const idsRaw = get("--ids");
  return {
    tool,
    hours,
    since: sinceRaw ? new Date(sinceRaw) : null,
    until: untilRaw ? new Date(untilRaw) : null,
    ids: idsRaw ? idsRaw.split(",").map((id) => id.trim()).filter(Boolean) : null,
    apply: argv.includes("--apply"),
  };
}

function fmt(date: Date | null) {
  if (!date) return "(running)";
  return date.toLocaleString("en-US", {
    timeZone: "America/Los_Angeles",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function shifted(date: Date | null, hours: number) {
  return date ? new Date(date.getTime() + hours * 3_600_000) : null;
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL not set");
  const args = parseArgs();

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: url }),
  });

  if (args.tool === "time") {
    const rows = await prisma.timeEntry.findMany({
      where: {
        ...(args.ids ? { id: { in: args.ids } } : {}),
        ...(args.since ? { startedAt: { gte: args.since } } : {}),
        ...(args.until ? { startedAt: { lt: args.until } } : {}),
      },
      orderBy: { startedAt: "asc" },
    });
    console.log(
      `${rows.length} time entries${args.apply ? " — APPLYING" : " — dry run (Pacific times shown)"}\n`,
    );
    for (const row of rows) {
      console.log(
        `${row.id}  ${row.label.padEnd(28).slice(0, 28)}  ${fmt(row.startedAt)} → ${fmt(row.endedAt)}` +
          (args.apply
            ? ""
            : `   would become  ${fmt(shifted(row.startedAt, args.hours))} → ${fmt(shifted(row.endedAt, args.hours))}`),
      );
      if (args.apply) {
        await prisma.timeEntry.update({
          where: { id: row.id },
          data: {
            startedAt: shifted(row.startedAt, args.hours)!,
            endedAt: shifted(row.endedAt, args.hours),
          },
        });
      }
    }
  } else {
    const rows = await prisma.calendarItem.findMany({
      where: {
        ...(args.ids ? { id: { in: args.ids } } : {}),
        ...(args.since ? { startsAt: { gte: args.since } } : {}),
        ...(args.until ? { startsAt: { lt: args.until } } : {}),
      },
      orderBy: { startsAt: "asc" },
    });
    console.log(
      `${rows.length} calendar items${args.apply ? " — APPLYING" : " — dry run (Pacific times shown)"}\n`,
    );
    for (const row of rows) {
      console.log(
        `${row.id}  ${row.title.padEnd(28).slice(0, 28)}  ${fmt(row.startsAt)} → ${fmt(row.endsAt)}` +
          (args.apply
            ? ""
            : `   would become  ${fmt(shifted(row.startsAt, args.hours))} → ${fmt(shifted(row.endsAt, args.hours))}`),
      );
      if (args.apply) {
        await prisma.calendarItem.update({
          where: { id: row.id },
          data: {
            startsAt: shifted(row.startsAt, args.hours)!,
            endsAt: shifted(row.endsAt, args.hours)!,
          },
        });
      }
    }
  }

  if (!args.apply) {
    console.log("\nDry run only. Re-run with --apply to write the shift.");
  } else {
    console.log("\nDone.");
  }
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
