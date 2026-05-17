// Internal helpers shared between finance service modules. Not exported from
// the barrel — keep these out of public callsites.

import "server-only";
import { inferCategory } from "@/lib/finance-categories";
import type { FinanceAccountKind } from "@/lib/finance-accounts";
import type { TellerAccount } from "@/lib/teller";

export function formatLinkedAccountName(account: TellerAccount): string {
  const suffix = account.last_four ? ` • ${account.last_four}` : "";
  return `${account.name}${suffix}`;
}

export function mapTellerAccountKind(account: TellerAccount): FinanceAccountKind {
  const subtype = (account.subtype ?? "").toLowerCase();
  const type = (account.type ?? "").toLowerCase();

  if (subtype.includes("credit") || type === "credit") return "credit_card";
  if (subtype.includes("savings")) return "savings";
  if (subtype.includes("investment") || type === "investment") return "investment";
  if (subtype.includes("retirement")) return "retirement";
  if (subtype.includes("loan") || type === "loan") return "loan";
  return "checking";
}

export function tellerMoneyToCents(value: string | null | undefined): number {
  if (!value) return 0;
  return Math.round(Number(value) * 100);
}

export function normalizeSyncedAmountCents(
  accountKind: string,
  rawCents: number,
): number {
  if (accountKind === "credit_card") {
    return rawCents * -1;
  }
  return rawCents;
}

export function tellerDateToMidday(value: string): Date {
  return new Date(`${value}T12:00:00.000Z`);
}

function tellerCategoryToFinanceCategory(
  value: string | null | undefined,
): string | null {
  if (!value) return null;
  switch (value) {
    case "groceries":
      return "Groceries";
    case "dining":
    case "bar":
      return "Food & Drink";
    case "fuel":
    case "transport":
    case "transportation":
      return "Transport";
    case "utilities":
    case "phone":
    case "service":
      return "Bills & Utilities";
    case "health":
      return "Health";
    case "entertainment":
    case "sport":
      return "Entertainment";
    case "insurance":
      return "Insurance";
    case "income":
      return "Income";
    case "home":
    case "loan":
      return "Housing";
    case "shopping":
    case "clothing":
    case "electronics":
      return "Shopping";
    default:
      return null;
  }
}

export function inferSyncedCategory({
  providerCategory,
  description,
  amount,
}: {
  providerCategory: string | null | undefined;
  description: string;
  amount: number;
}): string {
  const providerMatch = tellerCategoryToFinanceCategory(providerCategory);
  if (providerMatch) return providerMatch;

  if (amount > 0 && /(payment|thank you|autopay|ccpymt|card ccpymt|gsbank payment)/i.test(description)) {
    return "Other";
  }

  return inferCategory(description, amount);
}
