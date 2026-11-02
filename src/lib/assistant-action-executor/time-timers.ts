// Assistant action executor — Running-timer actions (start, stop, swap).
// (Split out of the former single-file assistant-action-executor.ts.)

import "server-only";
import { getRunningEntry, startEntry, stopRunning, updateEntry } from "@/lib/services/time";
import { setEntryPeople } from "@/lib/services/time-people";
import { setEntryCalendarLink, suggestCalendarLinkForStart, type CalendarLinkSuggestion } from "@/lib/services/time-calendar";
import { StartTimerInput, StopTimerInput, SwapTimerInput } from "./schemas";
import { coerceCalendarSuggestion, err, fmtClock, fmtMinutes, optionalNameWarning, resolveCalendarLinkInput, resolveCategoryName, resolveHabitByName, resolvePeopleByNames, zodErr } from "./shared";
import { ExecuteResult, PreviewResult } from "./types";

export async function previewStartTimer(
  userId: string,
  raw: unknown,
): Promise<PreviewResult> {
  const parsed = StartTimerInput.safeParse(raw);
  if (!parsed.success) {
    return zodErr(parsed.error);
  }
  const { title, categoryName, habitName, personNames, calendarEventId, calendarTitle } = parsed.data;
  const warnings: string[] = [];
  let habitId: string | null = null;

  if (habitName) {
    const resolved = await resolveHabitByName(userId, habitName);
    const warning = optionalNameWarning(resolved, {
      label: "habit",
      input: habitName,
      nameOf: (h) => h.title,
      skipNote: "Timer will start without a habit link.",
    });
    if (warning) {
      warnings.push(warning);
    } else {
      habitId = resolved.match.match!.id;
    }
  }

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
    warnings.push(...resolved.warnings);
    peopleNote =
      resolved.labels.length > 0 ? ` · with ${resolved.labels.join(", ")}` : "";
  }

  const calendarLink = await resolveCalendarLinkInput(userId, {
    calendarEventId,
    calendarTitle,
  });
  warnings.push(...calendarLink.warnings);

  // Suggest a block when starting near its start — suggested only, never
  // linked without the assistant's explicit confirmation. Best-effort: a
  // calendar read failure must never break starting the timer.
  let suggestedCalendarLink: CalendarLinkSuggestion | null = null;
  if (!calendarLink.eventId) {
    try {
      suggestedCalendarLink = await suggestCalendarLinkForStart(userId);
    } catch (error) {
      console.error("[assistant] calendar suggestion failed", error);
    }
  }

  const running = await getRunningEntry(userId);
  const stopNote = running ? ` (stops running timer: "${running.label}")` : "";

  return {
    ok: true,
    previewText: `Start timer "${title}"${category ? ` [${category}]` : ""}${peopleNote}${calendarLink.linkedNote}${stopNote}`,
    normalizedInput: {
      title,
      category,
      habitId,
      personIds,
      calendarEventId: calendarLink.eventId,
      suggestedCalendarLink,
    },
    warnings,
    suggestedCalendarLink,
  };
}

export async function previewStopTimer(
  userId: string,
  raw: unknown,
): Promise<PreviewResult> {
  const parsed = StopTimerInput.safeParse(raw);
  if (!parsed.success) {
    return zodErr(parsed.error);
  }
  const { entryId, endedAtLocal, note } = parsed.data;

  const running = await getRunningEntry(userId);
  if (!running) return err("No timer is currently running");

  if (entryId && entryId !== running.id) {
    return err(
      `entryId "${entryId}" does not match the running timer "${running.label}" (id "${running.id}") — pass entryId "${running.id}" or omit entryId to stop the running timer`,
    );
  }

  const now = new Date();
  // Interpret endedAtLocal in server TZ (pinned by instrumentation.ts to APP_TIMEZONE)
  const proposedEnd = endedAtLocal ? new Date(endedAtLocal) : now;

  if (Number.isNaN(proposedEnd.getTime())) {
    return err("Invalid endedAtLocal — must be a datetime string like '2024-06-24T09:15:00'");
  }
  if (proposedEnd.getTime() > now.getTime() + 60_000) {
    return err("Stop time cannot be in the future");
  }

  const elapsedMs = now.getTime() - running.startedAt.getTime();
  const elapsedMin = Math.round(elapsedMs / 60000);
  const proposedDurationMs = proposedEnd.getTime() - running.startedAt.getTime();
  const proposedDurationMin = Math.max(0, Math.round(proposedDurationMs / 60000));

  const startClock = fmtClock(running.startedAt);
  const proposedEndClock = fmtClock(proposedEnd);

  const lines = [
    `Stop timer: ${running.label}`,
    `Started: ${startClock} · Running for ${fmtMinutes(elapsedMin)}`,
    `Proposed end: ${proposedEndClock}`,
    `Final duration: ${fmtMinutes(proposedDurationMin)}`,
  ];
  if (note && note.trim().length > 0) {
    lines.push(`Note: "${note.slice(0, 80)}${note.length > 80 ? "…" : ""}"`);
  }

  return {
    ok: true,
    previewText: lines.join("\n"),
    normalizedInput: {
      entryId: running.id,
      endedAtIso: proposedEnd.toISOString(),
      note: note ?? null,
    },
    warnings: [],
  };
}

