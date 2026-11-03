import { describe, expect, it } from "vitest";
import {
  goalReachDate,
  monthlyRate,
  netWorthDrivers,
  netWorthHistory,
  projectNetWorth,
  recentMonthlySavingsCents,
  signedBalance,
} from "@/lib/finance-networth";

const d = (s: string) => new Date(`${s}T12:00:00`);
const account = (id: string, kind: string, balance: number, updated: string) => ({
  id,
  kind,
  includeInNetWorth: true,
  currentBalanceCents: balance,
  balanceUpdatedAt: d(updated),
});

describe("signedBalance", () => {
  it("makes debts negative", () => {
    expect(signedBalance("credit_card", 5000)).toBe(-5000);
    expect(signedBalance("loan", -10)).toBe(-0);
    expect(signedBalance("checking", 5000)).toBe(5000);
  });
});

describe("netWorthHistory", () => {
  it("rebuilds month-ends from the latest snapshot on each day", () => {
    const accounts = [account("chk", "checking", 300000, "2026-11-02"), account("card", "credit_card", 50000, "2026-11-01")];
    const snapshots = [
      { financeAccountId: "chk", balanceCents: 100000, asOf: d("2026-09-15") },
      { financeAccountId: "chk", balanceCents: 200000, asOf: d("2026-10-15") },
      { financeAccountId: "card", balanceCents: 20000, asOf: d("2026-10-20") },
    ];
    const points = netWorthHistory({ accounts, snapshots, now: d("2026-11-05"), months: 3 });
    expect(points.map((p) => p.totalCents)).toEqual([100000, 180000, 250000]);
    expect(points[2]!.byGroup.debt).toBe(-50000);
    expect(netWorthDrivers(points[1]!, points[2]!)).toEqual([
      { group: "cash", deltaCents: 100000 },
      { group: "debt", deltaCents: -30000 },
    ]);
  });

  it("skips accounts left out of net worth", () => {
    const accounts = [{ ...account("x", "checking", 5000, "2026-11-01"), includeInNetWorth: false }];
    expect(netWorthHistory({ accounts, snapshots: [], now: d("2026-11-05") })).toEqual([]);
  });
});

describe("projectNetWorth", () => {
  it("adds contributions, growth and extra savings, and pays down debt", () => {
    const points = projectNetWorth({
      accounts: [
        { ...account("inv", "investment", 100000, "2026-11-01"), plan: { monthlyContributionCents: 10000, annualGrowthBps: 0 } },
        { ...account("card", "credit_card", 15000, "2026-11-01"), plan: { monthlyContributionCents: 10000, annualGrowthBps: 0 } },
      ],
      extraMonthlySavingsCents: 5000,
      now: d("2026-11-05"),
      months: 2,
    });
    expect(points.map((p) => p.totalCents)).toEqual([85000, 110000, 130000]);
  });

  it("compounds growth monthly", () => {
    expect(monthlyRate(1200)).toBeCloseTo(0.00949, 4);
    const points = projectNetWorth({
      accounts: [{ ...account("inv", "investment", 100000, "2026-11-01"), plan: { monthlyContributionCents: 0, annualGrowthBps: 1000 } }],
      extraMonthlySavingsCents: 0,
      now: d("2026-11-05"),
      months: 12,
    });
    expect(points[12]!.totalCents).toBe(110000);
  });
});

describe("helpers", () => {
  it("averages recent savings, floored at zero", () => {
    expect(recentMonthlySavingsCents([30000, 10000, -10000])).toBe(10000);
    expect(recentMonthlySavingsCents([-5000])).toBe(0);
    expect(recentMonthlySavingsCents([])).toBe(0);
  });
  it("dates a goal by its own pace", () => {
    const now = d("2026-11-05");
    expect(goalReachDate({ targetAmountCents: 100000, currentAmountCents: 40000, monthlyContributionCents: 20000 }, now)).toEqual(new Date(2027, 1, 1));
    expect(goalReachDate({ targetAmountCents: 100000, currentAmountCents: 0, monthlyContributionCents: null }, now)).toBeNull();
    expect(goalReachDate({ targetAmountCents: 100, currentAmountCents: 200, monthlyContributionCents: null }, now)).toBe(now);
  });
});
