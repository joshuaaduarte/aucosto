import { describe, expect, it } from "vitest";
import { categoryTrends, forecastNextMonth } from "@/lib/finance-trends";

const d = (s: string) => new Date(`${s}T12:00:00`);
const now = d("2026-11-10");

function tx(date: string, amount: number, description: string, category: string | null = null) {
  return { date: d(date), amount, description, category, account: null, externalId: null, raw: null };
}

// Aug–Oct full months, plus November so far.
const history = [
  tx("2026-08-01", -200000, "Essex Rent", "Housing"),
  tx("2026-09-01", -200000, "Essex Rent", "Housing"),
  tx("2026-10-01", -200000, "Essex Rent", "Housing"),
  tx("2026-08-05", -1599, "Netflix", "Subscriptions"),
  tx("2026-09-05", -1599, "Netflix", "Subscriptions"),
  tx("2026-10-05", -1599, "Netflix", "Subscriptions"),
  tx("2026-11-05", -1599, "Netflix", "Subscriptions"),
  tx("2026-08-10", -40000, "Trader Joe's", "Groceries"),
  tx("2026-09-10", -50000, "Trader Joe's", "Groceries"),
  tx("2026-10-10", -90000, "Whole Foods", "Groceries"),
  tx("2026-11-02", -12000, "Trader Joe's", "Groceries"),
  tx("2026-10-20", -6000, "Tacos", "Dining"),
  tx("2026-10-15", 500000, "Payroll", "Income"),
  tx("2026-10-16", -80000, "Transfer to Chase (card payment)"),
];

describe("categoryTrends", () => {
  const trends = categoryTrends({ history, now });

  it("starts at the first month with activity and ends with this month", () => {
    expect(trends.months.map((m) => m.getMonth() + 1)).toEqual([8, 9, 10, 11]);
  });

  it("sums each category per month, leaving out income and transfers", () => {
    const groceries = trends.rows.find((r) => r.category === "Groceries")!;
    expect(groceries.cents).toEqual([40000, 50000, 90000, 12000]);
    expect(groceries.averageCents).toBe(60000);
    // October vs the Aug–Sep average (45,000): +100%.
    expect(groceries.change).toBeCloseTo(1);
    expect(trends.rows.map((r) => r.category)).not.toContain("Income");
    expect(trends.rows[0]!.category).toBe("Housing");
    expect(trends.totals[2]).toBe(200000 + 1599 + 90000 + 6000);
  });
});

describe("forecastNextMonth", () => {
  it("adds bills, repeating charges and a typical month per category", () => {
    const f = forecastNextMonth({
      history,
      bills: [{ name: "Rent", amountCents: 200000, cadence: "monthly", category: "Housing" }],
      now,
    });
    expect(f.month.getMonth()).toBe(11);
    expect(f.bills).toEqual([{ name: "Rent", cents: 200000 }]);
    // Rent repeats too, but the bill covers Housing; Netflix is a subscription.
    expect(f.subscriptions).toEqual([{ name: "Netflix", cents: 1599 }]);
    expect(f.categories).toEqual([
      { name: "Groceries", cents: 60000 },
      { name: "Dining", cents: 2000 },
    ]);
    expect(f.basedOnMonths).toBe(3);
    expect(f.totalCents).toBe(200000 + 1599 + 62000);
  });

  it("without bills set up, repeating rent still shows as a repeating charge", () => {
    const f = forecastNextMonth({ history, bills: [], now });
    expect(f.subscriptions.map((s) => s.name)).toEqual(["Essex Rent", "Netflix"]);
    expect(f.categories.map((c) => c.name)).toEqual(["Groceries", "Dining"]);
  });

  it("is empty with no history", () => {
    const f = forecastNextMonth({ history: [], bills: [], now });
    expect(f).toMatchObject({ totalCents: 0, basedOnMonths: 0, categories: [] });
  });
});
