import type { ParsedRow } from "@/lib/csv";
import type {
  StatementContext,
  StatementDocument,
  StatementImportPreview,
  StatementParser,
  StatementTransactionCandidate,
} from "@/lib/statement-import/types";

function parseAmountToCents(value: string | number): number | null {
  if (typeof value === "number") {
    return Number.isInteger(value) ? value : Math.round(value * 100);
  }

  const trimmed = value.trim();
  if (!trimmed) return null;

  const hasCreditMarker = /\bCR\b/i.test(trimmed);
  const negative = !hasCreditMarker && (trimmed.includes("(") || /^-/.test(trimmed) || /-\$?\d/.test(trimmed));
  const cleaned = trimmed
    .replace(/\bCR\b/gi, "")
    .replace(/[$,\s]/g, "")
    .replace(/[()]/g, "")
    .replace(/^\+/, "");

  const amount = Number(cleaned);
  if (!Number.isFinite(amount)) return null;

  const cents = Math.round(Math.abs(amount) * 100);
  return negative ? -cents : cents;
}

function inferYear(month: number, context: StatementContext): number {
  const end = context.statementEndDate;
  const fallbackYear = context.statementYear ?? new Date().getUTCFullYear();
  if (!end) return fallbackYear;
  return month > end.getUTCMonth() + 1 ? end.getUTCFullYear() - 1 : end.getUTCFullYear();
}

function parseStatementDate(value: string | Date, context: StatementContext): Date | null {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  const trimmed = value.trim();
  if (!trimmed) return null;

  const slash = trimmed.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?$/);
  if (slash) {
    const month = Number(slash[1]);
    const day = Number(slash[2]);
    const year = slash[3]
      ? slash[3].length === 2
        ? 2000 + Number(slash[3])
        : Number(slash[3])
      : inferYear(month, context);
    const date = new Date(Date.UTC(year, month - 1, day, 12));
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const direct = new Date(trimmed);
  if (!Number.isNaN(direct.getTime())) return direct;

  const named = trimmed.match(/^([A-Za-z]{3,9})\s+(\d{1,2})(?:,?\s+(\d{2,4}))?$/);
  if (named) {
    const [, month, day, year] = named;
    const probe = new Date(`${month} ${day}, ${year ?? context.statementYear ?? new Date().getUTCFullYear()}`);
    return Number.isNaN(probe.getTime()) ? null : probe;
  }

  return null;
}

function normalizeCandidate(
  candidate: StatementTransactionCandidate,
  context: StatementContext,
): ParsedRow | null {
  const date = parseStatementDate(candidate.date, context);
  const amount = parseAmountToCents(candidate.amount);
  const description = candidate.description.trim().replace(/\s+/g, " ");

  if (!date || amount === null || !description) {
    return null;
  }

  return {
    date,
    amount,
    description,
    account: candidate.account?.trim() || context.accountHint || null,
    raw: candidate.raw ?? JSON.stringify(candidate),
  };
}

function extractStatementContext(text: string): StatementContext {
  const periodMatch = text.match(
    /(opening\/closing date|billing period|statement period|billing cycle)\s*:?\s*(\d{1,2}\/\d{1,2}\/\d{2,4}).{0,10}(\d{1,2}\/\d{1,2}\/\d{2,4})/i,
  );
  const endDate = periodMatch?.[3] ? new Date(periodMatch[3]) : null;
  const accountMatch = text.match(/(?:account|card)(?: number| ending in)?\s*(?:[#:]|ending in)?\s*(\d{4})/i);

  return {
    statementYear: endDate && !Number.isNaN(endDate.getTime()) ? endDate.getUTCFullYear() : null,
    statementEndDate: endDate && !Number.isNaN(endDate.getTime()) ? endDate : null,
    accountHint: accountMatch?.[1] ? `••${accountMatch[1]}` : null,
  };
}

type ParserPattern = {
  regex: RegExp;
  map(match: RegExpMatchArray): StatementTransactionCandidate;
};

type ParserConfig = {
  bank: StatementParser["bank"];
  bankLabel: string;
  matchers: RegExp[];
  rowPatterns: ParserPattern[];
};

function createRegexParser(config: ParserConfig): StatementParser {
  return {
    bank: config.bank,
    bankLabel: config.bankLabel,
    matches(document) {
      return config.matchers.every((pattern) => pattern.test(document.text));
    },
    parse(document) {
      const context = extractStatementContext(document.text);
      const lines = document.text
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);

      const rows: ParsedRow[] = [];
      let skipped = 0;

      for (const line of lines) {
        let matched = false;

        for (const pattern of config.rowPatterns) {
          const result = line.match(pattern.regex);
          if (!result) continue;

          matched = true;
          const row = normalizeCandidate(
            {
              ...pattern.map(result),
              raw: line,
            },
            context,
          );

          if (row) rows.push(row);
          else skipped++;
          break;
        }

        if (!matched && /^\d{1,2}\//.test(line)) {
          skipped++;
        }
      }

      return {
        rows,
        skipped,
        warnings: rows.length === 0 ? [`No transactions recognized in ${config.bankLabel} statement text.`] : [],
        account: context.accountHint,
      };
    },
  };
}

const slashDateRow: ParserPattern = {
  regex: /^(\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)\s+(.+?)\s+(\(?-?\$?[\d,]+\.\d{2}\)?(?:\s+CR)?)$/,
  map(match) {
    return {
      date: match[1]!,
      description: match[2]!,
      amount: match[3]!,
    };
  },
};

const namedDateRow: ParserPattern = {
  regex: /^([A-Za-z]{3,9}\s+\d{1,2}(?:,\s*\d{2,4})?)\s+(.+?)\s+(\(?-?\$?[\d,]+\.\d{2}\)?(?:\s+CR)?)$/,
  map(match) {
    return {
      date: match[1]!,
      description: match[2]!,
      amount: match[3]!,
    };
  },
};

export const statementParsers: StatementParser[] = [
  createRegexParser({
    bank: "chase",
    bankLabel: "Chase",
    matchers: [/CHASE/i, /(opening\/closing date|transactions?)/i],
    rowPatterns: [slashDateRow],
  }),
  createRegexParser({
    bank: "discover",
    bankLabel: "Discover",
    matchers: [/DISCOVER/i, /(transactions?|new balance)/i],
    rowPatterns: [slashDateRow],
  }),
  createRegexParser({
    bank: "citi",
    bankLabel: "Citi",
    matchers: [/CITI/i, /(transactions?|billing period)/i],
    rowPatterns: [slashDateRow],
  }),
  createRegexParser({
    bank: "wells_fargo",
    bankLabel: "Wells Fargo",
    matchers: [/WELLS FARGO/i, /(transactions?|statement period)/i],
    rowPatterns: [slashDateRow],
  }),
  createRegexParser({
    bank: "apple_card",
    bankLabel: "Apple Card",
    matchers: [/APPLE CARD/i, /(transactions?|statement period|monthly installment)/i],
    rowPatterns: [namedDateRow, slashDateRow],
  }),
];

export function previewStatementImport(document: StatementDocument): StatementImportPreview {
  const parser = statementParsers.find((candidate) => candidate.matches(document));
  if (!parser) {
    throw new Error("Statement PDF was read, but no supported bank format matched yet.");
  }

  return {
    bank: parser.bank,
    bankLabel: parser.bankLabel,
    ...parser.parse(document),
  };
}
