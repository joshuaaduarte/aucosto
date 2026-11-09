import { describe, expect, it } from "vitest";
import { buildMoneyMap, freshnessOf, potHomeAccountId } from "@/lib/finance-money-map";

const now = new Date(2026, 10, 9, 12);
const daysAgo = (n: number) => new Date(now.getTime() - n * 24 * 60 * 60 * 1000);

const accounts = [
  { id: "chk", name: "Checking", kind: "checking", currentBalanceCents: 400_000, balanceUpdatedAt: daysAgo(2) },
  { id: "sav", name: "Savings", kind: "savings", currentBalanceCents: 1_200_000, balanceUpdatedAt: daysAgo(12) },
  { id: "visa", name: "Visa", kind: "credit_card", currentBalanceCents: 90_000, balanceUpdatedAt: daysAgo(3) },
  { id: "k401", name: "401k", kind: "retirement", currentBalanceCents: 5_000_000, balanceUpdatedAt: daysAgo(40) },
  { id: "brk", name: "Brokerage", kind: "investment", currentBalanceCents: 800_000, balanceUpdatedAt: daysAgo(5) },
];

function base(overrides: Partial<Parameters<typeof buildMoneyMap>[0]> = {}) {
  return buildMoneyMap({
    accounts,
    history: [],
    cards: [{ id: "visa", statementBalanceCents: 60_000, waitingForStatement: false, dueDate: new Date(2026, 10, 14) }],
    bills: [
      { name: "Rent", amountCents: -250_000, daysUntil: 5 },
      { name: "Gym", amountCents: 5_000, daysUntil: 30 },
      { name: "Unknown", amountCents: null, daysUntil: 2 },
    ],
    budgetLeftCents: 45_000,
    pots: [
      { name: "Emergency", currentAmountCents: 600_000, status: "active" },
      { name: "Trip", currentAmountCents: 100_000, status: "active" },
      { name: "Old", currentAmountCents: 50_000, status: "done" },
    ],
    now,
    ...overrides,
  });
}

describe("buildMoneyMap", () => {
  it("splits ready cash into spoken for and truly free", () => {
    const m = base();
    expect(m.readyCents).toBe(1_600_000);
    expect(m.spokenFor.map((p) => [p.key, p.cents])).toEqual([
      ["cards", 90_000],
      ["bills", 250_000],
      ["budget", 45_000],
      ["pots", 700_000],
    ]);
    expect(m.spokenForCents).toBe(1_085_000);
    expect(m.freeCents).toBe(515_000);
  });

  it("keeps long-term money out of ready cash", () => {
    const m = base();
    expect(m.longTermCents).toBe(5_800_000);
    expect(m.longTerm.map((a) => a.id)).toEqual(["k401", "brk"]);
    expect(m.cash.map((a) => a.id)).toEqual(["sav", "chk"]);
  });

  it("puts pots in the savings account and reports freshness", () => {
    const m = base();
    const sav = m.cash.find((a) => a.id === "sav")!;
    expect(sav.pots.map((p) => p.name)).toEqual(["Emergency", "Trip"]);
    expect(sav.freshness).toBe("aging");
    expect(m.cash.find((a) => a.id === "chk")!.pots).toEqual([]);
    expect(m.oldestCashDays).toBe(12);
  });

  it("uses the about-now estimate when entries were logged since the balance", () => {
    const m = base({
      history: [
        { financeAccountId: "chk", amount: -10_000, date: daysAgo(1), createdAt: daysAgo(1) },
        { financeAccountId: "visa", amount: -20_000, date: daysAgo(1), createdAt: daysAgo(1) },
      ],
    });
    const chk = m.cash.find((a) => a.id === "chk")!;
    expect(chk.cents).toBe(390_000);
    expect(chk.estimated).toBe(true);
    // A new card charge raises what's owed past the statement.
    expect(m.spokenFor.find((p) => p.key === "cards")!.cents).toBe(110_000);
  });

  it("counts the statement when it is more than the typed card balance, and goes negative when short", () => {
    const m = base({
      accounts: accounts.map((a) => (a.id === "visa" ? { ...a, currentBalanceCents: 0 } : a.id === "sav" ? { ...a, currentBalanceCents: 0 } : a)),
    });
    const cards = m.spokenFor.find((p) => p.key === "cards")!;
    expect(cards.cents).toBe(60_000);
    expect(cards.items[0]!.note).toBe("$600 due Nov 14");
    expect(m.freeCents).toBeLessThan(0);
  });

  it("leaves out empty parts and accounts excluded from cash", () => {
    const m = base({
      accounts: [
        { id: "chk", name: "Checking", kind: "checking", currentBalanceCents: 100_000, balanceUpdatedAt: daysAgo(0) },
        { id: "old", name: "Old", kind: "savings", currentBalanceCents: 999_00, balanceUpdatedAt: daysAgo(0), includeInCashPosition: false },
      ],
      cards: [],
      bills: [],
      budgetLeftCents: null,
      pots: [],
    });
    expect(m.spokenFor).toEqual([]);
    expect(m.readyCents).toBe(100_000);
    expect(m.freeCents).toBe(100_000);
  });
});

describe("helpers", () => {
  it("freshness buckets", () => {
    expect(freshnessOf(0)).toBe("fresh");
    expect(freshnessOf(7)).toBe("fresh");
    expect(freshnessOf(8)).toBe("aging");
    expect(freshnessOf(31)).toBe("stale");
  });

  it("pots live in checking until there is a savings account", () => {
    expect(potHomeAccountId(accounts.filter((a) => a.id !== "sav"))).toBe("chk");
    expect(potHomeAccountId([])).toBeNull();
  });
});
