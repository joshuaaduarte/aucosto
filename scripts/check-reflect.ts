// Health check for the daily-reflection feature. Verifies the
// DailyReflection table exists with the expected columns and that the
// reflect service's raw-SQL read shapes run cleanly.
//
//   npx tsx --env-file=.env scripts/check-reflect.ts

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, Prisma } from "../src/generated/prisma/client";

const EXPECTED_COLUMNS: Record<string, string> = {
  id: "text",
  userId: "text",
  date: "date",
  mood: "integer",
  energyLevel: "integer",
  productivityRating: "integer",
  dayRating: "integer",
  wentWell: "text",
  carryForward: "text",
  freeNotes: "text",
  contextSnapshot: "jsonb",
  createdAt: "timestamp without time zone",
  updatedAt: "timestamp without time zone",
};

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL not set");
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: url }),
  });

  let failed = false;
  const fail = (message: string) => {
    failed = true;
    console.log(`✗ ${message}`);
  };
  const ok = (message: string) => console.log(`✓ ${message}`);

  // 1. Table + columns
  const columns = await prisma.$queryRaw<
    Array<{ column_name: string; data_type: string }>
  >(Prisma.sql`
    SELECT column_name, data_type
    FROM information_schema.columns
    WHERE table_name = 'DailyReflection'
  `);
  if (columns.length === 0) {
    fail(
      "DailyReflection table is MISSING — run `npm run db:migrate` and watch for errors.",
    );
  } else {
    const byName = new Map(columns.map((c) => [c.column_name, c.data_type]));
    const problems: string[] = [];
    for (const [name, type] of Object.entries(EXPECTED_COLUMNS)) {
      const actual = byName.get(name);
      if (!actual) problems.push(`missing column ${name}`);
      else if (actual !== type) problems.push(`${name} is ${actual}, expected ${type}`);
    }
    if (problems.length > 0) fail(`Column mismatch: ${problems.join("; ")}`);
    else ok(`Table exists with all ${columns.length} expected columns.`);
  }

  // 2. Unique index for the per-day upsert
  const indexes = await prisma.$queryRaw<Array<{ indexname: string }>>(
    Prisma.sql`SELECT indexname FROM pg_indexes WHERE tablename = 'DailyReflection'`,
  );
  if (indexes.some((i) => i.indexname === "DailyReflection_userId_date_key")) {
    ok("Unique (userId, date) index present — upserts will work.");
  } else if (columns.length > 0) {
    fail("Unique (userId, date) index missing — ON CONFLICT upserts will fail.");
  }

  // 3. Service-shaped reads (same SQL as src/lib/services/reflect.ts)
  if (columns.length > 0) {
    const rows = await prisma.$queryRaw<Array<{ dateKey: string; mood: number }>>(
      Prisma.sql`
        SELECT to_char("date", 'YYYY-MM-DD') AS "dateKey", "mood"
        FROM "DailyReflection"
        ORDER BY "date" DESC
        LIMIT 5
      `,
    );
    ok(`List read works (${rows.length} reflection${rows.length === 1 ? "" : "s"} found).`);

    const recent = await prisma.$queryRaw<Array<{ dateKey: string }>>(
      Prisma.sql`
        SELECT to_char("date", 'YYYY-MM-DD') AS "dateKey"
        FROM "DailyReflection"
        WHERE "date" >= (now()::date - 6)
      `,
    );
    ok(`Recent-moods read works (${recent.length} in the last 7 days).`);
  }

  // 4. TimeEntry.notes (entry notes feed the reflection snapshot)
  const notes = await prisma.$queryRaw<Array<{ n: number }>>(Prisma.sql`
    SELECT count(*)::int AS n FROM information_schema.columns
    WHERE table_name = 'TimeEntry' AND column_name = 'notes'
  `);
  if (notes[0]?.n === 1) ok("TimeEntry.notes column present.");
  else fail("TimeEntry.notes column missing.");

  await prisma.$disconnect();
  console.log(failed ? "\nSome checks FAILED." : "\nAll reflection checks passed.");
  process.exit(failed ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
