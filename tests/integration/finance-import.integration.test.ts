// Integration coverage for the one mutation path where a regression costs
// real data: finance import dedup. Exercises the actual service against the
// dev DB with a throwaway user (cascade-deleted afterwards).
//
// Run with: npm run test:integration
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { countTransactions, importTransactions } from "@/lib/services/finance";
import type { ParsedRow } from "@/lib/csv";

const TEST_EMAIL = `integration-finance-import-${Date.now()}@test.local`;

function row(date: string, amount: number, description: string): ParsedRow {
  return {
    date: new Date(date),
    amount,
    description,
    account: "Checking",
    raw: `${date},${description},${amount}`,
  };
}

// Three unique rows + one exact in-batch duplicate of the first.
const grocery = row("2026-01-05", -4532, "Grocery store");
const batch: ParsedRow[] = [
  grocery,
  row("2026-01-06", 150000, "Paycheck"),
  row("2026-01-07", -450, "Coffee"),
  row("2026-01-05", -4532, "Grocery store"),
];

let userId: string;

beforeAll(async () => {
  if (!process.env.DATABASE_URL) {
    throw new Error(
      "DATABASE_URL not set — integration tests need .env with the dev DB.",
    );
  }
  const user = await prisma.user.create({
    data: { email: TEST_EMAIL, name: "Integration Test" },
  });
  userId = user.id;
});

afterAll(async () => {
  if (userId) {
    // All tool tables cascade on user delete (events, transactions, etc.).
    await prisma.user.delete({ where: { id: userId } });
  }
});

describe("finance import dedup (DB-backed)", () => {
  it("imports unique rows and drops the in-batch duplicate", async () => {
    const result = await importTransactions(userId, batch);
    expect(result.imported).toBe(3);
    expect(result.deduped).toBe(1);
    expect(await countTransactions(userId)).toBe(3);
  });

  it("re-importing the same batch inserts nothing", async () => {
    const result = await importTransactions(userId, batch);
    expect(result.imported).toBe(0);
    expect(result.deduped).toBe(4);
    expect(await countTransactions(userId)).toBe(3);
  });

  it("a batch overlapping existing rows only inserts the new row", async () => {
    const overlapping = [grocery, row("2026-01-08", -1299, "Streaming")];
    const result = await importTransactions(userId, overlapping);
    expect(result.imported).toBe(1);
    expect(result.deduped).toBe(1);
    expect(await countTransactions(userId)).toBe(4);
  });

  it("records finance.imported events for inserting imports only", async () => {
    const events = await prisma.event.findMany({
      where: { userId, type: "finance.imported" },
    });
    // Imports 1 and 3 inserted rows; import 2 was a no-op.
    expect(events.length).toBe(2);
  });
});
