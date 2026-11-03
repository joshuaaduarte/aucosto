// Pure view-model for the day-to-day tracking parts of the finance page:
// pace, entries, merchants, net worth history + projection, account rows,
// and the weekly check-in to-dos. Inputs are already-fetched service rows.
// Tested in tests/finance-derive-tracking.test.ts.

import type {
  FinanceAccount,
  FinanceAccountPlan,
  FinanceBalanceSnapshot,
  FinanceBill,
  FinanceBudget,
  FinanceGoal,
  FinanceStatementCheck,
  FinanceTransaction,
} from "@/generated/prisma/client";
import {
  entryStatus,
  initials,
  lastUsedAccountId,
  merchantSuggestions,
  readEntryMeta,
} from "@/lib/finance-entries";
import {
  FLEXIBLE_BUDGET_KEY,
  buildPacing,
  suggestFlexibleLimitCents,
} from "@/lib/finance-pacing";
import {
  goalReachDate,
  netWorthHistory,
  projectNetWorth,
  recentMonthlySavingsCents,
} from "@/lib/finance-networth";
import { summarizeCashflow } from "@/lib/finance-summary";
import { billsDueWithin } from "@/lib/finance-planning";
import { isMoveEntry } from "@/lib/finance-moves";
import {
  cardBills,
  checkInRows,
  needsCatchUp,
  payFromAccountId,
  safeInChecking,
  savingsRate,
} from "@/lib/finance-routine";
import type { EntryView } from "../_components/entry-list";

const DAY_MS = 24 * 60 * 60 * 1000;
const CASH_KINDS = new Set(["checking", "savings", "cash"]);
const STATEMENT_KINDS = new Set(["checking", "savings", "credit_card"]);

