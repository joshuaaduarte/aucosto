// Shared authentication for the assistant (external agent) API surface.
//
// Accepts EITHER the existing Auth.js session OR a bearer token
// (ASSISTANT_API_SECRET) that resolves to the owner user — mirroring the
// /api/location/ingest precedent (env secret, Authorization: Bearer,
// constant-time comparison).
//
// Security note: the bearer key is owner-equivalent. Like a logged-in
// session, it resolves to the owner userId directly and bypasses viewer
// context (demo mode, the app privacy lock, and the finance visibility gate
// are NOT enforced on assistant routes). Treat ASSISTANT_API_SECRET like a
// password: long random value, server env only, never logged or committed.

import "server-only";

import { timingSafeEqual } from "node:crypto";

import { auth } from "@/auth";
import { resolveOwnerUserId } from "@/lib/owner";

export type AssistantAuthVia = "session" | "bearer";

export interface AssistantAuth {
  userId: string;
  via: AssistantAuthVia;
}

/** Constant-time bearer comparison. Pure — exported for unit tests. */
export function bearerMatches(header: string | null, secret: string): boolean {
  const token = header?.startsWith("Bearer ") ? header.slice(7) : "";
  const a = Buffer.from(token);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Resolve the acting user for an assistant route.
 *
 * Session cookie wins (existing behavior unchanged). Otherwise, when a
 * request is provided and ASSISTANT_API_SECRET is configured, accept
 * `Authorization: Bearer <secret>` and resolve to the owner user.
 * Returns null when neither authenticates.
 */
export async function resolveAssistantAuth(
  request?: Request,
): Promise<AssistantAuth | null> {
  const session = await auth();
  if (session?.user?.id) {
    return { userId: session.user.id, via: "session" };
  }

  const secret = process.env.ASSISTANT_API_SECRET?.trim();
  if (!secret || !request) return null;
  if (!bearerMatches(request.headers.get("authorization"), secret)) {
    return null;
  }

  const userId = await resolveOwnerUserId();
  if (!userId) return null;
  return { userId, via: "bearer" };
}
