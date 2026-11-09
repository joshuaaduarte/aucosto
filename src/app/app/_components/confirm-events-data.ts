import "server-only";
import { formatConfirmWhen } from "@/lib/confirm-events";
import { loadPendingConfirmations } from "@/lib/event-confirmations";
import type { ConfirmRow } from "./confirm-events-card";

/** Rows for the "Did these happen?" card. Never throws. */
export async function loadConfirmRows(
  userId: string,
  now: Date,
  limit = 6,
): Promise<ConfirmRow[]> {
  const pending = await loadPendingConfirmations(userId, now, { limit });
  return pending.map((row) => ({
    id: row.id,
    title: row.title,
    when: formatConfirmWhen(row, now),
    minutes: row.minutes,
    linked: row.sourceTool === "feed",
  }));
}
