// Shared shape + auth helpers for Server Actions.
//
// Every action needs the same two things at the top:
//   1. resolve the acting userId from the viewer context (which can throw)
//   2. translate thrown errors into a serializable `{ ok: false, error }` shape
//
// withViewer does both for any tool; withFinanceUser additionally enforces
// the finance-visibility privacy gate. The "result | error" union mirrors
// what existing actions already return — wrappers don't change the action
// contract.
//
// Actions wired through useActionState with the `{ error?: string }` state
// shape (time/do/habits/projects forms) don't use these wrappers; they import
// resolveActiveUserId() directly. Don't add per-file requireUserId() helpers.

import "server-only";
import { runAsActor } from "@/lib/actor";
import {
  assertFinanceVisible,
  requireHomeViewer,
  resolveActiveUserId,
} from "@/lib/viewer-context";

export type ActionError = { ok: false; error: string };
export type ActionOk<T = void> = T extends void ? { ok: true } : { ok: true } & T;

function toErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

async function runWithUser<T>(
  resolveUserId: () => Promise<string>,
  handler: (userId: string) => Promise<T>,
  fallbackMessage: string,
): Promise<T | ActionError> {
  let userId: string;
  try {
    userId = await resolveUserId();
  } catch (error) {
    return { ok: false, error: toErrorMessage(error, "Not signed in.") };
  }

  try {
    return await handler(userId);
  } catch (error) {
    return { ok: false, error: toErrorMessage(error, fallbackMessage) };
  }
}

export async function withViewer<T>(
  handler: (userId: string) => Promise<T>,
  fallbackMessage = "Could not complete the request.",
): Promise<T | ActionError> {
  return runWithUser(resolveActiveUserId, handler, fallbackMessage);
}

/**
 * Finance actions get the finance scope (household or "Just me"), and run as
 * the viewer so household events record who acted.
 */
export async function withFinanceUser<T>(
  handler: (userId: string) => Promise<T>,
  fallbackMessage = "Could not complete the request.",
): Promise<T | ActionError> {
  let actorUserId = "";
  return runWithUser(
    async () => {
      const context = await assertFinanceVisible();
      actorUserId = context.ownerUserId;
      return context.financeUserId;
    },
    (userId) => runAsActor(actorUserId, () => handler(userId)),
    fallbackMessage,
  );
}

/** Home-tool actions: household scope + the acting person's id. */
export async function withHomeUser<T>(
  handler: (scope: { userId: string; actorUserId: string }) => Promise<T>,
  fallbackMessage = "Could not complete the request.",
): Promise<T | ActionError> {
  let actorUserId = "";
  return runWithUser(
    async () => {
      const context = await requireHomeViewer();
      actorUserId = context.ownerUserId;
      return context.homeUserId;
    },
    (userId) => runAsActor(actorUserId, () => handler({ userId, actorUserId })),
    fallbackMessage,
  );
}
