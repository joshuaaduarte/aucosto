export const FINANCE_CATEGORIES = [
  "Groceries",
  "Food & Drink",
  "Subscriptions",
  "Transport",
  "Shopping",
  "Bills & Utilities",
  "Health",
  "Income",
  "Other",
] as const;

export type FinanceCategory = (typeof FINANCE_CATEGORIES)[number];

const CATEGORY_RULES: Array<{ category: FinanceCategory; keywords: string[] }> = [
  { category: "Food & Drink", keywords: ["coffee", "cafe", "restaurant", "pizza", "taco", "burger", "doordash", "ubereats", "grubhub", "boba", "bar"] },
  { category: "Groceries", keywords: ["grocery", "trader joe", "safeway", "costco", "whole foods", "market", "aldi", "sprouts"] },
  { category: "Transport", keywords: ["uber", "lyft", "shell", "chevron", "76", "exxon", "bp", "gas", "parking", "bart"] },
  { category: "Subscriptions", keywords: ["spotify", "netflix", "hulu", "disney", "apple.com/bill", "youtube", "openai", "claude", "vercel", "github", "icloud"] },
  { category: "Shopping", keywords: ["amazon", "target", "walmart", "best buy", "etsy", "ebay", "store"] },
  { category: "Bills & Utilities", keywords: ["pg&e", "utility", "internet", "xfinity", "comcast", "tmobile", "verizon", "att", "water"] },
  { category: "Health", keywords: ["pharmacy", "cvs", "walgreens", "doctor", "dental", "medical"] },
  { category: "Income", keywords: ["payroll", "salary", "paycheck", "deposit", "refund"] },
];

function normalizeText(value: string | null | undefined): string {
  return (value ?? "").trim().replace(/\s+/g, " ").toLowerCase();
}

export function inferCategory(description: string, amount: number): FinanceCategory {
  if (amount > 0) return "Income";
  const normalized = normalizeText(description);
  for (const rule of CATEGORY_RULES) {
    if (rule.keywords.some((keyword) => normalized.includes(keyword))) {
      return rule.category;
    }
  }
  return "Other";
}

export function resolveCategory(category: string | null | undefined, description: string, amount: number): FinanceCategory {
  return (category as FinanceCategory | null | undefined) ?? inferCategory(description, amount);
}