export async function previewSwapTimer(
  userId: string,
  raw: unknown,
): Promise<PreviewResult> {
  const parsed = SwapTimerInput.safeParse(raw);
  if (!parsed.success) {
    return zodErr(parsed.error);
  }
  const { title, note, categoryName, habitName, personNames } = parsed.data;
  const warnings: string[] = [];
  let habitId: string | null = null;

  if (habitName) {
    const resolved = await resolveHabitByName(userId, habitName);
    const warning = optionalNameWarning(resolved, {
      label: "habit",
      input: habitName,
      nameOf: (h) => h.title,
      skipNote: "Timer will start without a habit link.",
    });
    if (warning) {
      warnings.push(warning);
    } else {
      habitId = resolved.match.match!.id;
    }
  }

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
    warnings.push(...resolved.warnings);
    peopleNote =
      resolved.labels.length > 0 ? ` · with ${resolved.labels.join(", ")}` : "";
  }

  const running = await getRunningEntry(userId);

  // No timer running: this is just a start; the note has nowhere to go.
  if (!running) {
    if (note !== undefined) {
      warnings.push("No timer is currently running — the note will be ignored");
    }
    return {
      ok: true,
      previewText: `Start timer "${title}"${category ? ` [${category}]` : ""}${peopleNote}`,
      normalizedInput: {
        title,
        category,
        habitId,
        personIds,
        note: null,
        stoppedEntryId: null,
        stoppedLabel: null,
      },
      warnings,
    };
  }

  const elapsedMin = Math.round(
    (Date.now() - running.startedAt.getTime()) / 60000,
  );
  const lines = [
    `Stop "${running.label}" (running ${fmtMinutes(elapsedMin)}) and start "${title}"${category ? ` [${category}]` : ""}${peopleNote}`,
  ];
  if (note !== undefined && note.trim().length > 0) {
    lines.push(
      `Note saved on stopped entry: "${note.slice(0, 80)}${note.length > 80 ? "…" : ""}"`,
    );
  }

  return {
    ok: true,
    previewText: lines.join("\n"),
    normalizedInput: {
      title,
      category,
      habitId,
      personIds,
      note: note ?? null,
      stoppedEntryId: running.id,
      stoppedLabel: running.label,
    },
    warnings,
  };
}

export async function executeStartTimer(
  userId: string,
  n: Record<string, unknown>,
): Promise<ExecuteResult> {
  const entry = await startEntry(userId, {
    label: String(n.title),
    category: n.category ? String(n.category) : null,
    habitId: n.habitId ? String(n.habitId) : null,
  });
  if (Array.isArray(n.personIds) && n.personIds.length > 0) {
    await setEntryPeople(
      userId,
      entry.id,
      n.personIds.filter((id): id is string => typeof id === "string"),
    );
  }
  if (typeof n.calendarEventId === "string" && n.calendarEventId) {
    await setEntryCalendarLink(userId, entry.id, n.calendarEventId);
  }
  return {
    ok: true,
    recordId: entry.id,
    recordType: "TimeEntry",
    summary: `Started timer "${entry.label}"`,
    suggestedCalendarLink: coerceCalendarSuggestion(n.suggestedCalendarLink),
  };
}

export async function executeStopTimer(
  userId: string,
  n: Record<string, unknown>,
): Promise<ExecuteResult> {
  const endedAt = n.endedAtIso ? new Date(String(n.endedAtIso)) : undefined;
  await stopRunning(userId, endedAt);
  return {
    ok: true,
    recordId: null,
    recordType: "TimeEntry",
    summary: "Stopped running timer",
  };
}

// Stop the currently running timer (if any) and start a new one back-to-back.
// The new timer starts at the exact instant the old one stopped — no gap, no
// overlap. The `note` is saved onto the stopped entry.
export async function executeSwapTimer(
  userId: string,
  n: Record<string, unknown>,
): Promise<ExecuteResult> {
  // Re-resolve at execute time: whatever is running *now* is what gets stopped.
  const now = new Date();
  const running = await getRunningEntry(userId);

  let stoppedLabel: string | null = null;
  if (running) {
    await stopRunning(userId, now);
    if (typeof n.note === "string" && n.note.trim().length > 0) {
      await updateEntry(userId, running.id, { notes: n.note });
    }
    stoppedLabel = running.label;
  }

  const entry = await startEntry(userId, {
    label: String(n.title),
    category: n.category ? String(n.category) : null,
    habitId: n.habitId ? String(n.habitId) : null,
    startedAt: now,
  });
  if (Array.isArray(n.personIds) && n.personIds.length > 0) {
    await setEntryPeople(
      userId,
      entry.id,
      n.personIds.filter((id): id is string => typeof id === "string"),
    );
  }

  const summary = stoppedLabel
    ? `Stopped "${stoppedLabel}" and started "${entry.label}"`
    : `Started "${entry.label}" (no timer was running)`;
  return {
    ok: true,
    recordId: entry.id,
    recordType: "TimeEntry",
    summary,
  };
}
