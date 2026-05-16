import type { FinanceAccount } from "@/generated/prisma/client";

export type FinanceAccountLike = Pick<
  FinanceAccount,
  | "id"
  | "name"
  | "kind"
  | "syncSource"
  | "includeInNetWorth"
  | "includeInCashPosition"
  | "currentBalanceCents"
>;

export const FINANCE_ACCOUNT_KINDS = [
  "checking",
  "savings",
  "credit_card",
  "cash",
  "investment",
  "retirement",
  "loan",
] as const;

export type FinanceAccountKind = (typeof FINANCE_ACCOUNT_KINDS)[number];

export type BalanceSnapshot = {
  cashCents: number;
  investmentCents: number;
  retirementCents: number;
  cardsOwedCents: number;
  loansOwedCents: number;
  netPositionCents: number;
  netWorthCents: number;
  cashAccountCount: number;
  netWorthAccountCount: number;
  debtAccountCount: number;
};

export function formatAccountKind(kind: string): string {
  switch (kind) {
    case "credit_card":
      return "Credit card";
    case "checking":
      return "Checking";
    case "savings":
      return "Savings";
    case "cash":
      return "Cash";
    case "investment":
      return "Investment";
    case "retirement":
      return "Retirement";
    case "loan":
      return "Loan";
    default:
      return kind;
  }
}

export function defaultAccountInclusion(kind: string): {
  includeInNetWorth: boolean;
  includeInCashPosition: boolean;
} {
  return {
    includeInNetWorth: true,
    includeInCashPosition: ["checking", "savings", "cash"].includes(kind),
  };
}

function normalizeAccountName(value: string): string {
  return value
    .toLowerCase()
    .replace(/[®•]/g, " ")
    .replace(/\b(card|visa|mastercard|debit|bank|checking|savings|credit|cash|total|everyday|anywhere|active|by|fargo|wells|chase|citi|citibank)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function accountLastFour(value: string): string | null {
  const matches = value.match(/(\d{4})(?!.*\d)/);
  return matches?.[1] ?? null;
}

export function findLikelyDuplicateManualAccountIds(accounts: FinanceAccountLike[]): Set<string> {
  const linkedFingerprints = new Set<string>();

  for (const account of accounts) {
    if (account.syncSource !== "teller") continue;
    const lastFour = accountLastFour(account.name);
    const normalized = normalizeAccountName(account.name);
    linkedFingerprints.add(`${account.kind}|${lastFour ?? ""}|${normalized}`);
    if (lastFour) linkedFingerprints.add(`${account.kind}|${lastFour}`);
  }

  const duplicates = new Set<string>();
  for (const account of accounts) {
    if (account.syncSource !== "manual") continue;
    const lastFour = accountLastFour(account.name);
    const normalized = normalizeAccountName(account.name);
    const exactFingerprint = `${account.kind}|${lastFour ?? ""}|${normalized}`;
    const looseFingerprint = lastFour ? `${account.kind}|${lastFour}` : null;
    if (linkedFingerprints.has(exactFingerprint) || (looseFingerprint && linkedFingerprints.has(looseFingerprint))) {
      duplicates.add(account.id);
    }
  }

  return duplicates;
}

export function summarizeBalances(
  accounts: Pick<FinanceAccount, "kind" | "currentBalanceCents" | "includeInNetWorth" | "includeInCashPosition">[],
): BalanceSnapshot {
  let cashCents = 0;
  let investmentCents = 0;
  let retirementCents = 0;
  let cardsOwedCents = 0;
  let loansOwedCents = 0;
  let cashAccountCount = 0;
  let netWorthAccountCount = 0;
  let debtAccountCount = 0;

  for (const account of accounts) {
    if (account.includeInCashPosition && !["credit_card", "loan"].includes(account.kind)) {
      cashCents += account.currentBalanceCents;
      cashAccountCount += 1;
    }

    if (!account.includeInNetWorth) continue;
    netWorthAccountCount += 1;

    if (account.kind === "credit_card") {
      cardsOwedCents += Math.max(0, account.currentBalanceCents);
      debtAccountCount += 1;
      continue;
    }

    if (account.kind === "loan") {
      loansOwedCents += Math.max(0, account.currentBalanceCents);
      debtAccountCount += 1;
      continue;
    }

    if (account.kind === "investment") {
      investmentCents += account.currentBalanceCents;
      continue;
    }

    if (account.kind === "retirement") {
      retirementCents += account.currentBalanceCents;
      continue;
    }
  }

  const netPositionCents = cashCents - cardsOwedCents - loansOwedCents;
  return {
    cashCents,
    investmentCents,
    retirementCents,
    cardsOwedCents,
    loansOwedCents,
    netPositionCents,
    netWorthCents: cashCents + investmentCents + retirementCents - cardsOwedCents - loansOwedCents,
    cashAccountCount,
    netWorthAccountCount,
    debtAccountCount,
  };
}

export function parseCurrencyToCents(value: string): number {
  const normalized = value.replace(/[$,\s]/g, "").trim();
  if (!normalized) return 0;
  const amount = Number(normalized);
  if (!Number.isFinite(amount)) {
    throw new Error("Invalid currency amount.");
  }
  return Math.round(amount * 100);
}
