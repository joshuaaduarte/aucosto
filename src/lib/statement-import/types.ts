import type { ParsedRow } from "@/lib/csv";

export type StatementBank = "chase" | "discover" | "citi" | "wells_fargo" | "apple_card";

export type StatementDocument = {
  kind: "pdf";
  fileName: string;
  mimeType?: string;
  bytes: Uint8Array;
  text: string;
};

export type StatementContext = {
  statementYear: number | null;
  statementEndDate: Date | null;
  accountHint: string | null;
};

export type StatementTransactionCandidate = {
  date: string | Date;
  amount: string | number;
  description: string;
  account?: string | null;
  raw?: string | null;
};

export type StatementParserResult = {
  rows: ParsedRow[];
  skipped: number;
  warnings: string[];
  account: string | null;
};

export type StatementParser = {
  bank: StatementBank;
  bankLabel: string;
  matches(document: StatementDocument): boolean;
  parse(document: StatementDocument): StatementParserResult;
};

export type StatementImportPreview = StatementParserResult & {
  bank: StatementBank;
  bankLabel: string;
};
