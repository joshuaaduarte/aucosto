import { describe, expect, it } from "vitest";
import { deriveTracking } from "@/app/app/finance/_lib/derive-tracking";
import { encodeEntryMeta, readEntryMeta } from "@/lib/finance-entries";
import {
  isMoveEntry,
  moveDescriptions,
  moveExternalId,
  movedInSince,
  pairedExternalId,
} from "@/lib/finance-moves";
import {
  cardBills,
  checkInRows,
  countPendingBefore,
  needsCatchUp,
  nextMonthSameDay,
  payFromAccountId,
  safeInChecking,
  savingsRate,
  splitChange,
} from "@/lib/finance-routine";
import { classifyTransaction, isTrueExpenseTransaction } from "@/lib/finance-types";
import { summarizeCashflow } from "@/lib/finance-summary";
import type { FinanceAccount, FinanceTransaction } from "@/generated/prisma/client";

const d = (s: string) => new Date(`${s}T12:00:00`);
const now = d("2026-11-10");

function account(id: string, kind: string, balance: number, extra: Partial<FinanceAccount> = {}): FinanceAccount {
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
    balanceUpdatedAt: d("2026-11-01"),
    statementBalanceCents: null,
    dueDate: null,
    creditLimitCents: null,
    createdAt: d("2026-01-01"),
    updatedAt: d("2026-01-01"),
    ...extra,
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
    category: null,
    raw: null,
    createdAt: d(date),
    updatedAt: d(date),
    ...extra,
  };
}

function move(pair: string, date: string, cents: number, from: FinanceAccount, to: FinanceAccount) {
  const text = moveDescriptions(from, to);
  return [
    tx(`${pair}-out`, date, -cents, {
      financeAccountId: from.id,
      externalId: moveExternalId(pair, "out"),
      description: text.out,
      postedStatus: "pending",
      raw: encodeEntryMeta({ via: "move", pair, side: "out", by: "josh" }),
    }),
    tx(`${pair}-in`, date, cents, {
      financeAccountId: to.id,
      externalId: moveExternalId(pair, "in"),
      description: text.in,
      postedStatus: "pending",
      raw: encodeEntryMeta({ via: "move", pair, side: "in", by: "josh" }),
    }),
  ];
}

const checking = account("Checking", "checking", 500000);
const chase = account("Chase", "credit_card", 120000, { statementBalanceCents: 80000, dueDate: d("2026-11-15") });
const amex = account("Amex", "credit_card", 30000, { statementBalanceCents: 25000, dueDate: d("2026-12-02") });
const apple = account("Apple Card", "credit_card", 5000);
const robinhood = account("Robinhood", "investment", 1000000, { balanceUpdatedAt: d("2026-10-01") });
const k401 = account("401k", "retirement", 5000000, { balanceUpdatedAt: d("2026-09-01") });
const savingsAcct = account("Savings", "savings", 2000000);

describe("moves", () => {
  it("files both sides as transfers, never spending or income", () => {
    const [out, incoming] = move("p1", "2026-11-05", 50000, checking, robinhood);
    expect(classifyTransaction(out!)).toBe("transfer");
    expect(classifyTransaction(incoming!)).toBe("transfer");
    expect(isTrueExpenseTransaction(out!)).toBe(false);
    expect(summarizeCashflow([out!, incoming!])).toEqual({ spentCents: 0, incomeCents: 0, netCents: 0 });
  });

  it("labels card payments and still treats them as transfers", () => {
    const [out, incoming] = move("p2", "2026-11-05", 80000, checking, chase);
    expect(out!.description).toBe("Transfer to Chase (card payment)");
    expect(classifyTransaction(incoming!)).toBe("transfer");
  });

  it("pairs external ids and reads move metadata", () => {
    expect(pairedExternalId("move:abc:out")).toBe("move:abc:in");
    expect(pairedExternalId("move:abc:in")).toBe("move:abc:out");
    expect(pairedExternalId("manual:abc")).toBeNull();
    expect(readEntryMeta(encodeEntryMeta({ via: "move", pair: "x", side: "in" }))).toEqual({
      via: "move",
      pair: "x",
      side: "in",
    });
    expect(isMoveEntry({ externalId: "move:x:out", raw: null })).toBe(true);
    expect(isMoveEntry({ externalId: "manual:x", raw: null })).toBe(false);
  });

  it("sums money moved into an account since a date", () => {
    const history = [
      ...move("a", "2026-10-05", 20000, checking, robinhood),
      ...move("b", "2026-11-03", 30000, checking, robinhood),
      tx("dividend", "2026-11-04", 999, { financeAccountId: "Robinhood" }),
    ];
    expect(movedInSince(history, "Robinhood", d("2026-10-01"))).toBe(50000);
    expect(movedInSince(history, "Robinhood", d("2026-11-01"))).toBe(30000);
    expect(movedInSince(history, "Checking", d("2026-10-01"))).toBe(0);
  });
});

