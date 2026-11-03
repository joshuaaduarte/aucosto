// Pure helpers for the finance routine: card bills against checking, the
// monthly balance check-in (savings / 401k / brokerage), savings rate, and
// when to offer "catch up". No DB. Tested in tests/finance-routine.test.ts.

import type {
  FinanceAccount,
  FinanceAccountPlan,
  FinanceTransaction,
} from "@/generated/prisma/client";
import { ENTRY_PENDING } from "@/lib/finance-entries";
import { isMoveEntry, movedInSince } from "@/lib/finance-moves";
import { summarizeCashflow } from "@/lib/finance-summary";

const DAY_MS = 24 * 60 * 60 * 1000;

/** Accounts you update by balance once a month instead of logging. */
export const CHECK_IN_KINDS = new Set(["savings", "investment", "retirement"]);

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function daysBetween(from: Date, to: Date): number {
  return Math.round((startOfDay(to).getTime() - startOfDay(from).getTime()) / DAY_MS);
}

/** Same day next month, clamped to the month's last day (Jan 31 → Feb 28). */
export function nextMonthSameDay(date: Date): Date {
  const y = date.getFullYear();
  const m = date.getMonth() + 1;
  const lastDay = new Date(y, m + 1, 0).getDate();
  return new Date(y, m, Math.min(date.getDate(), lastDay), date.getHours(), date.getMinutes());
}

// ── Card bills ───────────────────────────────────────────────────────────

type CardAccount = Pick<
  FinanceAccount,
  "id" | "name" | "kind" | "statementBalanceCents" | "dueDate" | "currentBalanceCents"
>;

export type CardBill = {
  id: string;
  name: string;
  /** Owed on the last statement (positive), or null until it's entered. */
  statementBalanceCents: number | null;
  dueDate: Date | null;
  daysUntil: number | null;
  /** Nothing to pay yet: no statement entered, or it was marked paid. */
  waitingForStatement: boolean;
};

export function cardBills(accounts: CardAccount[], now: Date): CardBill[] {
  return accounts
    .filter((a) => a.kind === "credit_card")
    .map((a) => {
      const owed = a.statementBalanceCents != null ? Math.abs(a.statementBalanceCents) : null;
      return {
        id: a.id,
        name: a.name,
        statementBalanceCents: owed,
        dueDate: a.dueDate,
        daysUntil: a.dueDate ? daysBetween(now, a.dueDate) : null,
        waitingForStatement: !owed || !a.dueDate,
      };
    })
    .sort((a, b) => {
      if (a.waitingForStatement !== b.waitingForStatement) return a.waitingForStatement ? 1 : -1;
      return (a.daysUntil ?? 999) - (b.daysUntil ?? 999);
    });
}

export type SafeInChecking = {
  checkingCents: number;
  cardsDueCents: number;
  billsDueCents: number;
  safeCents: number;
  windowDays: number;
};

/**
 * Checking minus the card statements and bills due in the next `windowDays`
 * (overdue ones included): what checking can spare. Checking starts from its
 * last entered balance plus anything logged against it since (a card payment
 * marked paid, a purchase), so paying a bill doesn't look like found money.
 * Null without a checking account.
 */
export function safeInChecking(input: {
  accounts: Array<Pick<FinanceAccount, "kind" | "currentBalanceCents"> & Partial<Pick<FinanceAccount, "id" | "balanceUpdatedAt">>>;
  history?: Array<Pick<FinanceTransaction, "financeAccountId" | "amount" | "createdAt" | "syncSource" | "postedStatus">>;
  cards: CardBill[];
  bills: Array<{ amountCents: number | null; daysUntil: number; autopay?: boolean }>;
  windowDays?: number;
}): SafeInChecking | null {
  const windowDays = input.windowDays ?? 14;
  const checking = input.accounts.filter((a) => a.kind === "checking");
  if (checking.length === 0) return null;
  let checkingCents = checking.reduce((sum, a) => sum + a.currentBalanceCents, 0);
  for (const a of checking) {
    if (!a.id || !a.balanceUpdatedAt) continue;
    for (const t of input.history ?? []) {
      if (
        t.financeAccountId === a.id &&
        t.syncSource === "manual" &&
        t.postedStatus === ENTRY_PENDING &&
        t.createdAt > a.balanceUpdatedAt
      ) {
        checkingCents += t.amount;
      }
    }
  }
  const cardsDueCents = input.cards
    .filter((c) => !c.waitingForStatement && c.daysUntil !== null && c.daysUntil <= windowDays)
    .reduce((sum, c) => sum + (c.statementBalanceCents ?? 0), 0);
  const billsDueCents = input.bills
    .filter((b) => b.amountCents != null && b.daysUntil <= windowDays)
    .reduce((sum, b) => sum + Math.abs(b.amountCents ?? 0), 0);
  return {
    checkingCents,
    cardsDueCents,
    billsDueCents,
    safeCents: checkingCents - cardsDueCents - billsDueCents,
    windowDays,
  };
}

