// Net worth over time and projected forward. No DB; tested in
// tests/finance-networth.test.ts.
//
// History comes from FinanceBalanceSnapshot rows: every balance update and
// every finished statement check records one, so each month-end can be
// rebuilt from "the latest known balance of each account on that day".
// Balances are in the account's own terms (what you have, or what you owe
// for cards/loans); this file turns them into signed net worth.

import { isLiabilityKind } from "@/lib/finance-statement-match";

export type NetWorthGroup = "cash" | "investments" | "retirement" | "property" | "debt";

export const NET_WORTH_GROUPS: NetWorthGroup[] = ["cash", "investments", "retirement", "property", "debt"];

export function netWorthGroup(kind: string): NetWorthGroup {
  if (isLiabilityKind(kind)) return "debt";
  if (kind === "investment") return "investments";
  if (kind === "retirement") return "retirement";
  if (kind === "property") return "property";
  return "cash";
}

export function formatNetWorthGroup(group: NetWorthGroup): string {
  switch (group) {
    case "investments":
      return "Investments";
    case "retirement":
      return "Retirement";
    case "property":
      return "Home & car";
    case "debt":
      return "Debt";
    default:
      return "Cash";
  }
}

/** Contribution to net worth: assets positive, what you owe negative. */
export function signedBalance(kind: string, balanceCents: number): number {
  return isLiabilityKind(kind) ? -Math.max(0, balanceCents) : balanceCents;
}

export type NetWorthAccount = {
  id: string;
  kind: string;
  includeInNetWorth: boolean;
  currentBalanceCents: number;
  balanceUpdatedAt: Date;
};

export type BalancePoint = {
  financeAccountId: string;
  balanceCents: number;
  asOf: Date;
};

export type NetWorthPoint = {
  at: Date;
  totalCents: number;
  byGroup: Record<NetWorthGroup, number>;
};

function emptyGroups(): Record<NetWorthGroup, number> {
  return { cash: 0, investments: 0, retirement: 0, property: 0, debt: 0 };
}

/** Net worth on a given day from the latest known balance of each account. */
export function netWorthAt(
  accounts: NetWorthAccount[],
  pointsByAccount: Map<string, BalancePoint[]>,
  at: Date,
): NetWorthPoint | null {
  const byGroup = emptyGroups();
  let any = false;
  for (const account of accounts) {
    if (!account.includeInNetWorth) continue;
    const points = pointsByAccount.get(account.id) ?? [];
    let latest: BalancePoint | null = null;
    for (const p of points) {
      if (p.asOf > at) continue;
      if (!latest || p.asOf > latest.asOf) latest = p;
    }
    if (!latest) continue;
    any = true;
    byGroup[netWorthGroup(account.kind)] += signedBalance(account.kind, latest.balanceCents);
  }
  if (!any) return null;
  const totalCents = Object.values(byGroup).reduce((a, b) => a + b, 0);
  return { at, totalCents, byGroup };
}

/**
 * Month-end net worth for the last `months` months, then today. The current
 * balance on each account counts as a snapshot at its balanceUpdatedAt, so
 * history works even before the first snapshot row exists.
 */
export function netWorthHistory(input: {
  accounts: NetWorthAccount[];
  snapshots: BalancePoint[];
  /** Past balances rebuilt from imported history (finance-anchor.ts). */
  rebuilt?: BalancePoint[];
  now: Date;
  months?: number;
}): NetWorthPoint[] {
  const months = input.months ?? 12;
  const pointsByAccount = new Map<string, BalancePoint[]>();
  for (const s of [...(input.rebuilt ?? []), ...input.snapshots]) {
    const list = pointsByAccount.get(s.financeAccountId) ?? [];
    list.push(s);
    pointsByAccount.set(s.financeAccountId, list);
  }
  for (const a of input.accounts) {
    const list = pointsByAccount.get(a.id) ?? [];
    list.push({ financeAccountId: a.id, balanceCents: a.currentBalanceCents, asOf: a.balanceUpdatedAt });
    pointsByAccount.set(a.id, list);
  }

  const out: NetWorthPoint[] = [];
  for (let back = months; back >= 1; back--) {
    // Last moment of the month `back` months ago.
    const end = new Date(input.now.getFullYear(), input.now.getMonth() - back + 1, 1);
    const point = netWorthAt(input.accounts, pointsByAccount, new Date(end.getTime() - 1));
    if (point) out.push(point);
  }
  const today = netWorthAt(input.accounts, pointsByAccount, input.now);
  if (today) out.push(today);
  return out;
}

