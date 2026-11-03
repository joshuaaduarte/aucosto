import { describe, expect, it } from "vitest";
import { deriveTracking } from "@/app/app/finance/_lib/derive-tracking";
import { encodeEntryMeta, shouldNudgeToLog } from "@/lib/finance-entries";
import type {
  FinanceAccount,
  FinanceBudget,
  FinanceStatementCheck,
  FinanceTransaction,
} from "@/generated/prisma/client";

const d = (s: string) => new Date(`${s}T12:00:00`);
const now = d("2026-11-05");

function account(id: string, kind: string, balance: number, updated = "2026-11-01"): FinanceAccount {
  return {
    id,
    userId: "scope",
    connectionId: null,
    externalId: null,
    syncSource: "manual",
    name: id,
    kind,
    currency: "USD",
    includeInNetWorth: true,
    includeInCashPosition: kind === "checking",
    currentBalanceCents: balance,
    balanceUpdatedAt: d(updated),
    statementBalanceCents: null,
    dueDate: null,
    creditLimitCents: null,
    createdAt: d(updated),
    updatedAt: d(updated),
  };
}

function tx(id: string, date: string, amount: number, extra: Partial<FinanceTransaction> = {}): FinanceTransaction {
  return {
    id,
    userId: "scope",
    financeAccountId: null,
    externalId: null,
    syncSource: "manual",
    postedStatus: null,
    providerCategory: null,
    date: d(date),
    amount,
    currency: "USD",
    description: id,
    account: null,
    category: "Groceries",
    raw: null,
    createdAt: d(date),
    updatedAt: d(date),
    ...extra,
  };
}

function budget(category: string, cents: number): FinanceBudget {
  return { id: category, userId: "scope", category, monthlyLimitCents: cents, createdAt: now, updatedAt: now };
}

describe("deriveTracking", () => {
  const accounts = [account("Checking", "checking", 500000), account("Card", "credit_card", 40000)];
  const history = [
    tx("Trader Joe's", "2026-11-03", -5000, {
      financeAccountId: "Card",
      postedStatus: "pending",
      raw: encodeEntryMeta({ by: "ana" }),
      category: null,
    }),
    tx("Safeway", "2026-11-02", -3000, { financeAccountId: "Checking", raw: encodeEntryMeta({ by: "josh" }) }),
    tx("Payroll", "2026-10-15", 400000, { category: "Income" }),
    tx("Groceries Oct", "2026-10-10", -100000),
  ];
  const checks: FinanceStatementCheck[] = [
    {
      id: "c1",
      userId: "scope",
      financeAccountId: "Checking",
      periodStart: d("2026-08-01"),
      periodEnd: d("2026-08-31"),
      openingBalanceCents: 0,
      closingBalanceCents: 0,
      adjustmentCents: 0,
      matchedCount: 0,
      addedCount: 0,
      checkedByUserId: null,
      createdAt: d("2026-09-01"),
    },
  ];

  const view = deriveTracking({
    accounts,
    history,
    budgets: [budget("Flexible", 150000), budget("Groceries", 60000)],
    bills: [],
    goals: [],
    snapshots: [],
    plans: [],
    checks,
    names: { ana: "Ana Duarte", josh: "Josh Duarte" },
    viewerUserId: "josh",
    now,
  });

  it("splits the flexible pool from category limits", () => {
    expect(view.flexibleLimitCents).toBe(150000);
    expect(view.categoryBudgets.map((b) => b.category)).toEqual(["Groceries"]);
    expect(view.pacing.month.spentCents).toBe(8000);
  });

  it("shows who logged what, and counts the to-do piles", () => {
    expect(view.entries[0]).toMatchObject({ byInitials: "AD", status: "pending", accountName: "Card", day: "2026-11-03" });
    expect(view.toSortCount).toBe(1);
    expect(view.pendingCount).toBe(1);
  });

  it("defaults quick add to the account this person used last", () => {
    expect(view.defaultAccountId).toBe("Checking");
  });

  it("flags statements that are due", () => {
    const byId = Object.fromEntries(view.accountRows.map((a) => [a.id, a]));
    expect(byId.Checking!.checkDue).toBe(true); // last checked in August
    expect(byId.Card!.checkDue).toBe(true); // never checked, has a pending entry
    expect(byId.Card!.pendingCount).toBe(1);
  });

  it("projects from today's net worth with recent savings", () => {
    expect(view.projection[0]!.totalCents).toBe(460000);
    // October net = 400000 income - 100000 spend; only month with data.
    expect(view.extraMonthlySavingsCents).toBe(300000);
    expect(view.projection[1]!.totalCents).toBe(760000);
  });
});

describe("shouldNudgeToLog", () => {
  it("only nudges people who log by hand, on a quiet day", () => {
    expect(shouldNudgeToLog({ loggedLast30Days: 5, loggedToday: 0 })).toBe(true);
    expect(shouldNudgeToLog({ loggedLast30Days: 5, loggedToday: 1 })).toBe(false);
    expect(shouldNudgeToLog({ loggedLast30Days: 0, loggedToday: 0 })).toBe(false);
  });
});
