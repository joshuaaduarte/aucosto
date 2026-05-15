import { describe, expect, it } from "vitest";
import { inferCategory } from "@/lib/finance-categories";
import { classifyTransaction } from "@/lib/finance-types";
import {
  findRecurringCandidates,
  summarizeCashflow,
  summarizeTransactionTypes,
  topCategoriesBySpend,
  topMerchantsBySpend,
} from "@/lib/finance-summary";

function tx({
  amount,
  description,
  date,
  account,
}: {
  amount: number;
  description: string;
  date: string;
  account?: string | null;
}) {
  return {
    amount,
    description,
    date: new Date(date),
    account: account ?? null,
  };
}

describe("finance-summary", () => {
  it("summarizes spent, income, and net", () => {
    const result = summarizeCashflow([
      tx({ amount: -5000, description: "Groceries", date: "2026-05-01" }),
      tx({ amount: -10000, description: "Discover E-Payment", date: "2026-05-01" }),
      tx({ amount: 150000, description: "Paycheck", date: "2026-05-02" }),
      tx({ amount: -1200, description: "Coffee", date: "2026-05-03" }),
      tx({ amount: 2500, description: "Zelle Payment From Alex", date: "2026-05-03" }),
    ]);

    expect(result).toEqual({
      spentCents: 6200,
      incomeCents: 152500,
      netCents: 146300,
    });
  });

  it("groups top merchants case-insensitively for debits only", () => {
    const result = topMerchantsBySpend([
      tx({ amount: -5000, description: "Spotify", date: "2026-05-01" }),
      tx({ amount: -7000, description: " spotify ", date: "2026-05-08" }),
      tx({ amount: -4000, description: "Citi Card Online Payment", date: "2026-05-08" }),
      tx({ amount: 1000, description: "Refund", date: "2026-05-09" }),
      tx({ amount: -2000, description: "Coffee", date: "2026-05-10" }),
    ]);

    expect(result).toEqual([
      { merchant: "Spotify", spendCents: 12000, count: 2 },
      { merchant: "Coffee", spendCents: 2000, count: 1 },
    ]);
  });

  it("infers practical categories from transaction descriptions", () => {
    expect(inferCategory("Trader Joe's", -4500)).toBe("Groceries");
    expect(inferCategory("Spotify", -999)).toBe("Subscriptions");
    expect(inferCategory("Payroll Deposit", 250000)).toBe("Income");
    expect(inferCategory("Unknown Thing", -1234)).toBe("Other");
  });

  it("groups top categories by spend", () => {
    const result = topCategoriesBySpend([
      tx({ amount: -5000, description: "Trader Joe's", date: "2026-05-01" }),
      tx({ amount: -7000, description: "Safeway", date: "2026-05-08" }),
      tx({ amount: -300000, description: "Essex Portfolio Rental", date: "2026-05-08" }),
      tx({ amount: -999, description: "Spotify", date: "2026-05-09" }),
      tx({ amount: -2000, description: "Coffee", date: "2026-05-10" }),
    ]);

    expect(result).toEqual([
      { category: "Housing", spendCents: 300000, count: 1 },
      { category: "Groceries", spendCents: 12000, count: 2 },
      { category: "Food & Drink", spendCents: 2000, count: 1 },
      { category: "Subscriptions", spendCents: 999, count: 1 },
    ]);
  });

  it("finds likely recurring charges across time", () => {
    const result = findRecurringCandidates([
      tx({ amount: -999, description: "Netflix", date: "2026-04-01", account: "Card" }),
      tx({ amount: -999, description: " netflix ", date: "2026-05-01", account: "card" }),
      tx({ amount: -999, description: "Netflix", date: "2026-05-15", account: "Card" }),
      tx({ amount: -1500, description: "Gym", date: "2026-05-01", account: "Card" }),
      tx({ amount: -1500, description: "Gym", date: "2026-05-10", account: "Card" }),
    ]);

    expect(result).toEqual([
      {
        merchant: "Netflix",
        amountCents: 999,
        count: 3,
        account: "Card",
        lastDate: new Date("2026-05-15"),
      },
    ]);
  });

  it("classifies bank and card activity into meaningful types", () => {
    expect(classifyTransaction(tx({ amount: -212461, description: "Payment To Chase Card Ending IN 1941", date: "2026-03-18" }))).toBe("credit_card_payment");
    expect(classifyTransaction(tx({ amount: -313503, description: "Essex Portfolio Rental", date: "2026-04-03" }))).toBe("housing");
    expect(classifyTransaction(tx({ amount: 56375, description: "Zelle Payment From Jonathan Gaytan", date: "2026-03-30" }))).toBe("reimbursement");
    expect(classifyTransaction(tx({ amount: -50000, description: "Online Realtime Transfer To Everyday Checking", date: "2026-03-20" }))).toBe("transfer");
  });

  it("summarizes transaction types for the month", () => {
    const result = summarizeTransactionTypes([
      tx({ amount: -212461, description: "Payment To Chase Card Ending IN 1941", date: "2026-03-18" }),
      tx({ amount: -313503, description: "Essex Portfolio Rental", date: "2026-04-03" }),
      tx({ amount: 56375, description: "Zelle Payment From Jonathan Gaytan", date: "2026-03-30" }),
      tx({ amount: -1500, description: "Coffee", date: "2026-05-10" }),
    ]);

    expect(result).toEqual([
      { type: "housing", amountCents: 313503, count: 1 },
      { type: "credit_card_payment", amountCents: 212461, count: 1 },
      { type: "reimbursement", amountCents: 56375, count: 1 },
      { type: "expense", amountCents: 1500, count: 1 },
    ]);
  });
});
