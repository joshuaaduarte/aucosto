import { describe, expect, it } from "vitest";
import {
  buildPacing,
  categoryPace,
  monthlyEquivalentCents,
  splitBills,
  suggestFlexibleLimitCents,
  weekBounds,
} from "@/lib/finance-pacing";

const d = (s: string) => new Date(`${s}T12:00:00`);
const tx = (date: string, amount: number, description: string, category: string | null = null) => ({
  date: d(date),
  amount,
  description,
  category,
});

describe("bills", () => {
  it("converts cadences to a monthly amount", () => {
    expect(monthlyEquivalentCents({ amountCents: 1200, cadence: "yearly" })).toBe(100);
    expect(monthlyEquivalentCents({ amountCents: 300, cadence: "quarterly" })).toBe(100);
    expect(monthlyEquivalentCents({ amountCents: 1200, cadence: "weekly" })).toBe(5200);
    expect(monthlyEquivalentCents({ amountCents: 999, cadence: "once" })).toBe(0);
  });
  it("splits fixed and occasional", () => {
    expect(
      splitBills([
        { name: "Rent", amountCents: 200000, cadence: "monthly" },
        { name: "Car insurance", amountCents: 120000, cadence: "yearly" },
      ]),
    ).toEqual({ fixedMonthlyCents: 200000, occasionalMonthlyCents: 10000 });
  });
});

describe("weekBounds", () => {
  it("starts on Monday", () => {
    const { start, end } = weekBounds(d("2026-11-05")); // Thursday
    expect(start.getDate()).toBe(2);
    expect(end.getDate()).toBe(9);
  });
});

describe("buildPacing", () => {
  const transactions = [
    tx("2026-11-02", -6000, "Trader Joe's", "Groceries"),
    tx("2026-11-03", -4000, "Taco place", "Food & Drink"),
    tx("2026-11-01", -200000, "Rent payment", "Housing"),
    tx("2026-11-04", -1500, "Netflix", "Subscriptions"),
    tx("2026-11-04", 300000, "Payroll", "Income"),
  ];

  it("counts only flexible spending against the pace line", () => {
    const p = buildPacing({ flexibleLimitCents: 300000, transactions, bills: [], now: d("2026-11-05") });
    expect(p.month.spentCents).toBe(10000);
    expect(p.month.expectedByTodayCents).toBe(50000); // 3000 * 5/30
    expect(p.month.aheadCents).toBe(40000);
    expect(p.status).toBe("good");
    expect(p.cumulativeByDay).toEqual([0, 6000, 10000, 10000, 10000]);
  });

  it("gives a weekly allowance from what's left", () => {
    // Week of Mon Nov 2. Spent before the week: $0 (Nov 1 was rent only).
    // 30 days from Nov 2 through Nov 30 is 29; 7 of them this week.
    const p = buildPacing({ flexibleLimitCents: 290000, transactions, bills: [], now: d("2026-11-05") });
    expect(p.week.allowanceCents).toBe(70000);
    expect(p.week.spentCents).toBe(10000);
    expect(p.week.leftCents).toBe(60000);
    expect(p.week.daysLeft).toBe(4);
  });

  it("treats a bill's category as fixed", () => {
    const p = buildPacing({
      flexibleLimitCents: 100000,
      transactions,
      bills: [{ name: "Food plan", amountCents: 1000, cadence: "monthly", category: "Food & Drink" }],
      now: d("2026-11-05"),
    });
    expect(p.month.spentCents).toBe(6000);
  });

  it("flags overspending", () => {
    const p = buildPacing({ flexibleLimitCents: 5000, transactions, bills: [], now: d("2026-11-05") });
    expect(p.status).toBe("over");
  });

  it("is unset without a limit", () => {
    const p = buildPacing({ flexibleLimitCents: null, transactions, bills: [], now: d("2026-11-05") });
    expect(p.status).toBe("unset");
    expect(p.week.allowanceCents).toBe(0);
  });

  it("clips the week to the month at a month start", () => {
    // Sun Nov 1 2026: week began Mon Oct 26, clip to Nov 1 → 1 day in month.
    const p = buildPacing({ flexibleLimitCents: 300000, transactions: [], bills: [], now: d("2026-11-01") });
    expect(p.week.start.getDate()).toBe(1);
    expect(p.week.allowanceCents).toBe(10000);
  });
});

describe("suggestFlexibleLimitCents", () => {
  it("averages recent months and rounds up to $50", () => {
    const history = [
      tx("2026-10-10", -41000, "Groceries", "Groceries"),
      tx("2026-09-10", -39000, "Groceries", "Groceries"),
      tx("2026-10-11", -200000, "Rent", "Housing"),
    ];
    expect(suggestFlexibleLimitCents(history, [], d("2026-11-05"))).toBe(40000);
    expect(suggestFlexibleLimitCents([], [], d("2026-11-05"))).toBeNull();
  });
});

describe("categoryPace", () => {
  it("marks where spending should be", () => {
    expect(categoryPace(30000, 5000, d("2026-11-10"))).toEqual({ expectedByTodayCents: 10000, aheadCents: 5000 });
  });
});