describe("card bills", () => {
  const cards = cardBills([checking, amex, chase, apple], now);

  it("lists cards with a statement first, soonest due first", () => {
    expect(cards.map((c) => c.name)).toEqual(["Chase", "Amex", "Apple Card"]);
    expect(cards[0]).toMatchObject({ statementBalanceCents: 80000, daysUntil: 5, waitingForStatement: false });
    expect(cards[2]!.waitingForStatement).toBe(true);
  });

  it("works out what checking can spare after bills due in two weeks", () => {
    const safe = safeInChecking({
      accounts: [checking, chase, amex],
      cards,
      bills: [
        { amountCents: 250000, daysUntil: 3 },
        { amountCents: 9999, daysUntil: 20 },
        { amountCents: null, daysUntil: 1 },
      ],
    });
    // Chase (due in 5) counts, Amex (due in 22) doesn't; rent counts.
    expect(safe).toEqual({
      checkingCents: 500000,
      cardsDueCents: 80000,
      billsDueCents: 250000,
      setAsideCents: 0,
      safeCents: 170000,
      windowDays: 14,
    });
    expect(safeInChecking({ accounts: [chase], cards, bills: [] })).toBeNull();
  });

  it("keeps pot money held in checking out of what's safe to spend", () => {
    const safe = safeInChecking({ accounts: [checking], cards: [], bills: [], setAsideCents: 120000 });
    expect(safe).toMatchObject({ checkingCents: 500000, setAsideCents: 120000, safeCents: 380000 });
  });

  it("counts what was logged against checking since its balance was entered", () => {
    const paid = move("pay", "2026-11-09", 80000, checking, chase).map((t) => ({ ...t, createdAt: d("2026-11-09") }));
    const old = tx("old", "2026-10-20", -999, { financeAccountId: "Checking", postedStatus: "pending", createdAt: d("2026-10-20") });
    const safe = safeInChecking({ accounts: [checking], history: [...paid, old], cards: [], bills: [] });
    expect(safe?.checkingCents).toBe(500000 - 80000);
  });

  it("pays from the first checking account", () => {
    expect(payFromAccountId([chase, checking])).toBe("Checking");
    expect(payFromAccountId([chase])).toBeNull();
  });

  it("rolls the due date to the same day next month", () => {
    expect(nextMonthSameDay(d("2026-11-15")).getDate()).toBe(15);
    expect(nextMonthSameDay(d("2026-11-15")).getMonth()).toBe(11);
    const jan31 = nextMonthSameDay(d("2027-01-31"));
    expect([jan31.getMonth(), jan31.getDate()]).toEqual([1, 28]);
    const dec = nextMonthSameDay(d("2026-12-20"));
    expect([dec.getFullYear(), dec.getMonth()]).toEqual([2027, 0]);
  });
});

