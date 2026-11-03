import { describe, expect, it } from "vitest";
import {
  balanceEffect,
  cardMonth,
  checkRunningBalance,
  estimateBalance,
  isAfterAnchor,
  rebuiltBalancePoints,
  walkBackBalances,
} from "@/lib/finance-anchor";
import { netWorthHistory } from "@/lib/finance-networth";
import { parseTransactionsCsv } from "@/lib/csv";

const day = (s: string, time = "12:00:00") => new Date(`${s}T${time}`);

function tx(accountId: string, date: string, amount: number, createdAt?: Date) {
  return { financeAccountId: accountId, date: day(date), amount, createdAt: createdAt ?? day(date) };
}

// Caught up on Nov 3 at 9am.
const anchor = day("2026-11-03", "09:00:00");
const card = { id: "chase", kind: "credit_card", currentBalanceCents: 180000, balanceUpdatedAt: anchor };
const checking = { id: "checking", kind: "checking", currentBalanceCents: 500000, balanceUpdatedAt: anchor };

describe("which side of the start date", () => {
  it("puts earlier days before and later days after", () => {
    expect(isAfterAnchor({ date: day("2026-10-31"), createdAt: day("2026-11-03", "10:00:00") }, anchor)).toBe(false);
    expect(isAfterAnchor({ date: day("2026-11-04"), createdAt: day("2026-11-04") }, anchor)).toBe(true);
  });

  it("splits the start day by when the entry was typed", () => {
    expect(isAfterAnchor({ date: day("2026-11-03"), createdAt: day("2026-11-03", "08:00:00") }, anchor)).toBe(false);
    expect(isAfterAnchor({ date: day("2026-11-03"), createdAt: day("2026-11-03", "18:00:00") }, anchor)).toBe(true);
  });

  it("charges raise what a card owes, deposits raise checking", () => {
    expect(balanceEffect("credit_card", -500)).toBe(500);
    expect(balanceEffect("checking", -500)).toBe(-500);
  });
});

describe("about $X now", () => {
  it("adds what was logged after the typed balance, ignoring imported history", () => {
    const history = [
      tx("chase", "2026-10-15", -210000), // imported history: already in the balance
      tx("chase", "2026-11-05", -4500), // coffee + groceries after the start
      tx("chase", "2026-11-06", -1500),
      tx("checking", "2026-11-06", -2000),
    ];
    expect(estimateBalance(card, history)).toEqual({ estimateCents: 186000, changeCents: 6000, entriesSince: 2 });
    expect(estimateBalance(checking, history).estimateCents).toBe(498000);
  });

  it("a card payment lowers checking and what the card owes", () => {
    const history = [tx("checking", "2026-11-10", -80000), tx("chase", "2026-11-10", 80000)];
    expect(estimateBalance(checking, history).estimateCents).toBe(420000);
    expect(estimateBalance(card, history).estimateCents).toBe(100000);
  });
});

describe("rebuilding past balances", () => {
  // October on the card: $2,100 charged, $1,500 paid. September: $300 charged.
  const history = [
    tx("chase", "2026-09-20", -30000),
    tx("chase", "2026-10-05", -100000),
    tx("chase", "2026-10-12", 150000),
    tx("chase", "2026-10-28", -110000),
    tx("chase", "2026-11-05", -9999), // after the start: not used
  ];

  it("walks back from the typed balance month by month", () => {
    const points = walkBackBalances({
      account: card,
      anchor: { balanceCents: 180000, asOf: anchor },
      history,
    });
    expect(points.map((p) => [p.asOf.getMonth() + 1, p.asOf.getDate(), p.balanceCents])).toEqual([
      [9, 19, 90000], // opening, before the first September charge
      [9, 30, 120000], // end of September
      [10, 31, 180000], // end of October = the typed balance
    ]);
  });

  it("starts from each account's earliest known balance", () => {
    const later = { ...card, currentBalanceCents: 50000, balanceUpdatedAt: day("2026-12-01") };
    const points = rebuiltBalancePoints({
      accounts: [later],
      snapshots: [{ financeAccountId: "chase", balanceCents: 180000, asOf: anchor }],
      history,
    });
    expect(points.at(-1)?.balanceCents).toBe(180000);
    expect(points[0]?.balanceCents).toBe(90000);
  });

  it("returns nothing without history", () => {
    expect(walkBackBalances({ account: card, anchor: { balanceCents: 1, asOf: anchor }, history: [] })).toEqual([]);
  });

  it("feeds the net-worth line before the start date", () => {
    const points = netWorthHistory({
      accounts: [card, checking].map((a) => ({ ...a, includeInNetWorth: true })),
      snapshots: [],
      rebuilt: rebuiltBalancePoints({ accounts: [card], snapshots: [], history }),
      now: day("2026-11-10"),
      months: 3,
    });
    // Aug: nothing known. Sep end: card only (−$1,200). Oct end: card only. Today: both.
    expect(points.map((p) => p.totalCents)).toEqual([-120000, -180000, 500000 - 180000]);
  });
});

describe("card months", () => {
  it("sums one month's charges and payments", () => {
    const history = [tx("chase", "2026-10-05", -100000), tx("chase", "2026-10-12", 150000), tx("chase", "2026-11-01", -5)];
    expect(cardMonth(history, "chase", new Date(2026, 9, 1))).toEqual({ chargedCents: 100000, paidCents: 150000 });
  });
});

describe("does the file add up", () => {
  const csv = [
    "Details,Posting Date,Description,Amount,Type,Balance,Check or Slip #",
    "DEBIT,10/31/2026,GROCERY,-50.00,DEBIT_CARD,4980.00,",
    "DEBIT,10/31/2026,COFFEE,-20.00,DEBIT_CARD,5030.00,",
    "CREDIT,10/15/2026,PAYROLL,3000.00,ACH_CREDIT,5050.00,",
  ].join("\n");
  const rows = parseTransactionsCsv(csv).rows;

  it("reads the running balance column", () => {
    expect(rows.map((r) => r.runningBalanceCents)).toEqual([498000, 503000, 505000]);
  });

  it("matches when the typed balance walks back to the file's last day", () => {
    // $5,000 on Nov 3; a $20 refund on Nov 1, between the file and the start.
    const history = [tx("checking", "2026-11-01", 2000)];
    const check = checkRunningBalance({ rows, account: checking, history });
    expect(check?.diffCents).toBe(0);
    expect(check?.fileBalanceCents).toBe(498000);
  });

  it("reports the gap when a month is missing", () => {
    const check = checkRunningBalance({ rows, account: checking, history: [] });
    expect(check?.diffCents).toBe(-2000);
  });

  it("skips files without a balance column or past the start date", () => {
    expect(checkRunningBalance({ rows: rows.map((r) => ({ ...r, runningBalanceCents: null })), account: checking, history: [] })).toBeNull();
    const late = { ...checking, balanceUpdatedAt: day("2026-10-20") };
    expect(checkRunningBalance({ rows, account: late, history: [] })).toBeNull();
  });
});
