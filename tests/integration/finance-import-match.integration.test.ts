// Imports confirm hand-logged entries instead of copying them, and undoing
// the import puts those entries back. DB-backed; throwaway user.
//
// Run with: npm run test:integration
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { deleteImportBatch, importTransactions, listImportBatches } from "@/lib/services/finance";
import { encodeEntryMeta, ENTRY_CLEARED, ENTRY_PENDING, readEntryMeta } from "@/lib/finance-entries";
import type { ParsedRow } from "@/lib/csv";

const TEST_EMAIL = `integration-finance-match-${Date.now()}@test.local`;
let userId: string;
let accountId: string;
let tjId: string;
let sushiId: string;

function row(date: string, amount: number, description: string): ParsedRow {
  return { date: new Date(`${date}T12:00:00`), amount, description, account: null, raw: `${date},${description},${amount}` };
}

const file = [
  row("2026-11-04", -4512, "TRADER JOE'S #552 SAN DIEGO CA"),
  row("2026-11-05", -4800, "SUSHI OTA LA JOLLA"),
  row("2026-11-05", -1250, "SHELL OIL 1234"),
];

beforeAll(async () => {
  const user = await prisma.user.create({ data: { email: TEST_EMAIL, name: "Integration Test" } });
  userId = user.id;
  const account = await prisma.financeAccount.create({
    data: { userId, name: "Sapphire", kind: "credit_card", currentBalanceCents: 0, balanceUpdatedAt: new Date() },
  });
  accountId = account.id;
  const base = { userId, syncSource: "manual", postedStatus: ENTRY_PENDING };
  tjId = (
    await prisma.financeTransaction.create({
      data: { ...base, date: new Date("2026-11-02T12:00:00"), amount: -4512, description: "Trader Joe's", category: "Groceries", raw: encodeEntryMeta({ by: userId, via: "quick_add" }) },
    })
  ).id;
  sushiId = (
    await prisma.financeTransaction.create({
      data: { ...base, financeAccountId: accountId, date: new Date("2026-11-04T12:00:00"), amount: -4000, description: "Sushi Ota", category: "Eating out", raw: encodeEntryMeta({ by: userId, via: "quick_add" }) },
    })
  ).id;
});

afterAll(async () => {
  if (userId) await prisma.user.delete({ where: { id: userId } });
});

describe("import matches hand-logged entries (DB-backed)", () => {
  it("confirms the two logged entries and adds only the new row", async () => {
    const result = await importTransactions(userId, file, { financeAccountId: accountId });
    expect(result).toMatchObject({ imported: 1, matched: 2, adjusted: 1 });
    const tj = await prisma.financeTransaction.findUniqueOrThrow({ where: { id: tjId } });
    expect(tj).toMatchObject({ postedStatus: ENTRY_CLEARED, financeAccountId: accountId, description: "Trader Joe's", category: "Groceries" });
    expect(readEntryMeta(tj.raw).via).toBe("quick_add");
    const sushi = await prisma.financeTransaction.findUniqueOrThrow({ where: { id: sushiId } });
    expect(sushi.amount).toBe(-4800);
    expect(await prisma.financeTransaction.count({ where: { userId } })).toBe(3);
  });

  it("re-importing the same file adds nothing", async () => {
    const result = await importTransactions(userId, file, { financeAccountId: accountId });
    expect(result).toMatchObject({ imported: 0, matched: 0, deduped: 3 });
    expect(await prisma.financeTransaction.count({ where: { userId } })).toBe(3);
  });

  it("lists the import with its matches, and undo puts the entries back", async () => {
    const [batch] = await listImportBatches(userId);
    expect(batch).toMatchObject({ count: 1, confirmed: 2 });
    const removed = await deleteImportBatch(userId, { from: batch!.from, to: batch!.to });
    expect(removed).toBe(3);
    const sushi = await prisma.financeTransaction.findUniqueOrThrow({ where: { id: sushiId } });
    expect(sushi).toMatchObject({ amount: -4000, postedStatus: ENTRY_PENDING });
    const tj = await prisma.financeTransaction.findUniqueOrThrow({ where: { id: tjId } });
    expect(tj).toMatchObject({ postedStatus: ENTRY_PENDING, financeAccountId: null });
    expect(await prisma.financeTransaction.count({ where: { userId } })).toBe(2);
    expect(await listImportBatches(userId)).toEqual([]);
  });
});
