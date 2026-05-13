import Papa from "papaparse";

export type ParsedRow = {
  date: Date;
  amount: number;
  description: string;
  account: string | null;
  raw: string;
};

export type ParseResult = {
  rows: ParsedRow[];
  skipped: number;
  total: number;
};

const DATE_KEYS = [
  "date",
  "posted date",
  "posted",
  "transaction date",
  "trans date",
];
const AMOUNT_KEYS = ["amount", "amount ($)", "amt"];
const DEBIT_KEYS = ["debit", "withdrawal", "debit amount"];
const CREDIT_KEYS = ["credit", "deposit", "credit amount"];
const DESC_KEYS = [
  "description",
  "name",
  "payee",
  "merchant",
  "memo",
  "transaction",
];
const ACCOUNT_KEYS = ["account", "account name", "account number"];

function pick(
  headerMap: Map<string, string>,
  row: Record<string, string>,
  candidates: string[],
): string | undefined {
  for (const candidate of candidates) {
    const realKey = headerMap.get(candidate);
    if (realKey && row[realKey] !== undefined && row[realKey] !== "") {
      return row[realKey];
    }
  }
  return undefined;
}

function parseAmount(s: string): number | null {
  const cleaned = s
    .replace(/[$,\s]/g, "")
    .replace(/^\((.*)\)$/, "-$1");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function parseDate(s: string): Date | null {
  const trimmed = s.trim();
  if (!trimmed) return null;
  const iso = new Date(trimmed);
  if (!Number.isNaN(iso.getTime())) return iso;
  const m = trimmed.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (m) {
    const [, a, b, c] = m;
    const year = c.length === 2 ? 2000 + Number(c) : Number(c);
    const month = Number(a) - 1;
    const day = Number(b);
    const d = new Date(year, month, day);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

export function parseTransactionsCsv(text: string): ParseResult {
  const result = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  });

  const rows: ParsedRow[] = [];
  let skipped = 0;
  const total = result.data.length;

  const fields = result.meta.fields ?? [];
  const headerMap = new Map<string, string>();
  for (const f of fields) {
    headerMap.set(f.toLowerCase(), f);
  }

  for (const row of result.data) {
    const dateStr = pick(headerMap, row, DATE_KEYS);
    const descStr = pick(headerMap, row, DESC_KEYS);
    if (!dateStr || !descStr) {
      skipped++;
      continue;
    }

    const date = parseDate(dateStr);
    if (!date) {
      skipped++;
      continue;
    }

    let amount: number | null = null;
    const amountStr = pick(headerMap, row, AMOUNT_KEYS);
    if (amountStr) {
      amount = parseAmount(amountStr);
    } else {
      const debitStr = pick(headerMap, row, DEBIT_KEYS);
      const creditStr = pick(headerMap, row, CREDIT_KEYS);
      const debit = debitStr ? parseAmount(debitStr) : null;
      const credit = creditStr ? parseAmount(creditStr) : null;
      if (debit !== null && debit !== 0) amount = -Math.abs(debit);
      else if (credit !== null && credit !== 0) amount = Math.abs(credit);
    }

    if (amount === null) {
      skipped++;
      continue;
    }

    rows.push({
      date,
      amount,
      description: descStr.trim(),
      account: pick(headerMap, row, ACCOUNT_KEYS)?.trim() ?? null,
      raw: JSON.stringify(row),
    });
  }

  return { rows, skipped, total };
}
