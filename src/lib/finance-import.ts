import type { FinanceTransaction } from "@/generated/prisma/client";
import type { ParsedRow } from "@/lib/csv";

function normalizeText(value: string | null | undefined): string {
  return (value ?? "").trim().replace(/\s+/g, " ").toLowerCase();
}

function normalizeDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

export function fingerprintParsedRow(row: ParsedRow): string {
  return [
    normalizeDate(row.date),
    row.amount,
    normalizeText(row.description),
    normalizeText(row.account),
  ].join("|");
}

export function fingerprintTransaction(row: FinanceTransaction): string {
  return [
    normalizeDate(row.date),
    row.amount,
    normalizeText(row.description),
    normalizeText(row.account),
  ].join("|");
}

export function dedupeParsedRows(
  rows: ParsedRow[],
  existing: FinanceTransaction[],
): { rowsToImport: ParsedRow[]; deduped: number } {
  const seen = new Set(existing.map(fingerprintTransaction));
  const rowsToImport: ParsedRow[] = [];
  let deduped = 0;

  for (const row of rows) {
    const key = fingerprintParsedRow(row);
    if (seen.has(key)) {
      deduped++;
      continue;
    }
    seen.add(key);
    rowsToImport.push(row);
  }

  return { rowsToImport, deduped };
}
