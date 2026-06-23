"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { HABIT_CADENCES, HABIT_DAY_PARTS, HABIT_GOAL_UNITS, serializeHabitDays } from "@/lib/habits";
import { createCalendarItem } from "@/lib/services/calendar";
import { createDoItem } from "@/lib/services/do";
import {
  archiveHabit,
  createHabit,
  deleteHabit,
  ensureHabitWindowColumns,
  listHabits,
  logHabitProgress,
  removeTodayHabitEntries,
  startTimerForHabit,
  updateHabit,
} from "@/lib/services/habits";
import { findHabitTemplate, templateTitle } from "@/lib/habit-templates";
import { resolveActiveUserId } from "@/lib/viewer-context";
import { windowFromFormData } from "@/lib/wall-clock";

const cadenceEnum = z.enum(HABIT_CADENCES);
const dayPartEnum = z.enum(HABIT_DAY_PARTS);
const goalUnitEnum = z.enum(HABIT_GOAL_UNITS);

const habitSchema = z.object({
  title: z.string().trim().min(1, "Habit title is required").max(200),
  bucket: z.string().trim().max(80).nullable(),
  notes: z.string().trim().max(600).nullable(),
  fallbackTitle: z.string().trim().max(200).nullable(),
  rescuePrompt: z.string().trim().max(280).nullable(),
  dayPart: dayPartEnum.default("anytime"),
  cadence: cadenceEnum.default("daily"),
  targetCount: z.coerce.number().int().positive().max(500).default(1),
  goalUnit: goalUnitEnum.default("check"),
  defaultDurationMinutes: z.coerce.number().int().positive().max(24 * 60).nullable(),
  reminderTime: z.string().trim().max(10).nullable(),
  windowStart: z.string().trim().max(10).nullable(),
  windowEnd: z.string().trim().max(10).nullable(),
  daysOfWeek: z.array(z.coerce.number().int().min(0).max(6)).default([]),
});

function revalidateHabits() {
  revalidatePath("/app");
  revalidatePath("/app/habits");
  revalidatePath("/app/calendar");
  revalidatePath("/app/time");
}

function nullableString(formData: FormData, key: string) {
  const value = String(formData.get(key) ?? "").trim();
  return value.length > 0 ? value : null;
}

