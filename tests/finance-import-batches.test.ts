import { describe, expect, it } from "vitest";
import {
  cardRowsLookFlipped,
  groupImportBatches,
  prepareRowsForAccount,
} from "@/lib/finance-import-batches";
import { classifyTransaction } from "@/lib/finance-types";

const at = (s: string) => new Date(s);

function row(createdAt: string, date: string, amount: number, description = "Store", account: string | null = null) {
  return { createdAt: at(createdAt), date: at(`${date}T12:00:00`), amount, description, account };
}

describe("groupImportBatches", () => {
  const rows = [
    row("2026-11-03T10:00:00.000Z", "2025-01-05", -1200, "Groceries", "Chase"),
    row("2026-11-03T10:00:00.000Z", "2025-03-20", 500000, "Payroll", "Chase"),
    row("2026-11-03T10:00:00.400Z", "2025-02-11", 25000, "Payment Thank You", "Chase"),
    row("2026-11-03T10:05:00.000Z", "2024-12-01", -800, "Coffee", "Amex"),
  ];

  it("splits rows into imports by when they were written, newest first", () => {
    const batches = groupImportBatches(rows);
    expect(batches).toHaveLength(2);
    expect(batches[0]).toMatchObject({ count: 1, accounts: ["Amex"], spentCents: 800, incomeCents: 0 });
    expect(batches[1]).toMatchObject({
      count: 3,
      accounts: ["Chase"],
      from: at("2026-11-03T10:00:00.000Z"),
      to: at("2026-11-03T10:00:00.400Z"),
      spentCents: 1200,
      // The card payment is not income.
      incomeCents: 500000,
    });
    expect(batches[1]!.firstDate).toEqual(at("2025-01-05T12:00:00"));
    expect(batches[1]!.lastDate).toEqual(at("2025-03-20T12:00:00"));
  });

  it("returns nothing for no rows", () => {
    expect(groupImportBatches([])).toEqual([]);
  });
});

describe("card files with flipped signs", () => {
  const amex = [
    { amount: 4500, account: null, description: "Whole Foods" },
    { amount: 1299, account: null, description: "Netflix" },
    { amount: 6000, account: null, description: "Shell" },
    { amount: -50000, account: null, description: "Autopay Payment" },
  ];

  it("spots a mostly-positive card file", () => {
    expect(cardRowsLookFlipped(amex)).toBe(true);
    expect(cardRowsLookFlipped(amex.map((r) => ({ amount: -r.amount })))).toBe(false);
    expect(cardRowsLookFlipped([{ amount: 5 }])).toBe(false);
  });

  it("turns the signs around and names the account, for cards only", () => {
    const card = prepareRowsForAccount(amex, { name: "Amex Gold", kind: "credit_card" });
    expect(card.flipped).toBe(true);
    expect(card.rows.map((r) => r.amount)).toEqual([-4500, -1299, -6000, 50000]);
    expect(card.rows[0]!.account).toBe("Amex Gold");
    const checking = prepareRowsForAccount(amex, { name: "Checking", kind: "checking" });
    expect(checking.flipped).toBe(false);
    expect(checking.rows[0]!.amount).toBe(4500);
    expect(prepareRowsForAccount(amex, null).rows).toBe(amex);
  });

  it("keeps an account column the file already had", () => {
    const { rows } = prepareRowsForAccount([{ amount: -1, account: "Card 1234" }], { name: "Chase", kind: "checking" });
    expect(rows[0]!.account).toBe("Card 1234");
  });

  it("counts a card's payment line as a card payment, not income", () => {
    expect(classifyTransaction({ amount: 50000, description: "AUTOPAY PAYMENT - THANK YOU" })).toBe("credit_card_payment");
    expect(classifyTransaction({ amount: 50000, description: "Payment Thank You-Mobile" })).toBe("credit_card_payment");
    expect(classifyTransaction({ amount: 500000, description: "Payroll" })).toBe("income");
  });
});