export function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function deriveTracking(input: {
  accounts: FinanceAccount[];
  history: FinanceTransaction[];
  budgets: FinanceBudget[];
  bills: FinanceBill[];
  goals: FinanceGoal[];
  snapshots: FinanceBalanceSnapshot[];
  plans: FinanceAccountPlan[];
  checks: FinanceStatementCheck[];
  /** userId → display name, for "who logged it". */
  names: Record<string, string>;
  viewerUserId: string;
  now: Date;
}) {
  const { now } = input;
  const accountName = new Map(input.accounts.map((a) => [a.id, a.name]));
  const flexibleBudget = input.budgets.find((b) => b.category === FLEXIBLE_BUDGET_KEY) ?? null;
  const categoryBudgets = input.budgets.filter((b) => b.category !== FLEXIBLE_BUDGET_KEY);

  const pacing = buildPacing({
    flexibleLimitCents: flexibleBudget?.monthlyLimitCents ?? null,
    transactions: input.history,
    bills: input.bills,
    now,
  });
  const suggestedLimitCents = suggestFlexibleLimitCents(input.history, input.bills, now);

  const showWho = Object.keys(input.names).length > 1;
  // A move shows once, on its "out" row, as "From → To".
  const moveInSide = new Map<string, FinanceTransaction>();
  const moveOutPairs = new Set<string>();
  for (const tx of input.history) {
    const meta = readEntryMeta(tx.raw);
    if (meta.via !== "move" || !meta.pair) continue;
    if (meta.side === "in") moveInSide.set(meta.pair, tx);
    else if (meta.side === "out") moveOutPairs.add(meta.pair);
  }
  // Keep an arriving row only when its leaving row is gone (e.g. outside the window).
  const visibleHistory = input.history.filter((tx) => {
    const meta = readEntryMeta(tx.raw);
    return !(meta.via === "move" && meta.side === "in" && meta.pair && moveOutPairs.has(meta.pair));
  });
  const entries: EntryView[] = visibleHistory.map((tx) => {
    const meta = readEntryMeta(tx.raw);
    const by = meta.by ?? null;
    const byName = by ? (input.names[by] ?? null) : null;
    const moveIn = meta.via === "move" && meta.side === "out" && meta.pair ? moveInSide.get(meta.pair) : undefined;
    const move = isMoveEntry(tx)
      ? {
          toId: moveIn?.financeAccountId ?? null,
          toName: moveIn
            ? moveIn.financeAccountId
              ? (accountName.get(moveIn.financeAccountId) ?? moveIn.account)
              : moveIn.account
            : null,
        }
      : null;
    return {
      move,
      id: tx.id,
      day: dayKey(tx.date),
      amount: tx.amount,
      description: tx.description,
      category: tx.category,
      accountId: tx.financeAccountId,
      accountName: tx.financeAccountId ? (accountName.get(tx.financeAccountId) ?? tx.account) : tx.account,
      status: entryStatus(tx),
      byInitials: showWho && byName ? initials(byName) : null,
      byName,
    };
  });
  const toSortCount = entries.filter((e) => e.amount < 0 && !e.category && !e.move).length;
  const pendingCount = entries.filter((e) => e.status === "pending").length;

  const merchants = merchantSuggestions(input.history.filter((tx) => !isMoveEntry(tx)));
  const defaultAccountId =
    lastUsedAccountId(input.history, input.viewerUserId) ??
    input.accounts.find((a) => a.kind === "credit_card")?.id ??
    input.accounts.find((a) => a.kind === "checking")?.id ??
    null;

  // Net worth history + projection.
  const netWorthPoints = netWorthHistory({
    accounts: input.accounts,
    snapshots: input.snapshots,
    now,
    months: 12,
  });
  const planByAccount = new Map(input.plans.map((p) => [p.financeAccountId, p]));
  const cashHasContribution = input.accounts.some(
    (a) => CASH_KINDS.has(a.kind) && (planByAccount.get(a.id)?.monthlyContributionCents ?? 0) > 0,
  );
  const netByMonth: number[] = [];
  for (let back = 1; back <= 3; back++) {
    const from = new Date(now.getFullYear(), now.getMonth() - back, 1);
    const to = new Date(now.getFullYear(), now.getMonth() - back + 1, 1);
    const month = input.history.filter((t) => t.date >= from && t.date < to);
    if (month.length) netByMonth.push(summarizeCashflow(month).netCents);
  }
  const extraMonthlySavingsCents = cashHasContribution ? 0 : recentMonthlySavingsCents(netByMonth);
  const projection = projectNetWorth({
    accounts: input.accounts.map((a) => ({ ...a, plan: planByAccount.get(a.id) ?? null })),
    extraMonthlySavingsCents,
    now,
    months: 120,
  });
  const goalMarkers = input.goals
    .filter((g) => g.status !== "done")
    .map((g) => {
      const at = goalReachDate(g, now);
      const monthIndex = at
        ? (at.getFullYear() - now.getFullYear()) * 12 + (at.getMonth() - now.getMonth())
        : -1;
      return { name: g.name, at, monthIndex };
    });

  // Accounts.
  const lastCheck = new Map<string, Date>();
  for (const c of input.checks) {
    const prev = lastCheck.get(c.financeAccountId);
    if (!prev || c.periodEnd > prev) lastCheck.set(c.financeAccountId, c.periodEnd);
  }
  const pendingByAccount = new Map<string, number>();
  for (const tx of input.history) {
    if (tx.financeAccountId && entryStatus(tx) === "pending") {
      pendingByAccount.set(tx.financeAccountId, (pendingByAccount.get(tx.financeAccountId) ?? 0) + 1);
    }
  }
  const accountRows = input.accounts.map((a) => {
    const checked = lastCheck.get(a.id) ?? null;
    const pending = pendingByAccount.get(a.id) ?? 0;
    // Due when a statement has likely closed since the last check: never
    // checked but has logged entries, or last checked over ~35 days ago.
    const checkDue =
      STATEMENT_KINDS.has(a.kind) &&
      (checked ? now.getTime() - checked.getTime() > 35 * DAY_MS : pending > 0);
    return {
      id: a.id,
      name: a.name,
      kind: a.kind,
      balanceCents: a.currentBalanceCents,
      balanceUpdatedAt: a.balanceUpdatedAt,
      pendingCount: pending,
      lastCheckedThrough: checked,
      checkDue,
    };
  });
  const staleBalances = accountRows.filter(
    (a) => !STATEMENT_KINDS.has(a.kind) && now.getTime() - a.balanceUpdatedAt.getTime() > 35 * DAY_MS,
  );

  // Card bills against checking, the monthly check-in, savings rate.
  const cards = cardBills(input.accounts, now);
  const billsSoon = billsDueWithin(input.bills, now, 14);
  const safe = safeInChecking({ accounts: input.accounts, history: input.history, cards, bills: billsSoon });
  const checkIn = checkInRows({
    accounts: input.accounts,
    plans: input.plans,
    history: input.history,
    now,
    onlyCheckIn: true,
  });
  const savings = savingsRate({ history: input.history, accounts: input.accounts, plans: input.plans, now });
  const catchUp = needsCatchUp({ accounts: input.accounts, history: input.history, now });

  return {
    cards,
    safe,
    payFromAccountId: payFromAccountId(input.accounts),
    checkIn,
    checkInDue: checkIn.filter((r) => r.daysSinceUpdate > 30),
    savings,
    catchUp,
    pacing,
    suggestedLimitCents,
    flexibleLimitCents: flexibleBudget?.monthlyLimitCents ?? null,
    categoryBudgets,
    entries,
    toSortCount,
    pendingCount,
    merchants,
    defaultAccountId,
    netWorthPoints,
    projection,
    extraMonthlySavingsCents,
    goalMarkers,
    accountRows,
    statementsDue: accountRows.filter((a) => a.checkDue),
    staleBalances,
    planByAccount,
  };
}

export type TrackingView = ReturnType<typeof deriveTracking>;
