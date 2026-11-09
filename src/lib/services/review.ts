// Weekly review records. A saved review is one "review.saved" event (see
// src/lib/weekly-review.ts for the meta shape), so this service only reads
// and writes the event log. The review page's action does the cross-tool
// work (moving the picked tasks, ticking the "Weekly review" habit) through
// the do and habits services.

import "server-only";
import { requireCan } from "@/lib/auth/can";
import { listEventsOfTypeSince, recordEvent } from "@/lib/services/events";
import { parseSavedReview, type SavedReview } from "@/lib/weekly-review";

const REVIEW_SAVED = "review.saved";

/** Reviews saved since `since`, newest first. Empty on failure (cosmetic). */
export async function listSavedReviews(userId: string, since: Date): Promise<SavedReview[]> {
  requireCan(userId, "review", "read");
  try {
    const events = await listEventsOfTypeSince(userId, REVIEW_SAVED, since, { limit: 50 });
    return events.flatMap((event) => {
      const review = parseSavedReview(event.meta, event.at);
      return review ? [review] : [];
    });
  } catch (error) {
    console.error("listSavedReviews failed", error);
    return [];
  }
}

export async function recordSavedReview(
  userId: string,
  review: Omit<SavedReview, "at">,
): Promise<void> {
  requireCan(userId, "review", "write");
  await recordEvent({
    userId,
    tool: "review",
    type: REVIEW_SAVED,
    refId: review.reviewedWeek,
    meta: {
      reviewedWeek: review.reviewedWeek,
      forWeek: review.forWeek,
      priorities: review.priorities,
      note: review.note,
    },
  });
}
