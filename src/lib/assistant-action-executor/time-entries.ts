// Assistant action executor — Time-entry actions (edit, log, batch backfill, delete).
// (Split out of the former single-file assistant-action-executor.ts.)

import "server-only";
import { updateEntry, listRecentEntries, createPastEntry, deleteEntry, getTimeEntry } from "@/lib/services/time";
import { setEntryPeople, listEntryPeople, clearEntryPeople } from "@/lib/services/time-people";
import { setEntryCalendarLink, suggestCalendarLinkForRange, type CalendarLinkSuggestion } from "@/lib/services/time-calendar";
import { listPersons } from "@/lib/services/rolodex";
import { DeleteTimeEntryInput, EditTimeEntryInput, LogTimeEntriesInput, LogTimeEntryInput } from "./schemas";
import { coerceCalendarSuggestion, err, err2, fmtClock, fmtMinutes, formatZodError, idNotFound, localDatePart, resolveCalendarLinkInput, resolveCategoryName, resolvePeopleByNames, zodErr } from "./shared";
import { ExecuteResult, LogTimeEntryBatchResult, PreviewResult } from "./types";

export async function previewEditTimeEntry(
  userId: string,
  raw: unknown,
): Promise<PreviewResult> {
  const parsed = EditTimeEntryInput.safeParse(raw);
  if (!parsed.success) {
    return zodErr(parsed.error);
  }
  const { entryId, title, startedAt, endedAt, categoryName, personNames } = parsed.data;
  const warnings: string[] = [];

  if (startedAt && Number.isNaN(new Date(startedAt).getTime())) {
    return err(
      `Invalid startedAt "${startedAt}" — must be an ISO datetime string (e.g. 2026-10-16T09:00:00)`,
    );
  }
  if (endedAt && Number.isNaN(new Date(endedAt).getTime())) {
    return err(
      `Invalid endedAt "${endedAt}" — must be an ISO datetime string (e.g. 2026-10-16T10:00:00)`,
    );
  }

  // Look up existing entry for before/after preview (any age, not just recent).
  const existing = await getTimeEntry(userId, entryId);
  if (!existing) {
    return err(
      idNotFound("Time entry", entryId, "copy the id from the Time view"),
    );
  }

  if (title === undefined && startedAt === undefined && endedAt === undefined && categoryName === undefined && personNames === undefined) {
    return err(
      "No changes specified — pass at least one of: title, startedAt, endedAt, categoryName, personNames",
    );
  }

  const afterStart = startedAt ? new Date(startedAt) : existing.startedAt;
  const afterEnd = endedAt ? new Date(endedAt) : existing.endedAt;

  if (afterEnd && afterEnd <= afterStart) {
    return err("End time must be after start time");
  }
  if (
    afterEnd &&
    afterEnd.getTime() - afterStart.getTime() > 24 * 60 * 60 * 1000
  ) {
    return err("Entries are capped at 24 hours");
  }

  const beforeStart = fmtClock(existing.startedAt);
  const beforeEnd = existing.endedAt ? fmtClock(existing.endedAt) : "running";
  const beforeDur = existing.endedAt
    ? fmtMinutes(Math.round((existing.endedAt.getTime() - existing.startedAt.getTime()) / 60000))
    : "–";

  const afterEndStr = afterEnd ? fmtClock(afterEnd) : "running";
  const afterDur = afterEnd
    ? fmtMinutes(Math.max(0, Math.round((afterEnd.getTime() - afterStart.getTime()) / 60000)))
    : "–";

  const label = title ?? existing.label;
  const lines = [
    `Edit time entry: ${label}`,
    `Before: ${beforeStart}–${beforeEnd} · ${beforeDur}`,
    `After: ${fmtClock(afterStart)}–${afterEndStr} · ${afterDur}`,
  ];

  let category: string | null = null;
  if (categoryName !== undefined) {
    const resolved = await resolveCategoryName(userId, categoryName);
    category = resolved.category;
    warnings.push(...resolved.warnings);
    lines.push(`Category: ${category ?? "(none)"}`);
  }

  // personNames uses replace semantics: the provided list becomes the full
  // linked set (pass [] to clear). Omitted => leave links untouched.
  let personIds: string[] | null = null;
  if (personNames !== undefined) {
    const resolved = await resolvePeopleByNames(userId, personNames);
    personIds = resolved.personIds;
    warnings.push(...resolved.warnings);
    lines.push(
      `People: ${resolved.labels.length > 0 ? resolved.labels.join(", ") : "(none — links cleared)"}`,
    );
  }

  return {
    ok: true,
    previewText: lines.join("\n"),
    normalizedInput: {
      entryId,
      title: title ?? null,
      startedAtIso: startedAt ?? null,
      endedAtIso: endedAt ?? null,
      category,
      categoryChanged: categoryName !== undefined,
      personIds,
    },
    warnings,
  };
}

