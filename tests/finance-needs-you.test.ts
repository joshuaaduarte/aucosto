import { describe, expect, it } from "vitest";
import { buildNeedsYou, type NeedsYouInput } from "@/app/app/finance/_lib/needs-you";

const base: NeedsYouInput = {
  toSortCount: 0,
  cards: [],
  payFromAccountId: "chk",
  safeShortCents: 0,
  statementsDue: [],
  bills: [],
  balancesToUpdate: 0,
  checkInDone: true,
  now: new Date(2026, 10, 3), // a Tuesday
};

describe("buildNeedsYou", () => {
  it("is empty when nothing needs doing", () => {
    expect(buildNeedsYou(base)).toEqual([]);
  });

  it("puts a short checking account and a card due soon first", () => {
    const items = buildNeedsYou({
      ...base,
      toSortCount: 4,
      safeShortCents: 5000,
      statementsDue: [{ id: "a", name: "Amex" }],
      cards: [
        { id: "c1", name: "Sapphire", statementBalanceCents: 98700, daysUntil: 2, waitingForStatement: false },
        { id: "c2", name: "Gold", statementBalanceCents: 41200, daysUntil: 9, waitingForStatement: false },
        { id: "c3", name: "Later", statementBalanceCents: 100, daysUntil: 20, waitingForStatement: false },
        { id: "c4", name: "Waiting", statementBalanceCents: 100, daysUntil: 1, waitingForStatement: true },
      ],
    });
    expect(items.map((i) => i.kind)).toEqual(["short", "card", "sort", "card", "statement"]);
    expect(items[1]).toMatchObject({ id: "c1", fromAccountId: "chk" });
  });

  it("skips autopay bills and far-off bills", () => {
    const items = buildNeedsYou({
      ...base,
      bills: [
        { id: "b1", name: "Rent", amountCents: 200000, daysUntil: 1, autopay: false },
        { id: "b2", name: "PG&E", amountCents: 9000, daysUntil: 2, autopay: true },
        { id: "b3", name: "Gym", amountCents: 5000, daysUntil: 12, autopay: false },
      ],
    });
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ kind: "bill", id: "b1" });
  });

  it("asks for the weekly check-in only Friday to Sunday", () => {
    expect(buildNeedsYou({ ...base, checkInDone: false })).toEqual([]);
    const sat = buildNeedsYou({ ...base, checkInDone: false, now: new Date(2026, 10, 7) });
    expect(sat.map((i) => i.kind)).toEqual(["checkin"]);
  });
});
