// "Did this happen?" orchestrator: ended calendar events become time
// entries with one tap. Composes the calendar, time, time-calendar and
// events services only (no prisma here). Pure rules live in
// src/lib/confirm-events.ts.

import "server-only";
import {
  pendingConfirmations,
  type PendingConfirmation,
} from "@/lib/confirm-events";
import {
  backingCalendarItemId,
  getCalendarItemCategoryIds,
  listCalendarItems,
} from "@/lib/services/calendar";
import { listEventsOfTypeSince, recordEvent } from "@/lib/services/events";
import { createPastEntry, listEntriesBetween } from "@/lib/services/time";
import { setEntryCalendarLink } from "@/lib/services/time-calendar";
import { listTimeCategories } from "@/lib/services/time-categories";

export const CONFIRM_SKIPPED_EVENT = "calendar.confirm_skipped";
export const CONFIRM_LOGGED_EVENT = "calendar.confirm_logged";

function startOfYesterday(now: Date) {
  const day = new Date(now);
  day.setDate(day.getDate() - 1);
  day.setHours(0, 0, 0, 0);
  return day;
}

/** Ended, uncovered events since the start of yesterday. Never throws. */
export async function loadPendingConfirmations(
  userId: string,
  now: Date = new Date(),
  options: { limit?: number; since?: Date } = {},
): Promise<PendingConfirmation[]> {
  const since = options.since ?? startOfYesterday(now);
  try {
    const [events, entries, skips] = await Promise.all([
      listCalendarItems(userId, { from: since, to: now }),
      listEntriesBetween(userId, { from: since, to: now }),
      listEventsOfTypeSince(userId, CONFIRM_SKIPPED_EVENT, since),
    ]);
    return pendingConfirmations({
      events: events.map((event) => ({
        id: event.id,
        backingId: backingCalendarItemId(event.id),
        title: event.title,
        startsAt: event.startsAt,
        endsAt: event.endsAt,
        allDay: event.allDay,
        status: event.status,
        sourceTool: event.sourceTool,
      })),
      entries: entries.map((entry) => ({
        startedAt: entry.startedAt,
        endedAt: entry.endedAt,
        calendarEventId: entry.calendarEventId ?? null,
      })),
      skippedIds: new Set(skips.map((skip) => skip.refId).filter((id): id is string => Boolean(id))),
      now,
      since,
      limit: options.limit,
    });
  } catch (error) {
    console.error("[confirmations] load failed", error);
    return [];
  }
}

/**
 * Log one ended event as a time entry linked to it. Times default to the
 * event's own; the label is its title and the category comes from the
 * calendar block's category when it has one.
 */
export async function confirmCalendarEvent(
  userId: string,
  occurrenceId: string,
  now: Date = new Date(),
): Promise<{ entryId: string; title: string }> {
  const since = new Date(now);
  since.setDate(since.getDate() - 7);
  const occurrences = await listCalendarItems(userId, { from: since, to: now });
  const event = occurrences.find((item) => item.id === occurrenceId);
  if (!event) throw new Error("That event isn't on your calendar any more.");
  if (event.endsAt > now) throw new Error("That event hasn't ended yet.");

  const [categoryIds, categories] = await Promise.all([
    getCalendarItemCategoryIds(userId, [event.id]),
    listTimeCategories(userId, { includeHidden: true }),
  ]);
  const categoryId = categoryIds.get(event.id) ?? null;
  const category = categoryId
    ? (categories.find((record) => record.id === categoryId)?.name ?? null)
    : null;

  const entry = await createPastEntry(userId, {
    label: event.title,
    category,
    doItemId: event.sourceTool === "do" ? event.sourceRefId : null,
    habitId: event.sourceTool === "habit" ? event.sourceRefId : null,
    startedAt: event.startsAt,
    endedAt: event.endsAt,
  });
  await setEntryCalendarLink(userId, entry.id, event.id);
  await recordEvent({
    userId,
    tool: "calendar",
    type: CONFIRM_LOGGED_EVENT,
    refId: event.id,
    meta: { title: event.title, entryId: entry.id },
  });
  return { entryId: entry.id, title: event.title };
}

/** "Didn't happen" — remembered so the prompt doesn't come back. */
export async function skipCalendarEvent(userId: string, occurrenceId: string): Promise<void> {
  await recordEvent({
    userId,
    tool: "calendar",
    type: CONFIRM_SKIPPED_EVENT,
    refId: occurrenceId,
  });
}
