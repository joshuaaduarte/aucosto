// Issue and check personal Shortcut keys (see src/lib/finance-shortcut.ts).
// Keys belong to a person, not a finance scope: entries land in that
// person's current finance space (the household, when they're in one).

import "server-only";
import { findLatestEvent, recordEvent } from "@/lib/services/events";
import { buildShortcutKey, shortcutKeyMatches, shortcutKeyUserId } from "@/lib/finance-shortcut";

const KEY_EVENT = "finance.shortcut_key_created";

function secret(): string {
  const value = process.env.AUTH_SECRET?.trim();
  if (!value) throw new Error("AUTH_SECRET is not set.");
  return value;
}

/** Make a new key for this person; older keys stop working. */
export async function createShortcutKey(personUserId: string): Promise<string> {
  await recordEvent({ userId: personUserId, tool: "finance", type: KEY_EVENT });
  const latest = await findLatestEvent(personUserId, KEY_EVENT);
  if (!latest) throw new Error("Could not create a key.");
  return buildShortcutKey(secret(), personUserId, latest.id);
}

/** Whether this person has made a key (to word the settings panel). */
export async function hasShortcutKey(personUserId: string): Promise<boolean> {
  return (await findLatestEvent(personUserId, KEY_EVENT).catch(() => null)) !== null;
}

/** The person a key belongs to, or null if it's wrong or was replaced. */
export async function verifyShortcutKey(key: string): Promise<string | null> {
  const userId = shortcutKeyUserId(key);
  if (!userId) return null;
  const latest = await findLatestEvent(userId, KEY_EVENT).catch(() => null);
  if (!latest) return null;
  return shortcutKeyMatches(secret(), key, userId, latest.id) ? userId : null;
}