describe("monthly check-in and savings rate", () => {
  const history = [
    ...move("r", "2026-11-03", 30000, checking, robinhood),
    ...move("s", "2026-11-04", 50000, checking, savingsAcct),
    tx("Payroll", "2026-11-01", 600000, { category: "Income" }),
    tx("Groceries", "2026-11-02", -12000, { category: "Groceries" }),
  ];
  const plans = [{ financeAccountId: "401k", monthlyContributionCents: 100000 }];

  it("shows only savings and investment accounts with what you put in", () => {
    const rows = checkInRows({
      accounts: [checking, robinhood, k401, savingsAcct],
      plans,
      history,
      now,
      onlyCheckIn: true,
    });
    expect(rows.map((r) => r.name)).toEqual(["Robinhood", "401k", "Savings"]);
    expect(rows[0]!.addedSinceCents).toBe(30000);
    // 401k: 70 days since the last update → 2 planned payroll contributions.
    expect(rows[1]!.addedSinceCents).toBe(200000);
    expect(rows[1]!.daysSinceUpdate).toBe(70);
  });

  it("splits a change into what you added and growth", () => {
    expect(splitChange(1000000, 1050000, 30000)).toEqual({
      changeCents: 50000,
      addedCents: 30000,
      marketCents: 20000,
    });
  });

  it("counts moves into savings/investing plus payroll 401k as saved", () => {
    const rate = savingsRate({ history, accounts: [checking, robinhood, k401, savingsAcct], plans, now });
    expect(rate.savedCents).toBe(30000 + 50000 + 100000);
    expect(rate.incomeCents).toBe(600000 + 100000);
    expect(rate.rate).toBeCloseTo(180000 / 700000);
    expect(savingsRate({ history: [], accounts: [k401], plans, now }).rate).toBeNull();
  });
});

describe("catch up", () => {
  it("offers to catch up after 30 quiet days", () => {
    const old = account("Checking", "checking", 1, { balanceUpdatedAt: d("2026-08-01") });
    expect(needsCatchUp({ accounts: [old], history: [], now })).toBe(true);
    expect(
      needsCatchUp({
        accounts: [old],
        history: [{ createdAt: d("2026-11-01"), syncSource: "manual" }],
        now,
      }),
    ).toBe(false);
    expect(needsCatchUp({ accounts: [], history: [], now })).toBe(false);
    expect(needsCatchUp({ accounts: [checking], history: [], now })).toBe(false);
  });

  it("counts waiting entries before the fresh-start date", () => {
    const history = [
      tx("a", "2026-09-01", -100, { postedStatus: "pending" }),
      tx("b", "2026-11-02", -100, { postedStatus: "pending" }),
      tx("c", "2026-09-01", -100, { postedStatus: "reconciled" }),
    ];
    expect(countPendingBefore(history, d("2026-11-01"))).toBe(1);
  });
});

describe("deriveTracking with moves and cards", () => {
  const history = [
    ...move("pay", "2026-11-06", 80000, checking, chase),
    tx("Coffee", "2026-11-06", -500, { financeAccountId: "Chase", category: null, raw: encodeEntryMeta({ by: "josh" }) }),
  ];
  const view = deriveTracking({
    accounts: [checking, chase, robinhood],
    history,
    budgets: [],
    bills: [],
    goals: [],
    snapshots: [],
    plans: [],
    checks: [],
    names: {},
    viewerUserId: "josh",
    now,
  });

  it("shows a move once, from → to, and keeps it out of To sort", () => {
    const moves = view.entries.filter((e) => e.move);
    expect(moves).toHaveLength(1);
    expect(moves[0]).toMatchObject({ accountName: "Checking", move: { toId: "Chase", toName: "Chase" } });
    expect(view.toSortCount).toBe(1);
  });

  it("keeps moves out of merchant suggestions and spending pace", () => {
    expect(view.merchants.map((m) => m.description)).toEqual(["Coffee"]);
    expect(view.pacing.month.spentCents).toBe(500);
  });

  it("exposes card bills, safe-in-checking and pay-from", () => {
    expect(view.cards.map((c) => c.name)).toEqual(["Chase"]);
    // Statement already paid (logged after the balance): not counted twice.
    expect(view.safe?.checkingCents).toBe(500000 - 80000);
    expect(view.payFromAccountId).toBe("Checking");
    expect(view.checkIn.map((r) => r.name)).toEqual(["Robinhood"]);
    expect(view.checkInDue.map((r) => r.name)).toEqual(["Robinhood"]);
  });
});
