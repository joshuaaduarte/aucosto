import { describe, expect, it } from "vitest";
import {
  detectPaychecks,
  isPaycheck,
  payKey,
  paychecksFromBudgets,
  salaryBudget,
  type Paycheck,
} from "@/lib/finance-paychecks";
import type { NextMonthForecast } from "@/lib/finance-trends";
import { normalizeCategory, spendCategoryChoices } from "@/lib/finance-categories";
import { deriveSalary } from "@/app/app/finance/_lib/derive-salary";

const d = (s: string) => new Date(`${s}T12:00:00`);

function tx(date: string, amount: number, description = "Deposit", raw: string | null = null) {
  return { date: d(date), amount, description, category: null, account: null, externalId: null, raw };
}

const JOSH = 311720;
const ANA = 224187;
// Alternating weeks: Josh, Ana, Josh, Ana…
const pay = [
  tx("2026-09-04", JOSH, "ACME PAYROLL"),
  tx("2026-09-11", ANA, "GLOBEX PAYROLL"),
  tx("2026-09-18", JOSH, "ACME PAYROLL"),
  tx("2026-09-25", ANA, "GLOBEX PAYROLL"),
  tx("2026-10-02", JOSH, "ACME PAYROLL"),
  tx("2026-10-09", ANA, "GLOBEX PAYROLL"),
  tx("2026-10-16", JOSH, "ACME PAYROLL"),
  tx("2026-10-23", ANA, "GLOBEX PAYROLL"),
  tx("2026-10-30", JOSH, "ACME PAYROLL"),
];

describe("paychecks", () => {
  it("reads paychecks back from the reserved budget rows", () => {
    const rows = [
      { category: payKey("invest", "Ana"), monthlyLimitCents: ANA },
      { category: "Groceries", monthlyLimitCents: 60000 },
      { category: payKey("live", "Josh"), monthlyLimitCents: JOSH },
      { category: "__pay__:bogus:X", monthlyLimitCents: 1 },
    ];
    const checks = paychecksFromBudgets(rows);
    expect(checks.map((c) => [c.name, c.role])).toEqual([
      ["Josh", "live"],
      ["Ana", "invest"],
    ]);
    // 26 checks a year ÷ 12.
    expect(checks[0]!.monthlyCents).toBe(Math.round((JOSH * 26) / 12));
  });

  it("recognizes a paycheck by amount, within 3%", () => {
    expect(isPaycheck(tx("2026-10-02", 315000), JOSH)).toBe(true);
    expect(isPaycheck(tx("2026-10-02", 340000), JOSH)).toBe(false);
    expect(isPaycheck(tx("2026-10-02", -JOSH), JOSH)).toBe(false);
  });

  it("spots deposits that repeat every two weeks, biggest first", () => {
    const found = detectPaychecks([...pay, tx("2026-10-05", 5000, "Venmo")]);
    expect(found.map((f) => f.perCheckCents)).toEqual([JOSH, ANA]);
    expect(found[0]!.count).toBe(5);
  });
});

const forecast = (over: Partial<NextMonthForecast> = {}): NextMonthForecast => ({
  month: d("2026-12-01"),
  bills: [{ name: "Rent", cents: 250000 }],
  subscriptions: [{ name: "Netflix", cents: 2000 }],
  categories: [
    { name: "Groceries", cents: 60000 },
    { name: "Food & Drink", cents: 40000 },
    { name: "Shopping", cents: 30000 },
  ],
  totalCents: 382000,
  basedOnMonths: 3,
  ...over,
});

const paychecks: Paycheck[] = [
  { name: "Josh", role: "live", perCheckCents: JOSH, monthlyCents: Math.round((JOSH * 26) / 12) },
  { name: "Ana", role: "invest", perCheckCents: ANA, monthlyCents: Math.round((ANA * 26) / 12) },
];

