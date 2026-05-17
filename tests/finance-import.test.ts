import { describe, expect, it } from "vitest";
import {
  dedupeParsedRows,
  fingerprintParsedRow,
} from "@/lib/finance-import";
import type { FinanceTransaction } from "@/generated/prisma/client";
import type { ParsedRow } from "@/lib/csv";

function parsedRow(overrides: Partial<ParsedRow> = {}): ParsedRow {
  return {
    date: new Date("2026-05-01T00:00:00.000Z"),
    amount: -1234,
    description: "Coffee shop",
    account: "Checking",
    raw: '{"Date":"2026-05-01"}',
    ...overrides,
  };
}

function tx(overrides: Partial<FinanceTransaction> = {}): FinanceTransaction {
  return {
    id: "tx-1",
    userId: "user-1",
    externalId: null,
    syncSource: "csv",
    financeAccountId: null,
    postedStatus: null,
    providerCategory: null,
    category: null,
    date: new Date("2026-05-01T10:15:00.000Z"),
    amount: -1234,
    currency: "USD",
    description: "coffee   shop",
    account: " checking ",
    raw: null,
    createdAt: new Date("2026-05-02T00:00:00.000Z"),
    updatedAt: new Date("2026-05-02T00:00:00.000Z"),
    ...overrides,
  };
}

describe("finance import dedupe", () => {
  it("treats same date/amount/description/account as a duplicate even if formatting differs", () => {
    const key = fingerprintParsedRow(parsedRow());
    const existingKey = fingerprintParsedRow(
      parsedRow({
        date: new Date("2026-05-01T23:59:59.000Z"),
        description: "  coffee shop  ",
        account: "checking",
      }),
    );
    expect(existingKey).toBe(key);
  });

  it("filters duplicates already in the database", () => {
    const result = dedupeParsedRows([parsedRow()], [tx()]);
    expect(result.rowsToImport).toEqual([]);
    expect(result.deduped).toBe(1);
  });

  it("filters duplicates repeated within the same CSV import", () => {
    const row = parsedRow();
    const result = dedupeParsedRows([row, { ...row }, parsedRow({ amount: -999 })], []);
    expect(result.rowsToImport).toHaveLength(2);
    expect(result.rowsToImport.map((r) => r.amount)).toEqual([-1234, -999]);
    expect(result.deduped).toBe(1);
  });
});
