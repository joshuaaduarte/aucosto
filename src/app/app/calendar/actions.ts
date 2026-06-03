"use server";

import { revalidatePath } from "next/cache";
import * as timeService from "@/lib/services/time";
import {
  createCalendarItem,
  deleteCalendarItem,
  updateCalendarItem,
} from "@/lib/services/calendar";
import { startTimerForHabit } from "@/lib/services/habits";
import { updateDoItem } from "@/lib/services/do";
import { requireViewerContext } from "@/lib/viewer-context";

function revalidateCalendar() {
  revalidatePath("/app");
  revalidatePath("/app/calendar");
}

async function requireUserId() {
  const context = await requireViewerContext();
  return context.effectiveUserId;
}

function parseDateTime(date: string, time: string) {
  return new Date(`${date}T${time}`);
}

function parseOptionalString(value: FormDataEntryValue | null) {
  const normalized = String(value ?? "").trim();
  return normalized.length > 0 ? normalized : null;
}

export async function createCalendarBlockAction(formData: FormData) {
  const userId = await requireUserId();
  const title = String(formData.get("title") ?? "");
  const date = String(formData.get("date") ?? "");
  const start = String(formData.get("start") ?? "");
  const end = String(formData.get("end") ?? "");
  const doItemId = parseOptionalString(formData.get("doItemId"));
  const habitId = parseOptionalString(formData.get("habitId"));
  const notes = parseOptionalString(formData.get("notes"));
  const location = parseOptionalString(formData.get("location"));

  await createCalendarItem(userId, {
    title,
    startsAt: parseDateTime(date, start),
    endsAt: parseDateTime(date, end),
    notes,
    location,
    kind: "block",
    status: "confirmed",
    sourceTool: doItemId ? "do" : habitId ? "habit" : null,
    sourceRefId: doItemId ?? habitId,
  });
  if (doItemId) {
    await updateDoItem(userId, doItemId, { status: "scheduled" });
  }

  revalidateCalendar();
}

export async function completeCalendarItemAction(formData: FormData) {
  const userId = await requireUserId();
  const id = String(formData.get("id") ?? "");
  await updateCalendarItem(userId, id, { status: "done" });
  revalidateCalendar();
}

export async function updateCalendarBlockAction(formData: FormData) {
  const userId = await requireUserId();
  const id = String(formData.get("id") ?? "");
  const title = String(formData.get("title") ?? "");
  const date = String(formData.get("date") ?? "");
  const start = String(formData.get("start") ?? "");
  const end = String(formData.get("end") ?? "");
  const notes = parseOptionalString(formData.get("notes"));
  const location = parseOptionalString(formData.get("location"));

  await updateCalendarItem(userId, id, {
    title,
    startsAt: parseDateTime(date, start),
    endsAt: parseDateTime(date, end),
    notes,
    location,
    status: "confirmed",
  });
  revalidateCalendar();
}

export async function moveCalendarItemAction(formData: FormData) {
  const userId = await requireUserId();
  const id = String(formData.get("id") ?? "");
  const date = String(formData.get("date") ?? "");
  const start = String(formData.get("start") ?? "");
  const end = String(formData.get("end") ?? "");

  await updateCalendarItem(userId, id, {
    startsAt: parseDateTime(date, start),
    endsAt: parseDateTime(date, end),
    status: "confirmed",
  });
  revalidateCalendar();
}

export async function startTimerFromCalendarItemAction(formData: FormData) {
  const userId = await requireUserId();
  const id = String(formData.get("id") ?? "");
  const title = String(formData.get("title") ?? "");
  const doItemId = parseOptionalString(formData.get("doItemId"));
  const habitId = parseOptionalString(formData.get("habitId"));

  if (habitId) {
    await startTimerForHabit(userId, habitId);
  } else {
    await timeService.startEntry(userId, { label: title, doItemId });
  }
  if (doItemId) {
    await updateDoItem(userId, doItemId, { status: "in_progress" });
  }
  await updateCalendarItem(userId, id, { status: "confirmed" });
  revalidateCalendar();
  revalidatePath("/app/time");
}

export async function deleteCalendarItemAction(formData: FormData) {
  const userId = await requireUserId();
  const id = String(formData.get("id") ?? "");
  await deleteCalendarItem(userId, id);
  revalidateCalendar();
}
