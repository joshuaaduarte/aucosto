import { extractPdfText } from "@/lib/statement-import/pdf-text";
import { previewStatementImport } from "@/lib/statement-import/parsers";
import type { StatementImportPreview } from "@/lib/statement-import/types";

export type { StatementBank, StatementDocument, StatementImportPreview } from "@/lib/statement-import/types";

export function parseStatementPdf(input: {
  fileName: string;
  bytes: Uint8Array;
  mimeType?: string;
}): StatementImportPreview {
  const text = extractPdfText(input.bytes);
  if (!text) {
    throw new Error("Could not extract readable text from this PDF statement.");
  }

  return previewStatementImport({
    kind: "pdf",
    fileName: input.fileName,
    mimeType: input.mimeType,
    bytes: input.bytes,
    text,
  });
}
