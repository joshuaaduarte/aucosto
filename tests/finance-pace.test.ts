import { describe, expect, it } from "vitest";
import { calculateSpendProjection, projectCategories } from "@/lib/finance-pace";

function tx({ amount, description, category }: { amount: number; description: string; category?: string | null }) {
  return { amount, description, category: category ?? null };
}

describe("finance-pace", () => {
  it("projects month-end spend from current pace", () => {
    const result = calculateSpendProjection(
      [
        tx({ amount: -15000, description: "Groceries" }),
        tx({ amount: -5000, description: "Coffee" }),
        tx({ amount: -25000, description: "Discover E-Payment" }),
      ],
      new Date("2026-05-10T12:00:00.000Z"),
    );

    expect(result.spentCents).toBe(20000);
    expect(result.daysElapsed).toBe(10);
    expect(result.daysInMonth).toBe(31);
    expect(result.projectedCents).toBe(62000);
  });

  it("projects top categories using stored or inferred category", () => {
    const result = projectCategories(
      [
        tx({ amount: -15000, description: "Trader Joe's", category: "Groceries" }),
        tx({ amount: -5000, description: "Coffee", category: "Food & Drink" }),
        tx({ amount: -2000, description: "Spotify", category: null }),
      ],
      { now: new Date("2026-05-10T12:00:00.000Z"), limit: 3 },
    );

    expect(result).toEqual([
      { category: "Groceries", spentCents: 15000, projectedCents: 46500 },
      { category: "Food & Drink", spentCents: 5000, projectedCents: 15500 },
      { category: "Subscriptions", spentCents: 2000, projectedCents: 6200 },
    ]);
  });
});
