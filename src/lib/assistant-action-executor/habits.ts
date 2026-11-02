// Assistant action executor — Habit actions.
// (Split out of the former single-file assistant-action-executor.ts.)

import "server-only";
import { listHabits, logHabitProgress, createHabit } from "@/lib/services/habits";
import { CreateHabitInput, LogHabitInput } from "./schemas";
import { err2, requiredNameError, resolveHabitByName, zodErr } from "./shared";
import { ExecuteResult, PreviewResult } from "./types";

export async function previewLogHabit(
  userId: string,
  raw: unknown,
): Promise<PreviewResult> {
  const parsed = LogHabitInput.safeParse(raw);
  if (!parsed.success) {
    return zodErr(parsed.error);
  }
  const { habitName, value, note } = parsed.data;

  const resolved = await resolveHabitByName(userId, habitName);
  if (resolved.match.kind !== "exact") {
    return requiredNameError(resolved, {
      label: "habit",
      input: habitName,
      toCandidate: (h) => ({ id: h.id, name: h.title, bucket: h.bucket ?? "" }),
      nameOf: (h) => h.title,
      hint: "List habits via GET /api/assistant/habits.",
    });
  }

  const habit = resolved.match.match!;
  return {
    ok: true,
    previewText: `Log habit "${habit.title}"${value !== undefined ? ` (${value}x)` : ""}`,
    normalizedInput: {
      habitId: habit.id,
      habitTitle: habit.title,
      value: value ?? 1,
      note: note ?? null,
    },
    warnings: [],
  };
}

export async function previewCreateHabit(
  userId: string,
  raw: unknown,
): Promise<PreviewResult> {
  const parsed = CreateHabitInput.safeParse(raw);
  if (!parsed.success) {
    return zodErr(parsed.error);
  }
  const { title, cadence, dayPart, targetCount, goalUnit, notes, reminderTime } = parsed.data;

  const warnings: string[] = [];
  const habits = await listHabits(userId);
  if (habits.some((h) => h.title.toLowerCase() === title.trim().toLowerCase())) {
    warnings.push(`A habit named "${title.trim()}" already exists`);
  }

  const lines: string[] = [`Create habit "${title.trim()}"`];
  lines.push(`Cadence: ${cadence}${dayPart !== "anytime" ? ` · ${dayPart}` : ""}`);
  if (goalUnit !== "check" || targetCount !== undefined) {
    lines.push(`Goal: ${targetCount ?? 1} ${goalUnit}`);
  }
  if (reminderTime) lines.push(`Reminder: ${reminderTime}`);

  return {
    ok: true,
    previewText: lines.join("\n"),
    normalizedInput: {
      title: title.trim(),
      cadence,
      dayPart,
      targetCount: targetCount ?? null,
      goalUnit,
      notes: notes ?? null,
      reminderTime: reminderTime ?? null,
    },
    warnings,
  };
}

export async function executeLogHabit(
  userId: string,
  n: Record<string, unknown>,
): Promise<ExecuteResult> {
  const result = await logHabitProgress(userId, String(n.habitId), {
    quantity: typeof n.value === "number" ? n.value : 1,
    notes: n.note ? String(n.note) : null,
    mode: "full",
  });
  if (!result) return err2(`Habit "${n.habitId}" not found`);
  return {
    ok: true,
    recordId: result.id,
    recordType: "Habit",
    summary: `Logged habit "${result.title}"`,
  };
}

export async function executeCreateHabit(
  userId: string,
  n: Record<string, unknown>,
): Promise<ExecuteResult> {
  const habit = await createHabit(userId, {
    title: String(n.title),
    cadence: n.cadence as "daily" | "weekdays" | "weekly" | "custom",
    dayPart: n.dayPart as "morning" | "day" | "evening" | "anytime",
    targetCount: typeof n.targetCount === "number" ? n.targetCount : undefined,
    goalUnit: n.goalUnit as "check" | "count" | "minutes",
    notes: n.notes ? String(n.notes) : null,
    reminderTime: n.reminderTime ? String(n.reminderTime) : null,
  });
  return {
    ok: true,
    recordId: habit.id,
    recordType: "Habit",
    summary: `Created habit "${habit.title}"`,
  };
}
