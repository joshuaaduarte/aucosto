import { describe, expect, it } from "vitest";
import { deriveFinanceDashboard } from "@/app/app/finance/_lib/derive";
import type {
  FinanceAccount,
  FinanceGoal,
  FinanceTransaction,
} from "@/generated/prisma/client";

const NOW = new Date("2026-05-16T12:00:00.000Z");

function account(overrides: Partial<FinanceAccount> = {}): FinanceAccount {
  return {
    id: `acc-${Math.random()}`,
    userId: "user-1",
    connectionId: null,
    externalId: null,
    syncSource: "manual",
    name: "Card",
    kind: "credit_card",
    currency: "USD",
    includeInNetWorth: true,
    includeInCashPosition: false,
    currentBalanceCents: -10000,
    balanceUpdatedAt: NOW,
    statementBalanceCents: -10000,
    dueDate: null,
    creditLimitCents: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  } as FinanceAccount;
}

function goal(overrides: Partial<FinanceGoal> = {}): FinanceGoal {
  return {
    id: `g-${Math.random()}`,
    userId: "user-1",
    name: "Wedding",
    owner: "shared",
    category: "wedding",
    targetAmountCents: 1000000,
    currentAmountCents: 250000,
    targetDate: new Date("2026-12-31T00:00:00.000Z"),
    monthlyContributionCents: null,
    status: "active",
    notes: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  } as FinanceGoal;
}

function tx(overrides: Partial<FinanceTransaction> = {}): FinanceTransaction {
  return {
    id: `t-${Math.random()}`,
    userId: "user-1",
    externalId: null,
    syncSource: "csv",
    financeAccountId: null,
    postedStatus: null,
    providerCategory: null,
    date: new Date("2026-05-05T00:00:00.000Z"),
    amount: -2500,
    currency: "USD",
    description: "Coffee",
    account: "Card",
    category: "Food & Drink",
    raw: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  } as FinanceTransaction;
}

describe("deriveFinanceDashboard", () => {
  it("returns empty-but-typed result when there is no data", () => {
    const data = deriveFinanceDashboard({
      accounts: [],
      goals: [],
      history: [],
      count: 0,
      now: NOW,
    });

    expect(data.alerts).toEqual([]);
    expect(data.thisMonth).toEqual([]);
    expect(data.snapshot.cashCents).toBe(0);
  });

  it("splits transactions into this month / last month buckets", () => {
    const data = deriveFinanceDashboard({
      accounts: [],
      goals: [],
      history: [
        tx({ date: new Date("2026-05-10T00:00:00.000Z"), amount: -1000 }),
        tx({ date: new Date("2026-04-15T00:00:00.000Z"), amount: -2000 }),
        tx({ date: new Date("2026-03-30T00:00:00.000Z"), amount: -3000 }),
      ],
      count: 3,
      now: NOW,
    });

    expect(data.thisMonth).toHaveLength(1);
    expect(data.lastMonth).toHaveLength(1);
    expect(data.spendDeltaCents).toBe(
      data.thisMonthSummary.spentCents - data.lastMonthSummary.spentCents,
    );
  });

  it("emits an amber alert when current spend > last month spend", () => {
    const data = deriveFinanceDashboard({
      accounts: [],
      goals: [],
      history: [
        tx({ date: new Date("2026-05-10T00:00:00.000Z"), amount: -20000 }),
        tx({ date: new Date("2026-04-15T00:00:00.000Z"), amount: -10000 }),
      ],
      count: 2,
      now: NOW,
    });

    const spendAlert = data.alerts.find((a) => a.title.includes("True spend"));
    expect(spendAlert?.tone).toBe("amber");
  });

  it("emits a due-date alert when a card has a due date", () => {
    const due = new Date("2026-05-20T00:00:00.000Z");
    const data = deriveFinanceDashboard({
      accounts: [account({ dueDate: due, name: "Chase Sapphire" })],
      goals: [],
      history: [],
      count: 0,
      now: NOW,
    });

    const dueAlert = data.alerts.find((a) => a.title.includes("Chase Sapphire"));
    expect(dueAlert?.tone).toBe("amber");
  });

  it("includes top goal pressure when a monthly contribution is needed", () => {
    const data = deriveFinanceDashboard({
      accounts: [],
      goals: [goal()],
      history: [],
      count: 0,
      now: NOW,
    });

    expect(data.topGoal?.name).toBe("Wedding");
    expect(data.topGoalProgress?.monthlyNeededCents).toBeGreaterThan(0);
  });

  it("excludes a manual account that duplicates a linked one", () => {
    const data = deriveFinanceDashboard({
      accounts: [
        account({
          id: "linked",
          name: "Chase Checking 1234",
          kind: "checking",
          syncSource: "teller",
          currentBalanceCents: 100000,
        }),
        account({
          id: "manual",
          name: "Chase Checking 1234",
          kind: "checking",
          syncSource: "manual",
          currentBalanceCents: 100000,
        }),
      ],
      goals: [],
      history: [],
      count: 0,
      now: NOW,
    });

    expect(data.duplicateManualAccounts.map((a) => a.id)).toEqual(["manual"]);
    expect(data.effectiveAccounts.map((a) => a.id)).toEqual(["linked"]);
  });
});
