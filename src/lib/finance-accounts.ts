import type { FinanceAccount } from "@/generated/prisma/client";

export const FINANCE_ACCOUNT_KINDS = ["checking", "savings", "credit_card", "cash"] as const;

export type FinanceAccountKind = (typeof FINANCE_ACCOUNT_KINDS)[number];

export type BalanceSnapshot = {
  cashCents: number;
  cardsOwedCents: number;
  netPositionCents: number;
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
    default:
      return kind;
  }
}

export function summarizeBalances(
  accounts: Pick<FinanceAccount, "kind" | "currentBalanceCents">[],
): BalanceSnapshot {
  let cashCents = 0;
  let cardsOwedCents = 0;

  for (const account of accounts) {
    if (account.kind === "credit_card") {
      cardsOwedCents += Math.max(0, account.currentBalanceCents);
      continue;
    }

    cashCents += account.currentBalanceCents;
  }

  return {
    cashCents,
    cardsOwedCents,
    netPositionCents: cashCents - cardsOwedCents,
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