/** The account card payments come out of: the first checking account. */
export function payFromAccountId(accounts: Array<Pick<FinanceAccount, "id" | "kind">>): string | null {
  return accounts.find((a) => a.kind === "checking")?.id ?? null;
}

// ── Monthly balance check-in ─────────────────────────────────────────────

type HistoryTx = Pick<
  FinanceTransaction,
  "externalId" | "raw" | "amount" | "date" | "financeAccountId" | "description"
>;

export type CheckInRow = {
  id: string;
  name: string;
  kind: string;
  balanceCents: number;
  updatedAt: Date;
  daysSinceUpdate: number;
  /** Money you put in since the last update (moves in + planned 401k pay). */
  addedSinceCents: number;
};

export function checkInRows(input: {
  accounts: Array<Pick<FinanceAccount, "id" | "name" | "kind" | "currentBalanceCents" | "balanceUpdatedAt">>;
  plans: Array<Pick<FinanceAccountPlan, "financeAccountId" | "monthlyContributionCents">>;
  history: HistoryTx[];
  now: Date;
  onlyCheckIn?: boolean;
}): CheckInRow[] {
  const planned = new Map(input.plans.map((p) => [p.financeAccountId, p.monthlyContributionCents]));
  return input.accounts
    .filter((a) => !input.onlyCheckIn || CHECK_IN_KINDS.has(a.kind))
    .map((a) => {
      const days = Math.max(0, daysBetween(a.balanceUpdatedAt, input.now));
      let added = 0;
      if (CHECK_IN_KINDS.has(a.kind)) {
        added += movedInSince(input.history, a.id, a.balanceUpdatedAt);
        // Payroll contributions (a 401k) never pass through checking, so
        // the planned monthly amount stands in for them.
        if (a.kind === "retirement") added += Math.floor(days / 30.4) * (planned.get(a.id) ?? 0);
      }
      return {
        id: a.id,
        name: a.name,
        kind: a.kind,
        balanceCents: a.currentBalanceCents,
        updatedAt: a.balanceUpdatedAt,
        daysSinceUpdate: days,
        addedSinceCents: added,
      };
    });
}

/** Split a balance change into what you added and what the market did. */
export function splitChange(oldCents: number, newCents: number, addedCents: number) {
  const changeCents = newCents - oldCents;
  return { changeCents, addedCents, marketCents: changeCents - addedCents };
}

// ── Savings rate ─────────────────────────────────────────────────────────

export type SavingsRate = {
  savedCents: number;
  incomeCents: number;
  /** 0–1, or null when no income is logged this month. */
  rate: number | null;
};

/**
 * This month: money moved into savings / brokerage / retirement, plus the
 * planned payroll 401k contribution, as a share of income (logged income
 * plus that payroll contribution, since it never reaches checking).
 */
export function savingsRate(input: {
  history: HistoryTx[];
  accounts: Array<Pick<FinanceAccount, "id" | "kind">>;
  plans: Array<Pick<FinanceAccountPlan, "financeAccountId" | "monthlyContributionCents">>;
  now: Date;
}): SavingsRate {
  const monthStart = new Date(input.now.getFullYear(), input.now.getMonth(), 1);
  const planned = new Map(input.plans.map((p) => [p.financeAccountId, p.monthlyContributionCents]));
  let moved = 0;
  let payroll = 0;
  for (const a of input.accounts) {
    if (!CHECK_IN_KINDS.has(a.kind)) continue;
    moved += movedInSince(input.history, a.id, monthStart);
    if (a.kind === "retirement") payroll += planned.get(a.id) ?? 0;
  }
  const month = input.history.filter(
    (t) => t.date >= monthStart && t.date <= input.now && !isMoveEntry(t),
  );
  const logged = summarizeCashflow(month).incomeCents;
  const savedCents = moved + payroll;
  const incomeCents = logged > 0 ? logged + payroll : 0;
  return { savedCents, incomeCents, rate: incomeCents > 0 ? savedCents / incomeCents : null };
}

// ── Catch up ─────────────────────────────────────────────────────────────

/**
 * Offer "catch up" when nothing has been touched for 30+ days: no balance
 * update and no hand-logged entry.
 */
export function needsCatchUp(input: {
  accounts: Array<Pick<FinanceAccount, "balanceUpdatedAt">>;
  history: Array<Pick<FinanceTransaction, "createdAt" | "syncSource">>;
  now: Date;
}): boolean {
  if (input.accounts.length === 0) return false;
  let last = 0;
  for (const a of input.accounts) last = Math.max(last, a.balanceUpdatedAt.getTime());
  for (const t of input.history) {
    if (t.syncSource === "manual") last = Math.max(last, t.createdAt.getTime());
  }
  return input.now.getTime() - last > 30 * DAY_MS;
}

/** Hand-logged entries still waiting for a statement, dated before `before`. */
export function countPendingBefore(
  history: Array<Pick<FinanceTransaction, "postedStatus" | "date">>,
  before: Date,
): number {
  return history.filter((t) => t.postedStatus === ENTRY_PENDING && t.date < before).length;
}