export async function executeEditTimeEntry(
  userId: string,
  n: Record<string, unknown>,
): Promise<ExecuteResult> {
  const patch: Parameters<typeof updateEntry>[2] = {};
  if (n.title) patch.label = String(n.title);
  if (n.startedAtIso) patch.startedAt = new Date(String(n.startedAtIso));
  if (n.endedAtIso) patch.endedAt = new Date(String(n.endedAtIso));
  if (n.categoryChanged) patch.category = typeof n.category === "string" ? n.category : null;

  const updated = await updateEntry(userId, String(n.entryId), patch);
  if (!updated) return err2(`Time entry "${n.entryId}" not found`);
  if (Array.isArray(n.personIds)) {
    await setEntryPeople(
      userId,
      updated.id,
      n.personIds.filter((id): id is string => typeof id === "string"),
    );
  }
  return {
    ok: true,
    recordId: updated.id,
    recordType: "TimeEntry",
    summary: `Updated time entry "${updated.label}"`,
  };
}

/**
 * Per-item validation/normalization for log_time_entry and log_time_entries.
 * Person/category/calendar resolution reuses the exact same warn-and-skip
 * helpers every other timer action uses — never fails, never guesses.
 * Hard validation errors are reported with the entry index and title so a
 * batch caller knows exactly which item is broken.
 */
export interface ValidatedLogTimeEntry {
  title: string;
  startedAt: string; // ISO
  endedAt: string; // ISO
  category: string | null;
  notes: string | null;
  personIds: string[];
  calendarEventId: string | null;
  suggestedCalendarLink: CalendarLinkSuggestion | null;
  durationMinutes: number;
  /** e.g. `6:00 PM–7:30 PM · 1h 30m · with Ana · for "Standup"` */
  detailLine: string;
}

export async function validateLogTimeEntryInput(
  userId: string,
  raw: unknown,
  index: number,
  warnPrefix: string,
): Promise<
  | { ok: true; entry: ValidatedLogTimeEntry; warnings: string[] }
  | { ok: false; error: string }
