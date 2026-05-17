import { describe, expect, it } from "vitest";
import { parseTransactionsCsv } from "@/lib/csv";

describe("parseTransactionsCsv", () => {
  it("parses a basic Amount-column CSV into integer cents", () => {
    const csv = `Date,Description,Amount
2026-05-01,Grocery store,-45.32
2026-05-02,Paycheck,1500.00
2026-05-03,Coffee,-4.50
`;
    const r = parseTransactionsCsv(csv);
    expect(r.total).toBe(3);
    expect(r.skipped).toBe(0);
    expect(r.rows.map((row) => row.amount)).toEqual([-4532, 150000, -450]);
    expect(r.rows[0]!.description).toBe("Grocery store");
    expect(r.rows[0]!.date.toISOString().slice(0, 10)).toBe("2026-05-01");
  });

  it("derives amount from Debit/Credit columns when Amount is absent", () => {
    const csv = `Date,Description,Debit,Credit
2026-05-04,ATM withdrawal,40.00,
2026-05-05,Refund,,12.99
`;
    const r = parseTransactionsCsv(csv);
    expect(r.rows.map((row) => row.amount)).toEqual([-4000, 1299]);
  });

  it("handles parenthesized negatives and $/comma formatting", () => {
    const csv = `Date,Description,Amount
2026-05-06,Big purchase,"($1,234.56)"
2026-05-07,Pay,"$2,500.00"
`;
    const r = parseTransactionsCsv(csv);
    expect(r.rows.map((row) => row.amount)).toEqual([-123456, 250000]);
  });

  it("accepts MM/DD/YYYY and M/D/YY date formats", () => {
    const csv = `Date,Description,Amount
05/08/2026,A,-1.00
5/9/26,B,-2.00
`;
    const r = parseTransactionsCsv(csv);
    expect(r.rows.length).toBe(2);
    expect(r.rows[0]!.date.getFullYear()).toBe(2026);
    expect(r.rows[1]!.date.getFullYear()).toBe(2026);
  });

  it("matches headers case-insensitively", () => {
    const csv = `DATE,DESCRIPTION,AMOUNT
2026-05-10,Mixed case header,-9.99
`;
    const r = parseTransactionsCsv(csv);
    expect(r.rows.length).toBe(1);
    expect(r.rows[0]!.amount).toBe(-999);
  });

  it("skips rows missing required fields", () => {
    const csv = `Date,Description,Amount
2026-05-11,OK,-1.00
,no date,-2.00
2026-05-12,no amount,
not a date,bad row,-3.00
`;
    const r = parseTransactionsCsv(csv);
    expect(r.total).toBe(4);
    expect(r.rows.length).toBe(1);
    expect(r.skipped).toBe(3);
  });

  it("never emits a non-integer amount (cents invariant)", () => {
    const csv = `Date,Description,Amount
2026-05-13,Odd,0.105
2026-05-14,Pi-ish,3.14159
`;
    const r = parseTransactionsCsv(csv);
    for (const row of r.rows) {
      expect(Number.isInteger(row.amount)).toBe(true);
    }
  });
});