/** What moved net worth between two points, biggest change first. */
export function netWorthDrivers(
  from: NetWorthPoint,
  to: NetWorthPoint,
): Array<{ group: NetWorthGroup; deltaCents: number }> {
  return NET_WORTH_GROUPS.map((group) => ({
    group,
    deltaCents: to.byGroup[group] - from.byGroup[group],
  }))
    .filter((d) => d.deltaCents !== 0)
    .sort((a, b) => Math.abs(b.deltaCents) - Math.abs(a.deltaCents));
}

// ── Projection ───────────────────────────────────────────────────────────

export type AccountPlan = {
  /** Added each month (assets) or paid each month (debts). */
  monthlyContributionCents: number;
  /** Yearly growth (assets) or interest rate (debts), basis points: 600 = 6%. */
  annualGrowthBps: number;
};

export function monthlyRate(annualGrowthBps: number): number {
  return Math.pow(1 + annualGrowthBps / 10000, 1 / 12) - 1;
}

export type ProjectionPoint = { monthIndex: number; at: Date; totalCents: number };

/**
 * Month-by-month net worth from today. Assets grow and receive their monthly
 * contribution; debts accrue interest and shrink by their payment, never
 * below zero. `extraMonthlySavingsCents` is savings not tied to any account
 * (it piles up as cash, no growth).
 */
export function projectNetWorth(input: {
  accounts: Array<NetWorthAccount & { plan?: AccountPlan | null }>;
  extraMonthlySavingsCents: number;
  now: Date;
  months?: number;
}): ProjectionPoint[] {
  const months = input.months ?? 120;
  const live = input.accounts
    .filter((a) => a.includeInNetWorth)
    .map((a) => ({
      liability: isLiabilityKind(a.kind),
      balance: isLiabilityKind(a.kind) ? Math.max(0, a.currentBalanceCents) : a.currentBalanceCents,
      rate: monthlyRate(a.plan?.annualGrowthBps ?? 0),
      contribution: a.plan?.monthlyContributionCents ?? 0,
    }));
  let extra = 0;
  const total = () =>
    Math.round(live.reduce((sum, a) => sum + (a.liability ? -a.balance : a.balance), 0) + extra);

  const out: ProjectionPoint[] = [{ monthIndex: 0, at: input.now, totalCents: total() }];
  for (let m = 1; m <= months; m++) {
    for (const a of live) {
      if (a.liability) a.balance = Math.max(0, a.balance * (1 + a.rate) - a.contribution);
      else a.balance = a.balance * (1 + a.rate) + a.contribution;
    }
    extra += input.extraMonthlySavingsCents;
    out.push({
      monthIndex: m,
      at: new Date(input.now.getFullYear(), input.now.getMonth() + m, 1),
      totalCents: total(),
    });
  }
  return out;
}

/**
 * Average monthly savings (income minus spending) over the last three full
 * months, floored at zero. Used when no account has a contribution set, so
 * the projection isn't flat by default.
 */
export function recentMonthlySavingsCents(
  netByMonth: number[],
): number {
  if (netByMonth.length === 0) return 0;
  const avg = netByMonth.reduce((a, b) => a + b, 0) / netByMonth.length;
  return Math.max(0, Math.round(avg));
}

/** When a goal is reached at its own monthly pace; null if it isn't moving. */
export function goalReachDate(
  goal: { targetAmountCents: number; currentAmountCents: number; monthlyContributionCents: number | null },
  now: Date,
): Date | null {
  const remaining = goal.targetAmountCents - goal.currentAmountCents;
  if (remaining <= 0) return now;
  const monthly = goal.monthlyContributionCents ?? 0;
  if (monthly <= 0) return null;
  const monthsNeeded = Math.ceil(remaining / monthly);
  if (monthsNeeded > 600) return null;
  return new Date(now.getFullYear(), now.getMonth() + monthsNeeded, 1);
}
