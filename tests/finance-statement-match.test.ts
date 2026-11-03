import { describe, expect, it } from "vitest";
import { checkStatementBalance, matchStatement, nameSimilarity } from "@/lib/finance-statement-match";

const d = (s: string) => new Date(`${s}T12:00:00`);

describe("matchStatement", () => {
  it("pairs same-amount lines with the closest logged day", () => {
    const lines = [
      { key: "l1", date: d("2026-10-02"), amount: -500, description: "STARBUCKS #123" },
      { key: "l2", date: d("2026-10-06"), amount: -500, description: "STARBUCKS #123" },
    ];
    const entries = [
      { id: "e2", date: d("2026-10-05"), amount: -500, description: "Starbucks" },
      { id: "e1", date: d("2026-10-01"), amount: -500, description: "Starbucks" },
    ];
    const m = matchStatement(lines, entries);
    expect(m.matched).toEqual([
      { lineKey: "l1", entryId: "e1" },
      { lineKey: "l2", entryId: "e2" },
    ]);
    expect(m.statementOnly).toEqual([]);
    expect(m.entriesOnly).toEqual([]);
  });

  it("flags a tip as a near miss, and leaves the rest separate", () => {
    const lines = [
      { key: "tip", date: d("2026-10-03"), amount: -2400, description: "SQ *TACO SPOT" },
      { key: "new", date: d("2026-10-04"), amount: -1999, description: "NETFLIX.COM" },
    ];
    const entries = [
      { id: "taco", date: d("2026-10-03"), amount: -2000, description: "Taco Spot" },
      { id: "typo", date: d("2026-10-20"), amount: -800, description: "Parking" },
    ];
    const m = matchStatement(lines, entries);
    expect(m.matched).toEqual([]);
    expect(m.nearMisses).toEqual([{ lineKey: "tip", entryId: "taco" }]);
    expect(m.statementOnly).toEqual(["new"]);
    expect(m.entriesOnly).toEqual(["typo"]);
  });

  it("does not match outside the date window", () => {
    const m = matchStatement(
      [{ key: "l", date: d("2026-10-20"), amount: -500, description: "Coffee" }],
      [{ id: "e", date: d("2026-10-01"), amount: -500, description: "Coffee" }],
    );
    expect(m.matched).toEqual([]);
    expect(m.statementOnly).toEqual(["l"]);
  });

  it("scores names by shared words", () => {
    expect(nameSimilarity("Trader Joe's", "TRADER JOE S #552")).toBeGreaterThanOrEqual(0.5);
    expect(nameSimilarity("Target", "Safeway")).toBe(0);
  });
});

describe("checkStatementBalance", () => {
  it("adds up an asset account", () => {
    const r = checkStatementBalance({ kind: "checking", openingCents: 100000, closingCents: 90000, entryAmounts: [-15000, 5000] });
    expect(r.differenceCents).toBe(0);
  });
  it("treats card balances as owed", () => {
    const r = checkStatementBalance({ kind: "credit_card", openingCents: 20000, closingCents: 26000, entryAmounts: [-5000] });
    expect(r.expectedClosingCents).toBe(25000);
    expect(r.differenceCents).toBe(1000);
    expect(r.adjustmentAmountCents).toBe(-1000);
  });
  it("gives an adjustment that closes the gap on cash", () => {
    const r = checkStatementBalance({ kind: "checking", openingCents: 0, closingCents: -300, entryAmounts: [] });
    expect(r.adjustmentAmountCents).toBe(-300);
  });
});
