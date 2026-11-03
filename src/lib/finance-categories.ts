export const FINANCE_CATEGORIES = [
  "Groceries",
  "Food & Drink",
  "Subscriptions",
  "Transport",
  "Shopping",
  "Bills & Utilities",
  "Health",
  "Entertainment",
  "Pets",
  "Housing",
  "Insurance",
  "Income",
  "Other",
] as const;

export type FinanceCategory = (typeof FINANCE_CATEGORIES)[number];

/**
 * A category typed in by hand: trimmed, at most 40 characters, and spelled
 * like a built-in one when it matches one ("groceries" → "Groceries").
 * Anything else is kept as a custom category. Null for blank.
 */
export function normalizeCategory(value: string | null | undefined): string | null {
  const trimmed = (value ?? "").trim().replace(/\s+/g, " ").slice(0, 40);
  if (!trimmed) return null;
  const builtIn = (FINANCE_CATEGORIES as readonly string[]).find((c) => c.toLowerCase() === trimmed.toLowerCase());
  return builtIn ?? trimmed;
}

/**
 * Categories to offer when logging: the built-in ones, then any custom ones
 * already used (most used first). Income is left out of spending choices.
 */
export function spendCategoryChoices(history: Array<{ category: string | null }>): string[] {
  const builtIn = FINANCE_CATEGORIES.filter((c) => c !== "Income") as string[];
  const lower = new Set((FINANCE_CATEGORIES as readonly string[]).map((c) => c.toLowerCase()));
  const counts = new Map<string, number>();
  for (const t of history) {
    const c = t.category?.trim();
    if (!c || lower.has(c.toLowerCase())) continue;
    counts.set(c, (counts.get(c) ?? 0) + 1);
  }
  const custom = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([c]) => c);
  return [...builtIn, ...custom];
}

const CATEGORY_RULES: Array<{ category: FinanceCategory; keywords: string[] }> = [
  { category: "Food & Drink", keywords: ["coffee", "cafe", "restaurant", "pizza", "taco", "burger", "doordash", "ubereats", "grubhub", "boba", "bar"] },
  { category: "Groceries", keywords: ["grocery", "trader joe", "safeway", "costco", "whole foods", "market", "aldi", "sprouts"] },
  { category: "Transport", keywords: ["uber", "lyft", "shell", "chevron", "76", "exxon", "bp", "gas", "parking", "bart"] },
  { category: "Subscriptions", keywords: ["spotify", "netflix", "hulu", "disney", "apple.com/bill", "youtube", "openai", "claude", "vercel", "github", "icloud"] },
  { category: "Shopping", keywords: ["amazon", "target", "walmart", "best buy", "etsy", "ebay", "store"] },
  { category: "Bills & Utilities", keywords: ["pg&e", "utility", "internet", "xfinity", "comcast", "tmobile", "verizon", "att", "water"] },
  { category: "Health", keywords: ["pharmacy", "cvs", "walgreens", "doctor", "dental", "medical"] },
  { category: "Entertainment", keywords: ["amc", "movie", "cinema", "concert", "rock n roll events", "event"] },
  { category: "Pets", keywords: ["petsmart", "petsmart", "club k9", "pet"] },
  { category: "Housing", keywords: ["rent", "rental", "essex portfolio", "apartment", "mortgage"] },
  { category: "Insurance", keywords: ["insurance", "get covered"] },
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
