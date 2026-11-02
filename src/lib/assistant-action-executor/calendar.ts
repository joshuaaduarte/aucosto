// Assistant action executor — Calendar actions.
// (Split out of the former single-file assistant-action-executor.ts.)

import "server-only";
import { createCalendarItem, getCalendarItem, updateCalendarItem, deleteCalendarItem } from "@/lib/services/calendar";
import { CreateCalendarBlockInput, DeleteCalendarEventInput, UpdateCalendarEventInput } from "./schemas";
import { err, err2, idNotFound, localDatePart, localTimePart, parseLocalDateTimeStrict, zodErr } from "./shared";
import { ExecuteResult, PreviewResult } from "./types";

export async function previewCreateCalendarBlock(
  _userId: string,
  raw: unknown,
): Promise<PreviewResult> {
  const parsed = CreateCalendarBlockInput.safeParse(raw);
  if (!parsed.success) {
    return zodErr(parsed.error);
  }
  const { title, date, startTime, endTime, notes } = parsed.data;

  const startsAt = parseLocalDateTimeStrict(date, startTime);
  if (!startsAt.ok) return err(`Invalid startTime: ${startsAt.error}`);
  const endsAt = parseLocalDateTimeStrict(date, endTime);
  if (!endsAt.ok) return err(`Invalid endTime: ${endsAt.error}`);
  if (endsAt.date <= startsAt.date) {
    return err(
      `End time must be after start time (got ${startTime}–${endTime} on ${date})`,
    );
  }

  return {
    ok: true,
    previewText: `Create calendar block "${title}" on ${date} ${startTime}–${endTime}`,
    normalizedInput: {
      title,
      startsAtIso: startsAt.date.toISOString(),
      endsAtIso: endsAt.date.toISOString(),
      notes: notes ?? null,
    },
    warnings: [],
  };
}

export async function previewUpdateCalendarEvent(
  userId: string,
  raw: unknown,
): Promise<PreviewResult> {
  const parsed = UpdateCalendarEventInput.safeParse(raw);
  if (!parsed.success) {
    return zodErr(parsed.error);
  }
  const { eventId, title, date, startTime, endTime, notes, location } = parsed.data;

  const item = await getCalendarItem(userId, eventId);
  if (!item) {
    return err(
      idNotFound(
        "Calendar event",
        eventId,
        "list events via GET /api/assistant/calendar to get a valid event id",
      ),
    );
  }

  const newDate = date ?? localDatePart(item.startsAt);
  const newStartTime = startTime ?? localTimePart(item.startsAt);
  const newEndTime = endTime ?? localTimePart(item.endsAt);
  const startsAt = parseLocalDateTimeStrict(newDate, newStartTime);
  if (!startsAt.ok) return err(`Invalid start time: ${startsAt.error}`);
  const endsAt = parseLocalDateTimeStrict(newDate, newEndTime);
  if (!endsAt.ok) return err(`Invalid end time: ${endsAt.error}`);
  if (endsAt.date <= startsAt.date) {
    return err(
      `End time must be after start time (got ${newStartTime}–${newEndTime} on ${newDate})`,
    );
  }

  const changes: string[] = [];
  if (title !== undefined && title !== item.title) changes.push(`title → "${title}"`);
  if (
    startsAt.date.getTime() !== item.startsAt.getTime() ||
    endsAt.date.getTime() !== item.endsAt.getTime()
  ) {
    changes.push(`time → ${newDate} ${newStartTime}–${newEndTime}`);
  }
  if (notes !== undefined) changes.push(`notes updated`);
  if (location !== undefined) changes.push(`location → ${location || "none"}`);
  if (changes.length === 0) {
    return err(
      "No changes specified — pass at least one of: title, date, startTime, endTime, notes, location",
    );
  }

  return {
    ok: true,
    previewText: `Update calendar event "${item.title}": ${changes.join(", ")}`,
    normalizedInput: {
      eventId,
      beforeTitle: item.title,
      title: title ?? null,
      startsAtIso: startsAt.date.toISOString(),
      endsAtIso: endsAt.date.toISOString(),
      timeChanged:
        startsAt.date.getTime() !== item.startsAt.getTime() ||
        endsAt.date.getTime() !== item.endsAt.getTime(),
      notes: notes ?? null,
      notesChanged: notes !== undefined,
      location: location ?? null,
      locationChanged: location !== undefined,
    },
    warnings: [],
  };
}

export async function previewDeleteCalendarEvent(
  userId: string,
  raw: unknown,
): Promise<PreviewResult> {
  const parsed = DeleteCalendarEventInput.safeParse(raw);
  if (!parsed.success) {
    return zodErr(parsed.error);
  }
  const { eventId } = parsed.data;

  const item = await getCalendarItem(userId, eventId);
  if (!item) {
    return err(
      idNotFound(
        "Calendar event",
        eventId,
        "list events via GET /api/assistant/calendar to get a valid event id",
      ),
    );
  }

  return {
    ok: true,
    previewText:
      `Delete calendar event "${item.title}" ` +
      `on ${localDatePart(item.startsAt)} ` +
      `${localTimePart(item.startsAt)}–${localTimePart(item.endsAt)}` +
      `\nThis permanently deletes the event. This cannot be undone.`,
    normalizedInput: { eventId, beforeTitle: item.title },
    warnings: [],
  };
}

export async function executeCreateCalendarBlock(
  userId: string,
  n: Record<string, unknown>,
): Promise<ExecuteResult> {
  const item = await createCalendarItem(userId, {
    title: String(n.title),
    startsAt: new Date(String(n.startsAtIso)),
    endsAt: new Date(String(n.endsAtIso)),
    notes: n.notes ? String(n.notes) : null,
    kind: "block",
  });
  return {
    ok: true,
    recordId: item.id,
    recordType: "CalendarItem",
    summary: `Created calendar block "${item.title}"`,
  };
}

export async function executeUpdateCalendarEvent(
  userId: string,
  n: Record<string, unknown>,
): Promise<ExecuteResult> {
  const patch: {
    title?: string;
    startsAt?: Date;
    endsAt?: Date;
    notes?: string | null;
    location?: string | null;
  } = {};
  if (n.title) patch.title = String(n.title);
  if (n.timeChanged) {
    patch.startsAt = new Date(String(n.startsAtIso));
    patch.endsAt = new Date(String(n.endsAtIso));
  }
  if (n.notesChanged) patch.notes = n.notes ? String(n.notes) : null;
  if (n.locationChanged) patch.location = n.location ? String(n.location) : null;

  const updated = await updateCalendarItem(userId, String(n.eventId), patch);
  if (!updated) return err2(`Calendar event "${n.eventId}" not found`);
  return {
    ok: true,
    recordId: updated.id,
    recordType: "CalendarItem",
    summary: `Updated calendar event "${updated.title}"`,
  };
}

export async function executeDeleteCalendarEvent(
  userId: string,
  n: Record<string, unknown>,
): Promise<ExecuteResult> {
  await deleteCalendarItem(userId, String(n.eventId));
  return {
    ok: true,
    recordId: String(n.eventId),
    recordType: "CalendarItem",
    summary: `Deleted calendar event "${n.beforeTitle}"`,
  };
}

// ── Person resolver ───────────────────────────────────────────────────────
