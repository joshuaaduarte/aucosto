// "Where our money is": ready cash split into what's spoken for and what's
// truly free, each cash account with the pots it holds and how fresh its
// balance is, and long-term money kept apart (never counted as ready).
// Pure; tested in tests/finance-money-map.test.ts.

import { estimateBalance } from "./finance-anchor";

const DAY_MS = 24 * 60 * 60 * 1000;
const CASH_KINDS = new Set(["checking", "savings", "cash"]);
const LONG_TERM_KINDS = new Set(["investment", "retirement"]);

type AccountIn = {
  id: string;
  name: string;
  kind: string;
  currentBalanceCents: number;
  balanceUpdatedAt: Date;
  includeInCashPosition?: boolean;
};

type HistoryIn = Parameters<typeof estimateBalance>[1][number];

export type Freshness = "fresh" | "aging" | "stale";

export type SpokenForPart = {
  key: "cards" | "bills" | "budget" | "pots";
  label: string;
  cents: number;
  /** What makes it up, biggest first: "Visa · Nov 14". */
  items: Array<{ name: string; cents: number; note?: string }>;
};

export type MoneyMapAccount = {
  id: string;
  name: string;
  kind: string;
  cents: number;
  /** The typed balance moved by entries logged since. */
  estimated: boolean;
  daysOld: number;
  freshness: Freshness;
  /** Pots kept in this account. */
  pots: Array<{ name: string; cents: number }>;
};

export type MoneyMap = {
  readyCents: number;
  spokenFor: SpokenForPart[];
  spokenForCents: number;
  /** Ready minus spoken for; negative = short. */
  freeCents: number;
  cash: MoneyMapAccount[];
  longTerm: MoneyMapAccount[];
  longTermCents: number;
  windowDays: number;
  /** Oldest cash balance in days, for "update balances" nudges. */
  oldestCashDays: number | null;
};

export function freshnessOf(days: number): Freshness {
  if (days <= 7) return "fresh";
  if (days <= 30) return "aging";
  return "stale";
}

function daysOld(from: Date, now: Date): number {
  return Math.max(0, Math.floor((now.getTime() - from.getTime()) / DAY_MS));
}

function isCash(a: AccountIn): boolean {
  return CASH_KINDS.has(a.kind) && a.includeInCashPosition !== false;
}

/** Pots live in the first savings account, or checking until there is one. */
export function potHomeAccountId(accounts: AccountIn[]): string | null {
  const cash = accounts.filter(isCash);
  return cash.find((a) => a.kind === "savings")?.id ?? cash.find((a) => a.kind === "checking")?.id ?? null;
}

export function buildMoneyMap(input: {
  accounts: AccountIn[];
  history: HistoryIn[];
  /** Card statements (from cardBills), by card account id. */
  cards: Array<{ id: string; statementBalanceCents: number | null; waitingForStatement: boolean; dueDate?: Date | null }>;
  /** Bills due soon (from billsDueWithin), overdue included. */
  bills: Array<{ name: string; amountCents: number | null; daysUntil: number }>;
  /** What's left of this month's everyday spending money; null when no number is set. */
  budgetLeftCents: number | null;
  pots: Array<{ name: string; currentAmountCents: number; status?: string }>;
  now: Date;
  windowDays?: number;
}): MoneyMap {
  const windowDays = input.windowDays ?? 14;
  const { now } = input;
  const homeId = potHomeAccountId(input.accounts);
  const pots = input.pots
    .filter((p) => (p.status ?? "active") === "active" && p.currentAmountCents > 0)
    .map((p) => ({ name: p.name, cents: p.currentAmountCents }))
    .sort((a, b) => b.cents - a.cents);

  const row = (a: AccountIn): MoneyMapAccount => {
    const est = estimateBalance(a, input.history);
    const days = daysOld(a.balanceUpdatedAt, now);
    return {
      id: a.id,
      name: a.name,
      kind: a.kind,
      cents: est.entriesSince > 0 ? est.estimateCents : a.currentBalanceCents,
      estimated: est.entriesSince > 0,
      daysOld: days,
      freshness: freshnessOf(days),
      pots: a.id === homeId ? pots : [],
    };
  };

  const cash = input.accounts.filter(isCash).map(row).sort((a, b) => b.cents - a.cents);
  const longTerm = input.accounts
    .filter((a) => LONG_TERM_KINDS.has(a.kind))
    .map(row)
    .sort((a, b) => b.cents - a.cents);
  const readyCents = cash.reduce((sum, a) => sum + a.cents, 0);

  const short = (d: Date) => d.toLocaleDateString([], { month: "short", day: "numeric" });
  // Everything owed on a card is spoken for, not just the statement: new
  // charges since it closed leave checking with the next payment.
  const statements = new Map(input.cards.map((c) => [c.id, c]));
  const cardItems = input.accounts
    .filter((a) => a.kind === "credit_card")
    .map((a) => {
      const owedNow = Math.max(0, estimateBalance(a, input.history).estimateCents);
      const st = statements.get(a.id);
      const statementCents = st && !st.waitingForStatement ? Math.abs(st.statementBalanceCents ?? 0) : 0;
      const note = statementCents && st?.dueDate ? `${dollars(statementCents)} due ${short(st.dueDate)}` : undefined;
      return { name: a.name, cents: Math.max(owedNow, statementCents), note };
    })
    .filter((c) => c.cents > 0);
  const billItems = input.bills
    .filter((b) => b.amountCents != null && b.daysUntil <= windowDays)
    .map((b) => ({
      name: b.name,
      cents: Math.abs(b.amountCents ?? 0),
      note: b.daysUntil < 0 ? "overdue" : b.daysUntil === 0 ? "due today" : `in ${b.daysUntil} days`,
    }))
    .filter((b) => b.cents > 0);
  const budgetCents = Math.max(0, input.budgetLeftCents ?? 0);

  const byCents = (a: { cents: number }, b: { cents: number }) => b.cents - a.cents;
  const parts: SpokenForPart[] = [
    { key: "cards", label: "Owed on cards", cents: sum(cardItems), items: cardItems.sort(byCents) },
    { key: "bills", label: "Bills", cents: sum(billItems), items: billItems.sort(byCents) },
    {
      key: "budget",
      label: "Rest of this month's spending",
      cents: budgetCents,
      items: budgetCents ? [{ name: "Everyday spending money left", cents: budgetCents }] : [],
    },
    { key: "pots", label: "Set aside in pots", cents: sum(pots), items: pots },
  ];
  const spokenFor = parts.filter((p) => p.cents > 0);
  const spokenForCents = sum(spokenFor);

  return {
    readyCents,
    spokenFor,
    spokenForCents,
    freeCents: readyCents - spokenForCents,
    cash,
    longTerm,
    longTermCents: longTerm.reduce((s, a) => s + a.cents, 0),
    windowDays,
    oldestCashDays: cash.length ? Math.max(...cash.map((a) => a.daysOld)) : null,
  };
}

function dollars(cents: number): string {
  return `$${Math.round(cents / 100).toLocaleString("en-US")}`;
}

function sum(items: Array<{ cents: number }>): number {
  return items.reduce((s, i) => s + i.cents, 0);
}
