import { describe, expect, it } from "vitest";
import { parseStatementPdf } from "@/lib/statement-import";

function statementPdf(text: string): Uint8Array {
  const escaped = text
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)")
    .replace(/\n/g, ") Tj (");
  return Buffer.from(`%PDF-1.4\n1 0 obj\n<< /Length ${escaped.length + 10} >>\nstream\nBT (${escaped}) Tj ET\nendstream\nendobj\n%%EOF`, "latin1");
}

describe("parseStatementPdf", () => {
  it("detects and parses a Chase-style statement", () => {
    const preview = parseStatementPdf({
      fileName: "chase.pdf",
      bytes: statementPdf([
        "CHASE CREDIT CARD",
        "Opening/Closing Date 04/01/2026 - 04/30/2026",
        "Account ending in 1234",
        "04/15 COFFEE SHOP -$5.45",
        "04/16 PAYMENT RECEIVED 1500.00 CR",
      ].join("\n")),
      mimeType: "application/pdf",
    });

    expect(preview.bank).toBe("chase");
    expect(preview.rows).toHaveLength(2);
    expect(preview.rows[0].account).toBe("••1234");
    expect(preview.rows.map((row) => row.amount)).toEqual([-545, 150000]);
    expect(preview.rows[0].date.toISOString().slice(0, 10)).toBe("2026-04-15");
  });

  it("detects and parses an Apple Card-style statement", () => {
    const preview = parseStatementPdf({
      fileName: "apple.pdf",
      bytes: statementPdf([
        "APPLE CARD MONTHLY STATEMENT",
        "Statement Period 04/01/2026 - 04/30/2026",
        "Card ending in 9999",
        "Apr 15 Coffee Shop -$5.45",
        "Apr 18 Apple Services -$25.00",
      ].join("\n")),
      mimeType: "application/pdf",
    });

    expect(preview.bank).toBe("apple_card");
    expect(preview.rows).toHaveLength(2);
    expect(preview.rows.map((row) => row.description)).toEqual(["Coffee Shop", "Apple Services"]);
    expect(preview.rows.map((row) => row.amount)).toEqual([-545, -2500]);
  });

  it("fails clearly when no supported statement layout matches", () => {
    expect(() =>
      parseStatementPdf({
        fileName: "unknown.pdf",
        bytes: statementPdf("Some Other Bank\nTransactions"),
        mimeType: "application/pdf",
      }),
    ).toThrow(/no supported bank format/i);
  });
});
