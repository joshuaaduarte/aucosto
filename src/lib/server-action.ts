// Shared shape + auth helpers for finance Server Actions.
//
// Every finance action needs the same two things at the top:
//   1. resolve the userId via assertFinanceVisible() (which can throw)
//   2. translate thrown errors into a serializable `{ ok: false, error }` shape
//
// withFinanceUser does both so individual actions can focus on validation +
// the service call. The "result | error" union mirrors what existing actions
// already return — wrappers don't change the action contract.

import "server-only";
import { assertFinanceVisible } from "@/lib/viewer-context";

export type ActionError = { ok: false; error: string };
export type ActionOk<T = void> = T extends void ? { ok: true } : { ok: true } & T;

function toErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

export async function withFinanceUser<T>(
  handler: (userId: string) => Promise<T>,
  fallbackMessage = "Could not complete the request.",
): Promise<T | ActionError> {
  let userId: string;
  try {
    const context = await assertFinanceVisible();
    userId = context.effectiveUserId;
  } catch (error) {
    return { ok: false, error: toErrorMessage(error, "Not signed in.") };
  }

  try {
    return await handler(userId);
  } catch (error) {
    return { ok: false, error: toErrorMessage(error, fallbackMessage) };
  }
}
