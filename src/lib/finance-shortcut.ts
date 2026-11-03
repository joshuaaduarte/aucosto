// Personal keys for logging spending from an iPhone Shortcut (or anything
// that can POST JSON). No DB; tested in tests/finance-shortcut.test.ts.
//
// A key is `<base64url user id>.<signature>`. The signature is an HMAC of
// the user id and a version: the id of that person's latest
// "finance.shortcut_key_created" event. Making a new key records a new event,
// which changes the version and turns every older key off. Nothing secret is
// stored; AUTH_SECRET signs.

import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";

function signature(secret: string, userId: string, version: string): string {
  return createHmac("sha256", secret)
    .update(`finance-shortcut:v1:${userId}:${version}`)
    .digest("base64url")
    .slice(0, 32);
}

export function buildShortcutKey(secret: string, userId: string, version: string): string {
  return `${Buffer.from(userId).toString("base64url")}.${signature(secret, userId, version)}`;
}

/** The user id a key claims to belong to (unverified), or null if malformed. */
export function shortcutKeyUserId(key: string): string | null {
  const [encoded, sig] = key.split(".");
  if (!encoded || !sig || key.split(".").length !== 2) return null;
  const userId = Buffer.from(encoded, "base64url").toString("utf8");
  return /^[A-Za-z0-9_-]{6,64}$/.test(userId) ? userId : null;
}

export function shortcutKeyMatches(secret: string, key: string, userId: string, version: string): boolean {
  const expected = Buffer.from(buildShortcutKey(secret, userId, version));
  const given = Buffer.from(key);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

const amountSchema = z.union([
  z.number().positive().max(1_000_000),
  z.string().trim().min(1).max(20),
]);

export const shortcutEntrySchema = z.object({
  amount: amountSchema,
  description: z.string().trim().max(120).optional(),
  category: z.string().trim().max(40).optional(),
  /** Account name, matched case-insensitively. */
  account: z.string().trim().max(80).optional(),
  /** "YYYY-MM-DD"; defaults to today. */
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  direction: z.enum(["out", "in"]).optional(),
});

export type ShortcutEntry = z.infer<typeof shortcutEntrySchema>;

/** Shortcuts sends numbers as strings sometimes ("12.50", "$12"). */
export function shortcutAmountCents(amount: ShortcutEntry["amount"]): number | null {
  const n = typeof amount === "number" ? amount : Number(amount.replace(/[$,\s]/g, ""));
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n * 100);
}