> {
  const parsed = LogTimeEntryInput.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: `entries[${index}]: ${formatZodError(parsed.error)}` };
  }
  const { title, startedAt, endedAt, categoryName, notes, personNames, calendarEventId, calendarTitle } = parsed.data;
  const label = `entries[${index}] "${title}"`;

  const start = new Date(startedAt);
  const end = new Date(endedAt);
  if (Number.isNaN(start.getTime())) {
    return { ok: false, error: `${label}: Invalid startedAt "${startedAt}" — must be an ISO datetime string (e.g. 2026-10-16T09:00:00)` };
  }
  if (Number.isNaN(end.getTime())) {
    return { ok: false, error: `${label}: Invalid endedAt "${endedAt}" — must be an ISO datetime string (e.g. 2026-10-16T10:00:00)` };
  }
  if (end <= start) return { ok: false, error: `${label}: End time must be after start time.` };

  const warnings: string[] = [];
  let category: string | null = null;
  if (categoryName) {
    const resolved = await resolveCategoryName(userId, categoryName);
    category = resolved.category;
    warnings.push(...resolved.warnings);
  }
  let personIds: string[] = [];
  let peopleNote = "";
  if (personNames) {
    const resolved = await resolvePeopleByNames(userId, personNames);
    personIds = resolved.personIds;
    warnings.push(...resolved.warnings.map((w) => `${warnPrefix}${w}`));
    peopleNote =
      resolved.labels.length > 0 ? ` · with ${resolved.labels.join(", ")}` : "";
  }

  const calendarLink = await resolveCalendarLinkInput(userId, {
    calendarEventId,
    calendarTitle,
  });
  warnings.push(...calendarLink.warnings.map((w) => `${warnPrefix}${w}`));

  // Suggest a block the logged window overlaps — suggested only, never linked
  // without the assistant's explicit confirmation. Best-effort: a calendar
  // read failure must never break logging the entry.
  let suggestedCalendarLink: CalendarLinkSuggestion | null = null;
  if (!calendarLink.eventId) {
    try {
      suggestedCalendarLink = await suggestCalendarLinkForRange(userId, start, end);
    } catch (error) {
      console.error("[assistant] calendar suggestion failed", error);
    }
  }

  const durationMinutes = Math.round((end.getTime() - start.getTime()) / 60000);
  const detailLine = `${fmtClock(start)}–${fmtClock(end)} · ${fmtMinutes(durationMinutes)}${peopleNote}${calendarLink.linkedNote}`;
  const lines = [
    `Log time entry "${title}"`,
    detailLine,
  ];
  if (category) lines.push(`Category: ${category}`);
  if (notes) lines.push(`Notes: ${notes}`);

  return {
    ok: true,
    entry: {
      title,
      startedAt: start.toISOString(),
      endedAt: end.toISOString(),
      category,
      notes: notes ?? null,
      personIds,
      calendarEventId: calendarLink.eventId,
      suggestedCalendarLink,
      durationMinutes,
      detailLine,
    },
    warnings,
  };
}

export async function previewLogTimeEntry(
  userId: string,
  raw: unknown,
): Promise<PreviewResult> {
  const result = await validateLogTimeEntryInput(userId, raw, 0, "");
  if (!result.ok) return err(result.error);
  const { entry, warnings } = result;

  const lines = [`Log time entry "${entry.title}"`, entry.detailLine];
  if (entry.category) lines.push(`Category: ${entry.category}`);
  if (entry.notes) lines.push(`Notes: ${entry.notes}`);

  return {
    ok: true,
    previewText: lines.join("\n"),
    normalizedInput: {
      title: entry.title,
      startedAt: entry.startedAt,
      endedAt: entry.endedAt,
      category: entry.category,
      notes: entry.notes,
      personIds: entry.personIds,
      calendarEventId: entry.calendarEventId,
      suggestedCalendarLink: entry.suggestedCalendarLink,
    },
    warnings,
    suggestedCalendarLink: entry.suggestedCalendarLink,
  };
}

/** The DB write (plus people/calendar links) for one normalized log entry. */
export async function writeValidatedLogTimeEntry(
  userId: string,
  entry: {
    title: string;
    category: string | null;
    notes: string | null;
    startedAt: string;
    endedAt: string;
    personIds: string[];
    calendarEventId: string | null;
  },
) {
  const created = await createPastEntry(userId, {
    label: entry.title,
    category: entry.category,
    notes: entry.notes,
    startedAt: new Date(entry.startedAt),
    endedAt: new Date(entry.endedAt),
  });
  if (entry.personIds.length > 0) {
    await setEntryPeople(
      userId,
      created.id,
      entry.personIds.filter((id): id is string => typeof id === "string"),
    );
  }
  if (entry.calendarEventId) {
    await setEntryCalendarLink(userId, created.id, entry.calendarEventId);
  }
  return created;
}

