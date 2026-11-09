import "server-only";
import { deriveStaleData, type StaleNotice } from "@/lib/data-freshness";
import { listCalendarFeeds } from "@/lib/services/calendar-feeds";
import { findLatestEvent, listEventsByTool } from "@/lib/services/events";

/**
 * Notices for outside data that stopped arriving (calendar links, Apple
 * Health, Money). Cosmetic: never throws, an unreadable source is skipped.
 */
export async function loadStaleNotices(input: {
  userId: string;
  financeUserId: string;
  financeVisible: boolean;
  accountCount: number;
  /** Habits tied to an Apple Health measure (already loaded by the hub). */
  healthLinkedHabitCount: number;
  now: Date;
}): Promise<StaleNotice[]> {
  try {
    const [feeds, lastHealth, lastMoney] = await Promise.all([
      listCalendarFeeds(input.userId).catch(() => null),
      input.healthLinkedHabitCount > 0
        ? findLatestEvent(input.userId, "habit.health_synced").catch(() => null)
        : Promise.resolve(null),
      input.financeVisible && input.accountCount > 0
        ? listEventsByTool(input.financeUserId, ["finance"], { limit: 1 }).catch(() => [])
        : Promise.resolve([]),
    ]);
    return deriveStaleData({
      now: input.now,
      calendarFeeds: feeds,
      health: {
        linkedHabitCount: input.healthLinkedHabitCount,
        lastSyncedAt: lastHealth?.at ?? null,
      },
      money: {
        visible: input.financeVisible,
        accountCount: input.accountCount,
        lastEntryAt: lastMoney[0]?.at ?? null,
      },
    });
  } catch (error) {
    console.error("[hub] stale data check failed", error);
    return [];
  }
}
