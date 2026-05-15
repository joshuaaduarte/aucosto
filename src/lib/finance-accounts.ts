import type { FinanceAccount } from "@/generated/prisma/client";

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

export function summarizeBalances(
  accounts: Pick<FinanceAccount, "kind" | "currentBalanceCents">[],
): BalanceSnapshot {
  let cashCents = 0;
  let investmentCents = 0;
  let retirementCents = 0;
  let cardsOwedCents = 0;
  let loansOwedCents = 0;

  for (const account of accounts) {
    if (account.kind === "credit_card") {
      cardsOwedCents += Math.max(0, account.currentBalanceCents);
      continue;
    }

    if (account.kind === "loan") {
      loansOwedCents += Math.max(0, account.currentBalanceCents);
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

    cashCents += account.currentBalanceCents;
  }

  const netPositionCents = cashCents - cardsOwedCents - loansOwedCents;
  return {
    cashCents,
    investmentCents,
    retirementCents,
    cardsOwedCents,
    loansOwedCents,
    netPositionCents,
    netWorthCents: netPositionCents + investmentCents + retirementCents,
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
