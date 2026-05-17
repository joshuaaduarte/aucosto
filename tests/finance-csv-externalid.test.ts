import { describe, expect, it } from "vitest";
import { csvRowExternalId } from "@/lib/finance-import";
import type { ParsedRow } from "@/lib/csv";

function row(overrides: Partial<ParsedRow> = {}): ParsedRow {
  return {
    date: new Date("2026-05-01T00:00:00.000Z"),
    amount: -1234,
    description: "Coffee shop",
    account: "Checking",
    raw: "{}",
    ...overrides,
  };
}

describe("csvRowExternalId", () => {
  it("is deterministic for the same row", () => {
    expect(csvRowExternalId(row())).toBe(csvRowExternalId(row()));
  });

  it("ignores whitespace and case differences", () => {
    const a = csvRowExternalId(row());
    const b = csvRowExternalId(
      row({
        description: "  coffee shop  ",
        account: "checking",
        date: new Date("2026-05-01T23:59:59.000Z"),
      }),
    );
    expect(a).toBe(b);
  });

  it("differs when amount changes", () => {
    expect(csvRowExternalId(row())).not.toBe(csvRowExternalId(row({ amount: -1235 })));
  });

  it("differs when date changes by a day", () => {
    expect(csvRowExternalId(row())).not.toBe(
      csvRowExternalId(row({ date: new Date("2026-05-02T00:00:00.000Z") })),
    );
  });

  it("uses the csv: prefix so it cannot collide with provider IDs", () => {
    expect(csvRowExternalId(row())).toMatch(/^csv:[0-9a-f]+$/);
  });
});
