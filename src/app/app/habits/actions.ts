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
  listHabits,
  logHabitProgress,
  startTimerForHabit,
  updateHabit,
} from "@/lib/services/habits";
import { requireViewerContext } from "@/lib/viewer-context";

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
  daysOfWeek: z.array(z.coerce.number().int().min(0).max(6)).default([]),
});

function revalidateHabits() {
  revalidatePath("/app");
  revalidatePath("/app/habits");
  revalidatePath("/app/calendar");
  revalidatePath("/app/time");
}

async function requireUserId() {
  const context = await requireViewerContext();
  return context.effectiveUserId;
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

export async function createHabitAction(
  _prev: HabitState,
  formData: FormData,
): Promise<HabitState> {
  const userId = await requireUserId();
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

export async function updateHabitAction(formData: FormData) {
  const userId = await requireUserId();
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
    daysOfWeek: formData.getAll("daysOfWeek"),
  });
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Invalid habit.");
  }
  await updateHabit(userId, id, {
    ...parsed.data,
    daysOfWeek: serializeHabitDays(parsed.data.daysOfWeek),
  });
  revalidateHabits();
}

export async function logHabitAction(
  _prev: HabitLogState,
  formData: FormData,
): Promise<HabitLogState> {
  const userId = await requireUserId();
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
  const userId = await requireUserId();
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
  const userId = await requireUserId();
  const id = String(formData.get("id") ?? "");
  const archived = String(formData.get("archived") ?? "true") === "true";
  await archiveHabit(userId, id, archived);
  revalidateHabits();
}

export async function deleteHabitAction(formData: FormData) {
  const userId = await requireUserId();
  const id = String(formData.get("id") ?? "");
  await deleteHabit(userId, id);
  revalidateHabits();
}

export async function startHabitTimerAction(formData: FormData) {
  const userId = await requireUserId();
  const id = String(formData.get("id") ?? "");
  await startTimerForHabit(userId, id);
  revalidateHabits();
}

export async function createDoFromHabitAction(formData: FormData) {
  const userId = await requireUserId();
  const title = String(formData.get("title") ?? "").trim();
  const bucket = nullableString(formData, "bucket");
  const estimatedMinutes = nullableNumber(formData, "estimatedMinutes");
  await createDoItem(userId, {
    title,
    bucket,
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
  const userId = await requireUserId();
  const habitId = String(formData.get("habitId") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const date = String(formData.get("date") ?? "");
  const start = String(formData.get("start") ?? "");
  const end = String(formData.get("end") ?? "");
  await createCalendarItem(userId, {
    title,
    startsAt: new Date(`${date}T${start}`),
    endsAt: new Date(`${date}T${end}`),
    kind: "block",
    status: "confirmed",
    sourceTool: habitId ? "habit" : null,
    sourceRefId: habitId || null,
  });
  revalidateHabits();
  return undefined;
}

export async function quickLogHabitFromDoAction(formData: FormData) {
  const userId = await requireUserId();
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
