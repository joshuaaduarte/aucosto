import { deflateSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { extractPdfText } from "@/lib/statement-import/pdf-text";

function pdfFromStream(stream: Buffer, extraDict = ""): Uint8Array {
  return Buffer.from(
    `%PDF-1.4\n1 0 obj\n<< /Length ${stream.length} ${extraDict}>>\nstream\n${stream.toString("latin1")}\nendstream\nendobj\n%%EOF`,
    "latin1",
  );
}

describe("extractPdfText", () => {
  it("extracts text from plain Tj operators", () => {
    const bytes = pdfFromStream(Buffer.from("BT (CHASE CREDIT CARD) Tj (04/15 COFFEE SHOP -$5.45) Tj ET", "latin1"));
    const text = extractPdfText(bytes);
    expect(text).toContain("CHASE CREDIT CARD");
    expect(text).toContain("04/15 COFFEE SHOP -$5.45");
  });

  it("extracts text from flate-compressed streams", () => {
    const compressed = deflateSync(Buffer.from("BT [(APPLE CARD) 120 (Apr 15 Coffee Shop $5.45)] TJ ET", "latin1"));
    const text = extractPdfText(pdfFromStream(compressed, "/Filter /FlateDecode "));
    expect(text).toContain("APPLE CARD");
    expect(text).toContain("Apr 15 Coffee Shop $5.45");
  });
});