export async function executeLogTimeEntry(
  userId: string,
  n: Record<string, unknown>,
): Promise<ExecuteResult> {
  // Input was validated and normalized by previewLogTimeEntry.
  const entry = await writeValidatedLogTimeEntry(userId, {
    title: String(n.title),
    category: typeof n.category === "string" ? n.category : null,
    notes: typeof n.notes === "string" ? n.notes : null,
    startedAt: String(n.startedAt),
    endedAt: String(n.endedAt),
    personIds: Array.isArray(n.personIds) ? n.personIds : [],
    calendarEventId:
      typeof n.calendarEventId === "string" && n.calendarEventId
        ? n.calendarEventId
        : null,
  });
  return {
    ok: true,
    recordId: entry.id,
    recordType: "TimeEntry",
    summary: `Logged time entry "${entry.label}"`,
    suggestedCalendarLink: coerceCalendarSuggestion(n.suggestedCalendarLink),
  };
}

/**
 * Validate EVERY entry before writing ANY (all-or-nothing): one bad entry
 * rejects the whole batch with per-entry errors, so a confirmed batch can
 * never half-apply from bad input.
 */
export async function previewLogTimeEntries(
  userId: string,
  raw: unknown,
): Promise<PreviewResult> {
  const parsed = LogTimeEntriesInput.safeParse(raw);
  if (!parsed.success) {
    return err(parsed.error.issues[0]?.message ?? "Invalid input");
  }
  const { entries } = parsed.data;

  const normalized: ValidatedLogTimeEntry[] = [];
  const errors: string[] = [];
  const warnings: string[] = [];
  let totalMinutes = 0;
  for (let i = 0; i < entries.length; i++) {
    const result = await validateLogTimeEntryInput(userId, entries[i], i, `[${i}] `);
    if (result.ok) {
      normalized.push(result.entry);
      warnings.push(...result.warnings);
      totalMinutes += result.entry.durationMinutes;
    } else {
      errors.push(result.error);
    }
  }
  if (errors.length > 0) {
    return err(
      `No entries logged — ${errors.length} of ${entries.length} failed validation:\n${errors.join("\n")}`,
    );
  }

  const lines = [
    `Log ${entries.length} time ${entries.length === 1 ? "entry" : "entries"} (${fmtMinutes(totalMinutes)} total)`,
  ];
  for (let i = 0; i < normalized.length; i++) {
    const e = normalized[i]!;
    lines.push(
      `[${i}] "${e.title}" · ${e.detailLine}${e.category ? ` · ${e.category}` : ""}`,
    );
  }

  return {
    ok: true,
    previewText: lines.join("\n"),
    normalizedInput: {
      entries: normalized.map((e) => ({
        title: e.title,
        startedAt: e.startedAt,
        endedAt: e.endedAt,
        category: e.category,
        notes: e.notes,
        personIds: e.personIds,
        calendarEventId: e.calendarEventId,
        suggestedCalendarLink: e.suggestedCalendarLink,
      })),
    },
    warnings,
  };
}

/**
 * Write all entries in order. Validation already ran all-or-nothing in the
 * preview step, so write failures here are exceptional (DB errors); each is
 * reported with its index and title alongside the ones that succeeded —
 * never silently dropped.
 */
