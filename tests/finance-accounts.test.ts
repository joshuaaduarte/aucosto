import { describe, expect, it } from "vitest";
import { defaultAccountInclusion, summarizeBalances } from "@/lib/finance-accounts";

describe("defaultAccountInclusion", () => {
  it("treats checking as cash but still part of net worth", () => {
    expect(defaultAccountInclusion("checking")).toEqual({
      includeInCashPosition: true,
      includeInNetWorth: true,
    });
  });

  it("keeps investments out of cash position by default", () => {
    expect(defaultAccountInclusion("investment")).toEqual({
      includeInCashPosition: false,
      includeInNetWorth: true,
    });
  });
});

describe("summarizeBalances", () => {
  it("respects cash and net worth inclusion flags", () => {
    const snapshot = summarizeBalances([
      { kind: "checking", currentBalanceCents: 125_00, includeInCashPosition: true, includeInNetWorth: true },
      { kind: "investment", currentBalanceCents: 500_00, includeInCashPosition: false, includeInNetWorth: true },
      { kind: "credit_card", currentBalanceCents: 75_00, includeInCashPosition: false, includeInNetWorth: true },
      { kind: "savings", currentBalanceCents: 400_00, includeInCashPosition: false, includeInNetWorth: false },
    ]);

    expect(snapshot.cashCents).toBe(125_00);
    expect(snapshot.investmentCents).toBe(500_00);
    expect(snapshot.cardsOwedCents).toBe(75_00);
    expect(snapshot.netWorthCents).toBe(550_00);
    expect(snapshot.cashAccountCount).toBe(1);
    expect(snapshot.netWorthAccountCount).toBe(3);
    expect(snapshot.debtAccountCount).toBe(1);
  });
});
