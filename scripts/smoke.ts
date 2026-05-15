// Lightweight end-to-end exercise of the data layer + CSV parser.
// Default mode is non-destructive. Pass `--write-demo` to explicitly replace
// the seeded user's finance/time data with demo fixtures.

import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { parseTransactionsCsv } from "../src/lib/csv";

const sampleCsv = `Date,Description,Amount,Account
2026-05-01,Grocery store,-45.32,Checking
2026-05-02,Paycheck,1500.00,Checking
2026-05-03,Coffee,-4.50,Checking
05/05/2026,Streaming subscription,-12.99,Credit
,malformed row,,
`;

async function main() {
  const writeDemo = process.argv.includes("--write-demo");
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL not set");
  const email = process.env.SEED_USER_EMAIL;
  if (!email) throw new Error("SEED_USER_EMAIL not set");

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: url }),
  });

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw new Error(`Seed user ${email} not found`);
  console.log(`Seed user lookup: OK (${user.email})`);

  const parsed = parseTransactionsCsv(sampleCsv);
  console.log(
    `CSV parser: parsed ${parsed.rows.length}/${parsed.total}, skipped ${parsed.skipped}`,
  );
  if (parsed.rows.length !== 4) {
    throw new Error(`Expected 4 parsed rows, got ${parsed.rows.length}`);
  }
  if (parsed.skipped !== 1) {
    throw new Error(`Expected 1 skipped, got ${parsed.skipped}`);
  }

  const existingFinanceCount = await prisma.financeTransaction.count({
    where: { userId: user.id },
  });
  const existingTimeCount = await prisma.timeEntry.count({
    where: { userId: user.id },
  });
  console.log(`Existing finance rows: ${existingFinanceCount}`);
  console.log(`Existing time rows: ${existingTimeCount}`);

  if (!writeDemo) {
    console.log(
      "Non-destructive smoke only. Pass --write-demo to replace data with demo fixtures.",
    );
    await prisma.$disconnect();
    console.log("OK");
    return;
  }

  console.log(
    "write-demo mode enabled: replacing seeded user finance/time data with demo fixtures",
  );

  await prisma.financeTransaction.deleteMany({ where: { userId: user.id } });
  await prisma.financeTransaction.createMany({
    data: parsed.rows.map((r) => ({
      userId: user.id,
      date: r.date,
      amount: r.amount,
      description: r.description,
      account: r.account,
      raw: r.raw,
    })),
  });
  const txCount = await prisma.financeTransaction.count({
    where: { userId: user.id },
  });
  console.log(`FinanceTransaction table: ${txCount} rows`);

  await prisma.timeEntry.deleteMany({ where: { userId: user.id } });
  const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);
  await prisma.timeEntry.create({
    data: {
      userId: user.id,
      label: "smoke test session",
      category: "test",
      startedAt: fiveMinAgo,
      endedAt: null,
    },
  });
  const twoHrsAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
  const oneHrAgo = new Date(Date.now() - 1 * 60 * 60 * 1000);
  await prisma.timeEntry.create({
    data: {
      userId: user.id,
      label: "morning deep work",
      startedAt: twoHrsAgo,
      endedAt: oneHrAgo,
    },
  });
  const teCount = await prisma.timeEntry.count({
    where: { userId: user.id },
  });
  console.log(`TimeEntry table: ${teCount} rows`);

  await prisma.$disconnect();
  console.log("OK");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
