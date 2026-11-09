import { describe, expect, it } from "vitest";
import {
  planImportMatches,
  readImportConfirmation,
  withImportConfirmation,
  withoutImportConfirmation,
} from "@/lib/finance-import-match";
import { groupImportBatches } from "@/lib/finance-import-batches";
import { encodeEntryMeta, readEntryMeta } from "@/lib/finance-entries";

const d = (s: string) => new Date(`${s}T12:00:00`);

describe("planImportMatches", () => {
  const entries = [
    { id: "tj", date: d("2026-11-02"), amount: -4512, description: "Trader Joe's" },
    { id: "dinner", date: d("2026-11-04"), amount: -4000, description: "Sushi Ota" },
    { id: "old", date: d("2026-10-01"), amount: -999, description: "Spotify" },
  ];

  it("confirms an entry with the same amount a couple of days later, despite the bank's name", () => {
    const plan = planImportMatches(
      [
        { date: d("2026-11-04"), amount: -4512, description: "TRADER JOE'S #552 SAN DIEGO CA" },
        { date: d("2026-11-05"), amount: -1250, description: "SHELL OIL 1234" },
      ],
      entries,
    );
    expect(plan.confirms).toEqual([{ rowIndex: 0, entryId: "tj", exact: true }]);
    expect(plan.newRows).toEqual([1]);
  });

  it("takes a similar shop with a different amount (a tip) as a match, not exact", () => {
    const plan = planImportMatches(
      [{ date: d("2026-11-05"), amount: -4800, description: "SUSHI OTA LA JOLLA" }],
      entries,
    );
    expect(plan.confirms).toEqual([{ rowIndex: 0, entryId: "dinner", exact: false }]);
    expect(plan.newRows).toEqual([]);
  });

  it("leaves entries outside the date window alone", () => {
    const plan = planImportMatches([{ date: d("2026-11-01"), amount: -999, description: "SPOTIFY" }], entries);
    expect(plan.confirms).toEqual([]);
    expect(plan.newRows).toEqual([0]);
  });

  it("pairs each row with at most one entry", () => {
    const plan = planImportMatches(
      [
        { date: d("2026-11-02"), amount: -4512, description: "TRADER JOE'S" },
        { date: d("2026-11-03"), amount: -4512, description: "TRADER JOE'S" },
      ],
      entries,
    );
    expect(plan.confirms).toHaveLength(1);
    expect(plan.newRows).toEqual([1]);
  });
});

describe("import confirmation metadata", () => {
  const c = {
    at: "2026-11-09T16:00:00.000Z",
    ext: "csv:abc",
    bank: "TRADER JOE'S #552",
    was: { amount: -4500, postedStatus: "pending", financeAccountId: null },
  };

  it("keeps who logged it and the pot, and round-trips", () => {
    const raw = withImportConfirmation(encodeEntryMeta({ by: "ana", via: "quick_add", pot: "p1" }), c);
    expect(readImportConfirmation(raw)).toEqual(c);
    expect(readEntryMeta(raw)).toMatchObject({ by: "ana", via: "quick_add", pot: "p1" });
    const back = withoutImportConfirmation(raw);
    expect(readImportConfirmation(back)).toBeNull();
    expect(readEntryMeta(back)).toMatchObject({ by: "ana", pot: "p1" });
  });

  it("ignores raw that isn't app metadata", () => {
    expect(readImportConfirmation("2026-11-02,TRADER JOE'S,-45.12")).toBeNull();
    expect(readImportConfirmation(null)).toBeNull();
  });
});

describe("groupImportBatches with confirmed entries", () => {
  it("counts confirmed entries in the same import without counting their spending", () => {
    const at = new Date("2026-11-09T16:00:00.000Z");
    const [batch] = groupImportBatches([
      { createdAt: at, date: d("2026-11-04"), amount: -1250, description: "SHELL", account: "Sapphire" },
      { createdAt: at, date: d("2026-11-02"), amount: -4512, description: "Trader Joe's", account: "Sapphire", confirmed: true },
    ]);
    expect(batch).toMatchObject({ count: 1, confirmed: 1, spentCents: 1250 });
    expect(batch!.firstDate).toEqual(d("2026-11-02"));
  });
});
