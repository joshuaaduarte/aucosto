"use server";

import { revalidatePath } from "next/cache";
import {
  createCalendarItem,
  deleteCalendarItem,
  updateCalendarItem,
} from "@/lib/services/calendar";
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

export async function createCalendarBlockAction(formData: FormData) {
  const userId = await requireUserId();
  const title = String(formData.get("title") ?? "");
  const date = String(formData.get("date") ?? "");
  const start = String(formData.get("start") ?? "");
  const end = String(formData.get("end") ?? "");
  const notes = String(formData.get("notes") ?? "");
  const location = String(formData.get("location") ?? "");

  await createCalendarItem(userId, {
    title,
    startsAt: parseDateTime(date, start),
    endsAt: parseDateTime(date, end),
    notes,
    location,
    kind: "block",
    status: "confirmed",
  });

  revalidateCalendar();
}

export async function completeCalendarItemAction(formData: FormData) {
  const userId = await requireUserId();
  const id = String(formData.get("id") ?? "");
  await updateCalendarItem(userId, id, { status: "done" });
  revalidateCalendar();
}

export async function deleteCalendarItemAction(formData: FormData) {
  const userId = await requireUserId();
  const id = String(formData.get("id") ?? "");
  await deleteCalendarItem(userId, id);
  revalidateCalendar();
}