describe("salaryBudget", () => {
  const ceiling = Math.round((JOSH * 26) / 12); // ≈ $6,754

  it("is nothing without a live-on paycheck", () => {
    expect(
      salaryBudget({ paychecks: [paychecks[1]!], forecast: forecast(), potsMonthlyCents: 0, spentThisMonthCents: 0, history: [], now: d("2026-10-20") }),
    ).toBeNull();
  });

  it("splits a typical month into needs and wants against the live-on pay", () => {
    const b = salaryBudget({ paychecks, forecast: forecast(), potsMonthlyCents: 50000, spentThisMonthCents: 100000, history: pay, now: d("2026-10-20") })!;
    expect(b.ceilingCents).toBe(ceiling);
    expect(b.needsCents).toBe(250000 + 60000);
    expect(b.wantsCents).toBe(2000 + 40000 + 30000);
    expect(b.leftoverCents).toBe(ceiling - 310000 - 72000 - 50000);
    expect(b.suggestedLimits.every((l) => !l.trimmed)).toBe(true);
    // October: three of Josh's checks (2nd, 16th, 30th), two of Ana's.
    expect(b.thisMonth.live).toEqual({ count: 3, cents: 3 * JOSH });
    expect(b.thisMonth.invest).toEqual({ count: 2, cents: 2 * ANA });
    expect(b.thisMonth.bonusCents).toBe(JOSH);
    // Heading for the typical month (bigger than spent so far) plus set-asides.
    expect(b.thisMonth.expectedCents).toBe(382000 + 50000);
    expect(b.thisMonth.dipCents).toBe(0);
  });

  it("trims wants to fit when the plan runs past the pay, and flags the dip", () => {
    const big = forecast({
      bills: [{ name: "Rent", cents: 500000 }],
      totalCents: 500000 + 2000 + 130000,
    });
    const b = salaryBudget({ paychecks, forecast: big, potsMonthlyCents: 100000, spentThisMonthCents: 0, history: [], now: d("2026-11-03") })!;
    expect(b.leftoverCents).toBeLessThan(0);
    const wants = b.suggestedLimits.filter((l) => l.trimmed);
    expect(wants.map((l) => l.category)).toEqual(["Food & Drink", "Shopping"]);
    // Room for wants: ceiling − needs − subscriptions − pots.
    const room = ceiling - 560000 - 2000 - 100000;
    expect(wants.reduce((a, l) => a + l.cents, 0)).toBeLessThanOrEqual(room);
    // Needs are never trimmed (rounded up to $5).
    expect(b.suggestedLimits.find((l) => l.category === "Groceries")).toEqual({ category: "Groceries", cents: 60000, trimmed: false });
    expect(b.thisMonth.dipCents).toBe(632000 + 100000 - ceiling);
  });
});

describe("custom categories", () => {
  it("cleans typed names and matches built-in spelling", () => {
    expect(normalizeCategory("  groceries ")).toBe("Groceries");
    expect(normalizeCategory("Date   night")).toBe("Date night");
    expect(normalizeCategory("   ")).toBeNull();
    expect(normalizeCategory("x".repeat(60))).toHaveLength(40);
  });

  it("offers built-ins, then custom ones by use", () => {
    const choices = spendCategoryChoices([
      { category: "Date night" },
      { category: "Baby" },
      { category: "Baby" },
      { category: "groceries" },
      { category: null },
    ]);
    expect(choices).not.toContain("Income");
    expect(choices.slice(-2)).toEqual(["Baby", "Date night"]);
    expect(choices.filter((c) => c.toLowerCase() === "groceries")).toHaveLength(1);
  });
});

describe("deriveSalary", () => {
  const now = d("2026-11-03");
  const goal = (over: Record<string, unknown>) =>
    ({
      id: "g",
      userId: "u",
      name: "Travel",
      owner: "shared",
      category: "vacation",
      targetAmountCents: 300000,
      currentAmountCents: 50000,
      targetDate: null,
      monthlyContributionCents: 25000,
      status: "active",
      notes: null,
      createdAt: now,
      updatedAt: now,
      ...over,
    }) as never;
  const history = [
    ...pay,
    tx("2026-11-01", -12000, "Trader Joe's"),
    // Paid from the travel pot: not this month's spending.
    tx("2026-11-02", -40000, "Flights", JSON.stringify({ aucosto: 1, pot: "g" })),
  ].map((t) => ({ ...t, id: t.description, userId: "u", financeAccountId: null, createdAt: t.date })) as never[];

  const view = deriveSalary({
    paychecks,
    history,
    bills: [],
    goals: [goal({}), goal({ id: "done", status: "done" })],
    accounts: [{ name: "Chase Checking", kind: "checking" }],
    hasLimits: false,
    people: ["Josh", "Ana"],
    now,
  });

  it("lists active pots and their monthly amounts", () => {
    expect(view.pots.map((p) => p.id)).toEqual(["g"]);
    expect(view.budget!.potsCents).toBe(25000);
    expect(view.heldIn).toBe("Chase Checking");
  });

  it("leaves pot-funded purchases out of this month's spending", () => {
    expect(view.budget!.thisMonth.spentCents).toBe(12000);
  });

  it("offers an emergency fund of six typical months when there isn't one", () => {
    expect(view.emergencyTargetCents).toBe(view.forecast.totalCents > 0 ? view.forecast.totalCents * 6 : null);
  });

  it("prefills the paycheck form from what's saved", () => {
    expect(view.paycheckRows).toEqual([
      { name: "Josh", role: "live", perCheck: "3117.20" },
      { name: "Ana", role: "invest", perCheck: "2241.87" },
    ]);
  });

  it("without saved paychecks, prefills names and amounts seen in the history", () => {
    const fresh = deriveSalary({
      paychecks: [],
      history,
      bills: [],
      goals: [],
      accounts: [],
      hasLimits: false,
      people: ["Josh", "Ana"],
      now,
    });
    expect(fresh.budget).toBeNull();
    expect(fresh.paycheckRows).toEqual([
      { name: "Josh", role: "live", perCheck: "3117.20" },
      { name: "Ana", role: "invest", perCheck: "2241.87" },
    ]);
  });
});
