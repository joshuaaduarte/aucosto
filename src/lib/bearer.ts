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
