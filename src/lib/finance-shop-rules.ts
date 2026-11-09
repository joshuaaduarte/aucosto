// Remembered shop rules: once a shop is sorted, every later entry from it
// gets the same name and category, whether it came from quick add, the
// iPhone Shortcut or a bank file. Pure; tested in tests/finance-shop-rules.test.ts.
//
// Like Actual Budget's rules, a rule matches the raw text the bank (or you)
// wrote, by a short key: the first two real words of the shop's name, with
// card-processor prefixes ("SQ *", "TST*"), store numbers and punctuation
// stripped. "TRADER JOE'S #552 SAN DIEGO CA" and "Trader Joe's" share the
// key "trader joes".
//
// Rules belong to the person who made them, so Ana's categories stay hers:
// the acting person's rule wins, then anyone else's in the same space.

export type ShopRule = {
  id: string;
  /** Who made the rule (a person's user id). */
  ownerUserId: string;
  /** shopRuleKey() of the shop. */
  match: string;
  /** Name to show instead of the bank's text. Null keeps the text. */
  name: string | null;
  category: string | null;
  updatedAt: Date;
};

const PREFIXES = new Set(["sq", "tst", "sp", "pp", "py", "paypal", "pos", "debit", "purchase", "ach", "dd", "in", "the"]);

/** Short, stable key for a shop name; "" when the text has no real words. */
export function shopRuleKey(description: string): string {
  const words = description
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .split(" ")
    .filter((w) => w.length > 0 && !/\d/.test(w));
  while (words.length > 1 && PREFIXES.has(words[0]!)) words.shift();
  const real = words.filter((w) => w.length >= 2);
  return real.slice(0, 2).join(" ");
}

/** The rule for this shop: the actor's own first, then the newest of anyone's. */
export function findShopRule(
  rules: ShopRule[],
  description: string,
  actorUserId: string | null,
): ShopRule | null {
  const key = shopRuleKey(description);
  if (!key) return null;
  const hits = rules.filter((r) => r.match === key);
  if (hits.length === 0) return null;
  const newestFirst = [...hits].sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
  return newestFirst.find((r) => r.ownerUserId === actorUserId) ?? newestFirst[0]!;
}

/**
 * Name and category for an incoming entry. A category you gave wins over the
 * rule; the rule's name replaces the bank text only when asked (imports).
 */
export function applyShopRule(
  input: { description: string; category: string | null },
  rule: ShopRule | null,
  options: { rename: boolean },
): { description: string; category: string | null } {
  if (!rule) return input;
  return {
    description: options.rename && rule.name ? rule.name : input.description,
    category: input.category?.trim() ? input.category : rule.category ?? input.category,
  };
}

/**
 * What a confirmed import teaches: the bank's text for a shop maps to the
 * name and category you gave it. Null when there's nothing worth keeping.
 */
export function ruleFromConfirmation(input: {
  bankDescription: string;
  yourDescription: string;
  category: string | null;
}): { match: string; name: string | null; category: string | null } | null {
  const match = shopRuleKey(input.bankDescription);
  if (!match) return null;
  const name = input.yourDescription.trim();
  const category = input.category?.trim() || null;
  const sameName = name.toLowerCase() === input.bankDescription.trim().toLowerCase();
  if (!category && (sameName || !name)) return null;
  return { match, name: name && !sameName ? name : null, category };
}