function nullableNumber(formData: FormData, key: string) {
  const raw = String(formData.get(key) ?? "").trim();
  if (!raw) return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

export type HabitState = { error?: string } | undefined;
export type HabitLogState = { error?: string } | undefined;
export type HabitScheduleState = { error?: string } | undefined;

// One-time, idempotent application of the flexible-window columns. The habit
// reads/mutations already call ensureHabitWindowColumns() internally (so the
// columns exist on the first habits/calendar render after deploy); this action
// is the explicit, manually-invocable entry point for the same DDL.
export async function ensureHabitWindowColumnsAction(): Promise<{ ok: true }> {
  await resolveActiveUserId();
  await ensureHabitWindowColumns();
  return { ok: true };
}

export async function createHabitAction(
  _prev: HabitState,
  formData: FormData,
): Promise<HabitState> {
  const userId = await resolveActiveUserId();
  const parsed = habitSchema.safeParse({
    title: formData.get("title") ?? "",
    bucket: nullableString(formData, "bucket"),
    notes: nullableString(formData, "notes"),
    fallbackTitle: nullableString(formData, "fallbackTitle"),
    rescuePrompt: nullableString(formData, "rescuePrompt"),
    dayPart: formData.get("dayPart") ?? "anytime",
    cadence: formData.get("cadence") ?? "daily",
    targetCount: formData.get("targetCount") ?? "1",
    goalUnit: formData.get("goalUnit") ?? "check",
    defaultDurationMinutes: nullableNumber(formData, "defaultDurationMinutes"),
    reminderTime: nullableString(formData, "reminderTime"),
    windowStart: nullableString(formData, "windowStart"),
    windowEnd: nullableString(formData, "windowEnd"),
    daysOfWeek: formData.getAll("daysOfWeek"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid habit." };
  }

  await createHabit(userId, {
    ...parsed.data,
    daysOfWeek: serializeHabitDays(parsed.data.daysOfWeek),
  });
  revalidateHabits();
}

export async function updateHabitAction(
  _prev: HabitState,
  formData: FormData,
): Promise<HabitState> {
  const userId = await resolveActiveUserId();
  const id = String(formData.get("id") ?? "");
  const parsed = habitSchema.safeParse({
    title: formData.get("title") ?? "",
    bucket: nullableString(formData, "bucket"),
    notes: nullableString(formData, "notes"),
    fallbackTitle: nullableString(formData, "fallbackTitle"),
    rescuePrompt: nullableString(formData, "rescuePrompt"),
    dayPart: formData.get("dayPart") ?? "anytime",
    cadence: formData.get("cadence") ?? "daily",
    targetCount: formData.get("targetCount") ?? "1",
    goalUnit: formData.get("goalUnit") ?? "check",
    defaultDurationMinutes: nullableNumber(formData, "defaultDurationMinutes"),
    reminderTime: nullableString(formData, "reminderTime"),
    windowStart: nullableString(formData, "windowStart"),
    windowEnd: nullableString(formData, "windowEnd"),
    daysOfWeek: formData.getAll("daysOfWeek"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid habit." };
  }
  const updated = await updateHabit(userId, id, {
    ...parsed.data,
    daysOfWeek: serializeHabitDays(parsed.data.daysOfWeek),
  });
  if (!updated) {
    return { error: "Habit not found." };
  }
  revalidateHabits();
  return undefined;
}

export async function logHabitAction(
  _prev: HabitLogState,
  formData: FormData,
): Promise<HabitLogState> {
  const userId = await resolveActiveUserId();
  const id = String(formData.get("id") ?? "");
  const quantity = Number(formData.get("quantity") ?? "1");
  const notes = nullableString(formData, "notes");
  const modeRaw = String(formData.get("mode") ?? "full");
  const mode = modeRaw === "fallback" || modeRaw === "recovery" ? modeRaw : "full";
  await logHabitProgress(userId, id, {
    quantity: Number.isFinite(quantity) && quantity >= 0 ? quantity : mode === "full" ? 1 : 0,
    notes,
    mode,
  });
  revalidateHabits();
  return undefined;
}

export async function salvageHabitAction(formData: FormData) {
  const userId = await resolveActiveUserId();
  const id = String(formData.get("id") ?? "");
  const modeRaw = String(formData.get("mode") ?? "fallback");
  const mode = modeRaw === "recovery" ? "recovery" : "fallback";
  const notes = nullableString(formData, "notes");
  await logHabitProgress(userId, id, {
    quantity: 0,
    notes,
    mode,
  });
  revalidateHabits();
}

export async function archiveHabitAction(formData: FormData) {
  const userId = await resolveActiveUserId();
  const id = String(formData.get("id") ?? "");
  const archived = String(formData.get("archived") ?? "true") === "true";
  await archiveHabit(userId, id, archived);
  revalidateHabits();
}

export async function deleteHabitAction(formData: FormData) {
  const userId = await resolveActiveUserId();
  const id = String(formData.get("id") ?? "");
  await deleteHabit(userId, id);
  revalidateHabits();
}

export async function startHabitTimerAction(formData: FormData) {
  const userId = await resolveActiveUserId();
  const id = String(formData.get("id") ?? "");
  await startTimerForHabit(userId, id);
  revalidateHabits();
}

export async function createDoFromHabitAction(formData: FormData) {
  const userId = await resolveActiveUserId();
  const habitId = String(formData.get("habitId") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim();
  const bucket = nullableString(formData, "bucket");
  const estimatedMinutes = nullableNumber(formData, "estimatedMinutes");
  await createDoItem(userId, {
    title,
    bucket,
    habitId: habitId || null,
    lane: "today",
    status: "ready",
    estimatedMinutes,
    notes: "Created from Habits.",
  });
  revalidateHabits();
  revalidatePath("/app/do");
}

export async function scheduleHabitAction(
  _prev: HabitScheduleState,
  formData: FormData,
): Promise<HabitScheduleState> {
  const userId = await resolveActiveUserId();
  const habitId = String(formData.get("habitId") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const window = windowFromFormData(formData);
  if (!window) {
    return { error: "Date and time are required." };
  }
  await createCalendarItem(userId, {
    title,
    startsAt: window.startsAt,
    endsAt: window.endsAt,
    kind: "block",
    status: "confirmed",
    sourceTool: habitId ? "habit" : null,
    sourceRefId: habitId || null,
  });
  revalidateHabits();
  return undefined;
}

export async function quickLogHabitFromDoAction(formData: FormData) {
  const userId = await resolveActiveUserId();
  const id = String(formData.get("id") ?? "");
  const habits = await listHabits(userId, { includeArchived: true });
  const habit = habits.find((item) => item.id === id && !item.archivedAt);
  if (!habit) return;

  const remaining =
    habit.cadence === "weekly"
      ? Math.max(1, habit.targetCount - habit.progressThisWeek)
      : Math.max(1, habit.targetCount - habit.progressToday);

  await logHabitProgress(userId, id, {
    quantity: habit.goalUnit === "minutes" ? Math.max(5, remaining) : remaining,
    notes: "Quick-completed from Do List.",
    mode: "full",
  });

  revalidateHabits();
  revalidatePath("/app/do");
}

// ── One-tap flows (templates + quick logging) ─────────────────────

export async function addHabitFromTemplateAction(formData: FormData) {
  const userId = await resolveActiveUserId();
  const key = String(formData.get("templateKey") ?? "").trim();
  const template = findHabitTemplate(key);
  if (!template) return;

  // Skip if an identical habit already exists (idempotent one-tap add).
  const existing = await listHabits(userId, { includeArchived: true });
  const title = templateTitle(template);
  if (existing.some((habit) => habit.title === title)) return;

  await createHabit(userId, {
    title,
    bucket: template.bucket,
    notes: template.description,
    fallbackTitle: template.fallbackTitle ?? null,
    rescuePrompt: null,
    dayPart: template.dayPart,
    cadence: template.cadence,
    targetCount: template.targetCount,
    goalUnit: template.goalUnit,
    defaultDurationMinutes: template.defaultDurationMinutes,
    reminderTime: null,
    daysOfWeek: "",
  });
  revalidateHabits();
}

// One tap from the card: check habits complete, count habits add +1,
// minutes habits log the remaining target. No modal in the way.
export async function quickLogHabitAction(formData: FormData) {
  const userId = await resolveActiveUserId();
  const id = String(formData.get("id") ?? "");
  const quantityRaw = Number(formData.get("quantity") ?? "");
  const habits = await listHabits(userId, { includeArchived: false });
  const habit = habits.find((item) => item.id === id);
  if (!habit) return;

  const remaining =
    habit.cadence === "weekly"
      ? Math.max(1, habit.targetCount - habit.progressThisWeek)
      : Math.max(1, habit.targetCount - habit.progressToday);
  const quantity =
    Number.isFinite(quantityRaw) && quantityRaw > 0
      ? quantityRaw
      : habit.goalUnit === "count"
        ? 1
        : remaining;

  await logHabitProgress(userId, id, { quantity, notes: null, mode: "full" });
  revalidateHabits();
}

// One-tap "done" from the floating Picture-in-Picture widget. Mirrors
// quickLogHabitAction's logic but takes a plain id (the PiP widget calls it as
// a function, not through a <form>). Idempotent-ish: a habit already complete
// just logs its remaining (>=1) again, which the service tolerates.
export async function logHabitDone(id: string) {
  const userId = await resolveActiveUserId();
  if (!id) return;
  const habits = await listHabits(userId, { includeArchived: false });
  const habit = habits.find((item) => item.id === id);
  if (!habit) return;

  const remaining =
    habit.cadence === "weekly"
      ? Math.max(1, habit.targetCount - habit.progressThisWeek)
      : Math.max(1, habit.targetCount - habit.progressToday);
  const quantity = habit.goalUnit === "count" ? 1 : remaining;

  await logHabitProgress(userId, id, { quantity, notes: null, mode: "full" });
  revalidateHabits();
}

// Undo today's log — clears today's entries so the habit can be re-logged
// cleanly (fix a wrong count, remove an accidental tap, or just take it back).
export async function undoTodayHabitLogAction(formData: FormData) {
  const userId = await resolveActiveUserId();
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await removeTodayHabitEntries(userId, id);
  revalidateHabits();
}
