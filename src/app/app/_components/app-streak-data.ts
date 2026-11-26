import "server-only";
import {
  buildStreakView,
  PARTNER_STREAK_AREAS,
  showUpDayKeys,
  streakWindowStart,
  type StreakView,
} from "@/lib/app-streak";
import { listUsageEvents } from "@/lib/services/events";
import { listRestDays } from "@/lib/services/streaks";
import type { ViewerContext } from "@/lib/viewer-context";

/**
 * The viewer's weekly app streak for the hub (or a partner's Home page).
 * Cosmetic: never throws — an unreadable event log just hides the line.
 */
export async function loadAppStreak(
  context: Pick<
    ViewerContext,
    "effectiveUserId" | "householdUserId" | "isDemoMode" | "role"
  >,
  now: Date,
): Promise<StreakView | null> {
  try {
    const personId = context.effectiveUserId;
    const household =
      context.householdUserId && !context.isDemoMode ? context.householdUserId : null;
    const owners = household ? [personId, household] : [personId];
    const from = streakWindowStart(now);
    const [events, restDays] = await Promise.all([
      listUsageEvents(owners, from, now),
      listRestDays(personId, from),
    ]);
    const areas = context.role === "partner" ? PARTNER_STREAK_AREAS : null;
    return buildStreakView({ activeDays: showUpDayKeys(events, personId, areas), restDays, now });
  } catch (error) {
    console.error("app streak: could not load", error);
    return null;
  }
}
