// Constant-time `Authorization: Bearer <secret>` check, shared by every
// token-authenticated route (assistant, location ingest, cron). Pure — no
// server-only import so it stays unit-testable.

import { timingSafeEqual } from "node:crypto";

export function bearerMatches(header: string | null, secret: string): boolean {
  const token = header?.startsWith("Bearer ") ? header.slice(7) : "";
  const a = Buffer.from(token);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Parse a list of accepted secrets: the primary secret plus a
 * comma-separated list of extra ones (one per agent, so a single agent's key
 * can be added or revoked without rotating everyone else's). Blank entries
 * are dropped.
 */
export function parseSecrets(
  primary: string | undefined,
  extra: string | undefined,
): string[] {
  return [primary ?? "", ...(extra ?? "").split(",")]
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/** True when the bearer header matches any of the given secrets. */
export function bearerMatchesAny(
  header: string | null,
  secrets: readonly string[],
): boolean {
  // Check every secret (no early exit) so timing doesn't reveal which matched.
  let ok = false;
  for (const secret of secrets) {
    if (bearerMatches(header, secret)) ok = true;
  }
  return ok;
}
