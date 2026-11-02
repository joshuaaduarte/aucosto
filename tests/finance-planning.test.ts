import { describe, expect, it } from "vitest";
import {
  advanceDueDate,
  billsDueWithin,
  budgetProgress,
  buildMoneyDateSummary,
  dueLabel,
  moneyDateWeekKey,
  suggestBillsFromRecurring,
} from "@/lib/finance-planning";

const tx = (date: string, amount: number, category: string | null, description = "Store") => ({
  date: new Date(`${date}T12:00:00`),
  amount,
  category,
  description,
});

describe("budgetProgress", () => {
  const now = new Date("2026-11-10T12:00:00");

  it("flags over, at-risk and on-track budgets, worst first", () => {
    const transactions = [
      tx("2026-11-02", -50000, "Groceries"), // $500 by the 10th of a 30-day month
      tx("2026-11-03", -12000, "Food & Drink"),
      tx("2026-11-04", -2000, "Pets"),
      tx("2026-10-30", -99999, "Pets"), // last month, ignored
      tx("2026-11-05", 300000, "Income"), // inflow, ignored
    ];
    const result = budgetProgress(
      [
        { category: "Groceries", monthlyLimitCents: 60000 },
        { category: "Food & Drink", monthlyLimitCents: 10000 },
        { category: "Pets", monthlyLimitCents: 10000 },
      ],
      transactions,
      now,
    );
    expect(result.map((r) => [r.category, r.status])).toEqual([
      ["Food & Drink", "over"],
      ["Groceries", "at_risk"],
      ["Pets", "on_track"],
    ]);
    expect(result[1]!.projectedCents).toBe(150000);
    expect(result[2]!.remainingCents).toBe(8000);
  });
});

describe("advanceDueDate", () => {
  it("rolls monthly, quarterly and yearly with month-end clamping", () => {
    const jan31 = new Date(2026, 0, 31, 12);
    expect(advanceDueDate(jan31, "monthly")!.getDate()).toBe(28);
    expect(advanceDueDate(jan31, "monthly")!.getMonth()).toBe(1);
    expect(advanceDueDate(new Date(2026, 10, 15, 12), "quarterly")!.getMonth()).toBe(1);
    expect(advanceDueDate(new Date(2026, 10, 15, 12), "yearly")!.getFullYear()).toBe(2027);
    expect(advanceDueDate(new Date(2026, 10, 15, 12), "weekly")!.getDate()).toBe(22);
    expect(advanceDueDate(new Date(2026, 10, 15, 12), "once")).toBeNull();
  });
});

describe("bills due", () => {
  const now = new Date(2026, 10, 10, 8);
  const bills = [
    { id: "a", name: "Rent", amountCents: 250000, nextDueAt: new Date(2026, 10, 12, 12), autopay: false },
    { id: "b", name: "Insurance", amountCents: 9000, nextDueAt: new Date(2026, 10, 9, 12), autopay: false },
    { id: "c", name: "Car reg", amountCents: null, nextDueAt: new Date(2027, 0, 1, 12), autopay: false },
  ];

  it("returns bills in the window, overdue first", () => {
    const due = billsDueWithin(bills, now, 7);
    expect(due.map((b) => [b.name, b.daysUntil, b.overdue])).toEqual([
      ["Insurance", -1, true],
      ["Rent", 2, false],
    ]);
  });

  it("labels due dates", () => {
    expect(dueLabel(-3)).toBe("3 days overdue");
    expect(dueLabel(0)).toBe("Due today");
    expect(dueLabel(1)).toBe("Due tomorrow");
    expect(dueLabel(5)).toBe("Due in 5 days");
  });

  it("suggests untracked recurring charges as bills", () => {
    const suggestions = suggestBillsFromRecurring(
      [
        { merchant: "Netflix", amountCents: 1599, count: 3, account: null, lastDate: new Date(2026, 9, 20, 12) },
        { merchant: "Rent", amountCents: 250000, count: 3, account: null, lastDate: new Date(2026, 9, 1, 12) },
      ],
      ["rent"],
    );
    expect(suggestions).toHaveLength(1);
    expect(suggestions[0]!.name).toBe("Netflix");
    expect(suggestions[0]!.nextDueAt.getMonth()).toBe(10);
  });
});

describe("money date", () => {
  it("uses a Monday week key", () => {
    expect(moneyDateWeekKey(new Date(2026, 10, 2, 9))).toBe("2026-11-02"); // Monday
    expect(moneyDateWeekKey(new Date(2026, 10, 8, 21))).toBe("2026-11-02"); // Sunday
    expect(moneyDateWeekKey(new Date(2026, 10, 9, 1))).toBe("2026-11-09");
  });

  it("summarizes the last 7 days against the 7 before", () => {
    const now = new Date("2026-11-10T18:00:00");
    const summary = buildMoneyDateSummary({
      transactions: [
        tx("2026-11-09", -3000, "Groceries"),
        tx("2026-11-05", -2000, null, "Mystery shop"),
        tx("2026-11-01", -1000, "Groceries"),
      ],
      budgets: [],
      billsDueSoon: 2,
      now,
    });
    expect(summary.lastSevenDaysSpentCents).toBe(5000);
    expect(summary.previousSevenDaysSpentCents).toBe(1000);
    expect(summary.topCategories[0]).toEqual({ category: "Groceries", spentCents: 3000 });
    expect(summary.uncategorizedCount).toBe(1);
    expect(summary.billsComingUp).toBe(2);
  });
});
