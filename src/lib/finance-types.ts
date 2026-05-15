import type { FinanceTransaction } from "@/generated/prisma/client";

export const FINANCE_TRANSACTION_TYPES = [
  "income",
  "expense",
  "transfer",
  "credit_card_payment",
  "reimbursement",
  "housing",
  "fee",
] as const;

export type FinanceTransactionType = (typeof FINANCE_TRANSACTION_TYPES)[number];

const CARD_PAYMENT_KEYWORDS = [
  "payment to chase card",
  "discover e-payment",
  "citi card online payment",
  "applecard gsbank payment",
  "wells fargo card ccpymt",
  "amex payment",
  "credit card payment",
  "card ending in",
];

const TRANSFER_KEYWORDS = [
  "online realtime transfer",
  "transfer to",
  "transfer from",
  "internal transfer",
  "between accounts",
];

const HOUSING_KEYWORDS = [
  "rent",
  "rental",
  "essex portfolio",
  "apartment",
  "mortgage",
  "property management",
];

const FEE_KEYWORDS = [
  "fee",
  "service charge",
  "monthly service fee",
];

const REIMBURSEMENT_KEYWORDS = [
  "zelle payment from",
  "venmo cashout",
  "refund",
  "reimbursement",
  "cash app cash out",
];

function normalizeText(value: string | null | undefined): string {
  return (value ?? "").trim().replace(/\s+/g, " ").toLowerCase();
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function hasKeyword(value: string, keywords: string[]): boolean {
  return keywords.some((keyword) => {
    const pattern = new RegExp(
      `(^|[^a-z0-9])${escapeRegExp(keyword).replace(/\\ /g, "\\s+")}(?=$|[^a-z0-9])`,
      "i",
    );
    return pattern.test(value);
  });
}

export function classifyTransaction(
  tx: Pick<FinanceTransaction, "amount" | "description">,
): FinanceTransactionType {
  const normalized = normalizeText(tx.description);

  if (tx.amount > 0) {
    if (hasKeyword(normalized, TRANSFER_KEYWORDS)) return "transfer";
    if (hasKeyword(normalized, REIMBURSEMENT_KEYWORDS)) return "reimbursement";
    return "income";
  }

  if (hasKeyword(normalized, CARD_PAYMENT_KEYWORDS)) return "credit_card_payment";
  if (hasKeyword(normalized, TRANSFER_KEYWORDS)) return "transfer";
  if (hasKeyword(normalized, HOUSING_KEYWORDS)) return "housing";
  if (hasKeyword(normalized, FEE_KEYWORDS)) return "fee";
  return "expense";
}

export function isTrueExpenseType(type: FinanceTransactionType): boolean {
  return type === "expense" || type === "housing" || type === "fee";
}

export function isTrueExpenseTransaction(
  tx: Pick<FinanceTransaction, "amount" | "description">,
): boolean {
  return tx.amount < 0 && isTrueExpenseType(classifyTransaction(tx));
}

export function formatTransactionType(type: FinanceTransactionType): string {
  switch (type) {
    case "credit_card_payment":
      return "Card payment";
    case "reimbursement":
      return "Reimbursement";
    case "housing":
      return "Housing";
    case "fee":
      return "Fee";
    case "transfer":
      return "Transfer";
    case "income":
      return "Income";
    case "expense":
      return "Expense";
  }
}
