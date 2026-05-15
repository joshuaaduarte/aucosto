import { describe, expect, it } from "vitest";
import { parseCurrencyToCents, summarizeBalances } from "@/lib/finance-accounts";

describe("finance-accounts", () => {
  it("summarizes cash, cards owed, and net position", () => {
    const result = summarizeBalances([
      { kind: "checking", currentBalanceCents: 6062172 },
      { kind: "cash", currentBalanceCents: 5000 },
      { kind: "credit_card", currentBalanceCents: 94290 },
      { kind: "credit_card", currentBalanceCents: 34181 },
    ]);

    expect(result).toEqual({
      cashCents: 6067172,
      cardsOwedCents: 128471,
      netPositionCents: 5938701,
    });
  });

  it("parses currency strings into cents", () => {
    expect(parseCurrencyToCents("60,621.72")).toBe(6062172);
    expect(parseCurrencyToCents("-15.00")).toBe(-1500);
  });
});