export async function executeLogTimeEntries(
  userId: string,
  n: Record<string, unknown>,
): Promise<ExecuteResult> {
  // Input was validated and normalized by previewLogTimeEntries.
  const entries = (Array.isArray(n.entries) ? n.entries : []) as Array<{
    title: string;
    category: string | null;
    notes: string | null;
    startedAt: string;
    endedAt: string;
    personIds: string[];
    calendarEventId: string | null;
  }>;

  const results: LogTimeEntryBatchResult[] = [];
  let okCount = 0;
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i]!;
    try {
      const created = await writeValidatedLogTimeEntry(userId, e);
      results.push({ index: i, title: e.title, recordId: created.id });
      okCount++;
    } catch (error) {
      results.push({
        index: i,
        title: e.title,
        recordId: null,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const totalMinutes = entries.reduce(
    (sum, e) =>
      sum +
      Math.round(
        (new Date(e.endedAt).getTime() - new Date(e.startedAt).getTime()) / 60000,
      ),
    0,
  );

  if (okCount === entries.length) {
    return {
      ok: true,
      recordId: null,
      recordType: "TimeEntry",
      summary: `Logged ${entries.length} time ${entries.length === 1 ? "entry" : "entries"} (${fmtMinutes(totalMinutes)} total)`,
      entries: results,
    };
  }

  const failures = results
    .filter((r) => r.recordId === null)
    .map((r) => `[${r.index}] "${r.title}": ${r.error}`)
    .join("; ");
  return {
    ok: false,
    error: `Logged ${okCount} of ${entries.length} time entries — ${entries.length - okCount} failed: ${failures}`,
    recordId: null,
    recordType: "TimeEntry",
    summary: "",
    entries: results,
  };
}

export async function previewDeleteTimeEntry(
  userId: string,
  raw: unknown,
): Promise<PreviewResult> {
  const parsed = DeleteTimeEntryInput.safeParse(raw);
  if (!parsed.success) {
    return err(parsed.error.issues[0]?.message ?? "Invalid input");
  }
  const { entryId } = parsed.data;

  // Same recent-window lookup as previewEditTimeEntry — only completed
  // entries are visible there, so a missing row means "not found" here too.
  const recent = await listRecentEntries(userId, { limit: 200 });
  const existing = recent.find((e) => e.id === entryId);
  if (!existing) {
    return err(`Time entry "${entryId}" not found`);
  }
  if (!existing.endedAt) {
    return err(
      `Time entry "${existing.label}" is a running timer — stop it with stop_timer before deleting`,
    );
  }

  const durationMin = Math.max(
    0,
    Math.round(
      (existing.endedAt.getTime() - existing.startedAt.getTime()) / 60000,
    ),
  );
  const lines = [
    `Delete time entry: ${existing.label}`,
    `${localDatePart(existing.startedAt)} ${fmtClock(existing.startedAt)}–${fmtClock(existing.endedAt)} · ${fmtMinutes(durationMin)}`,
    `Category: ${existing.category?.trim() || "uncategorized"}`,
  ];

  // Deleting the entry also destroys its people links — name them so the
  // confirmer knows exactly what will be destroyed.
  const personIds = await listEntryPeople(userId, entryId);
  if (personIds.length > 0) {
    let nameById = new Map<string, string>();
    try {
      const persons = await listPersons(userId);
      nameById = new Map(persons.map((p) => [p.id, p.displayName]));
    } catch {
      // Rolodex unavailable — fall back to raw person IDs below.
    }
    lines.push(
      `Linked people (links removed): ${personIds.map((id) => nameById.get(id) ?? id).join(", ")}`,
    );
  }

  return {
    ok: true,
    previewText: lines.join("\n"),
    normalizedInput: { entryId, beforeTitle: existing.label },
    warnings: [],
  };
}

export async function executeDeleteTimeEntry(
  userId: string,
  n: Record<string, unknown>,
): Promise<ExecuteResult> {
  // Input was validated and normalized by previewDeleteTimeEntry, which
  // refuses missing entries and running timers.
  const entryId = String(n.entryId);
  // Clear people links first so no orphaned rows remain in TimeEntryPerson.
  await clearEntryPeople(userId, entryId);
  await deleteEntry(userId, entryId);
  return {
    ok: true,
    recordId: entryId,
    recordType: "TimeEntry",
    summary: `Deleted time entry "${n.beforeTitle}"`,
  };
}
