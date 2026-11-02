// Pure rules for what a household partner can reach. No DB, importable from
// the proxy, layouts, client nav and tests.
//
// The privacy guarantee does NOT rest on these path rules: a partner's
// personal-tool reads and writes are scoped to her own (empty) userId, so
// she can never see the owner's personal data even if she reached a page.
// These rules keep her UI to the tools she was given and are enforced
// server-side in the app layout.

export type HouseholdRole = "owner" | "partner";

/** Where a partner lands, and where disallowed paths send her. */
export const PARTNER_HOME_PATH = "/app/home";

const PARTNER_PATH_PREFIXES = ["/app/home", "/app/finance", "/app/settings"];

export function isPartnerPathAllowed(pathname: string): boolean {
  return PARTNER_PATH_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

/** Normalize emails the same way everywhere invites and sign-ins compare them. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export const INVITE_TTL_DAYS = 7;

export function inviteExpiry(now: Date, days = INVITE_TTL_DAYS): Date {
  return new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
}

export type InviteStatus = "valid" | "expired" | "accepted";

export function inviteStatus(
  invite: { expiresAt: Date; acceptedAt: Date | null },
  now: Date,
): InviteStatus {
  if (invite.acceptedAt) return "accepted";
  if (invite.expiresAt.getTime() <= now.getTime()) return "expired";
  return "valid";
}

export type FinanceScope = "household" | "personal";

export const FINANCE_SCOPE_COOKIE = "aucosto_finance_scope";

export function parseFinanceScope(value: string | undefined | null): FinanceScope {
  return value === "personal" ? "personal" : "household";
}
