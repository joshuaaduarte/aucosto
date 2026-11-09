// Shops are remembered: a bank file that confirms a logged entry teaches
// its name and category, later imports and entries pick them up, and each
// person's rule wins for them. DB-backed; throwaway user.
//
// Run with: npm run test:integration
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { addEntry, importTransactions, listShopRules, saveShopRule } from "@/lib/services/finance";
import { encodeEntryMeta, ENTRY_PENDING } from "@/lib/finance-entries";
import type { ParsedRow } from "@/lib/csv";

const TEST_EMAIL = `integration-finance-rules-${Date.now()}@test.local`;
let userId: string;

function row(date: string, amount: number, description: string): ParsedRow {
  return { date: new Date(`${date}T12:00:00`), amount, description, account: null, raw: `${date},${description},${amount}` };
}

beforeAll(async () => {
  userId = (await prisma.user.create({ data: { email: TEST_EMAIL, name: "Integration Test" } })).id;
  await prisma.financeTransaction.create({
    data: {
      userId,
      syncSource: "manual",
      postedStatus: ENTRY_PENDING,
      date: new Date("2026-11-02T12:00:00"),
      amount: -4512,
      description: "Trader Joe's",
      category: "Groceries",
      raw: encodeEntryMeta({ by: "ana", via: "quick_add" }),
    },
  });
});

afterAll(async () => {
  if (userId) await prisma.user.delete({ where: { id: userId } });
});

describe("remembered shops (DB-backed)", () => {
  it("a confirmed import teaches the shop for whoever logged it", async () => {
    await importTransactions(userId, [row("2026-11-03", -4512, "TRADER JOE'S #552 SAN DIEGO CA")]);
    const rules = await listShopRules(userId);
    expect(rules).toHaveLength(1);
    expect(rules[0]).toMatchObject({ ownerUserId: "ana", match: "trader joes", name: "Trader Joe's", category: "Groceries" });
  });

  it("a later unlogged trip in a bank file arrives named and sorted", async () => {
    const result = await importTransactions(userId, [row("2026-11-20", -2210, "TRADER JOE'S #120 LA JOLLA CA")]);
    expect(result.imported).toBe(1);
    const tx = await prisma.financeTransaction.findFirstOrThrow({ where: { userId, amount: -2210 } });
    expect(tx).toMatchObject({ description: "Trader Joe's", category: "Groceries" });
    expect(tx.raw).toContain("LA JOLLA");
    // Re-importing the renamed row still adds nothing.
    const again = await importTransactions(userId, [row("2026-11-20", -2210, "TRADER JOE'S #120 LA JOLLA CA")]);
    expect(again).toMatchObject({ imported: 0, matched: 0 });
  });

  it("an entry left for sorting gets the remembered category, own rule first", async () => {
    await saveShopRule(userId, { description: "Target", category: "Shopping", ownerUserId: "josh" });
    await saveShopRule(userId, { description: "TARGET 0001", category: "Baby", ownerUserId: "ana" });
    const ana = await addEntry(userId, { amountCents: 3000, direction: "out", description: "Target", date: new Date(), byUserId: "ana" });
    const josh = await addEntry(userId, { amountCents: 3000, direction: "out", description: "target", date: new Date(), byUserId: "josh" });
    const picked = await addEntry(userId, { amountCents: 3000, direction: "out", description: "Target", category: "Home", date: new Date(), byUserId: "ana" });
    expect([ana.category, josh.category, picked.category]).toEqual(["Baby", "Shopping", "Home"]);
  });
});
