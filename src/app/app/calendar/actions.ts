"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import * as timeService from "@/lib/services/time";
import {
  createCalendarItem,
  deleteCalendarItem,
  updateCalendarItem,
} from "@/lib/services/calendar";
import { updateDoItem } from "@/lib/services/do";
import { windowFromFormData } from "@/lib/wall-clock";
import { listHabits, logHabitProgress, startTimerForHabit } from "@/lib/services/habits";
import { syncRolodexMentionsForText } from "@/lib/services/rolodex-mentions";
import { resolveActiveUserId } from "@/lib/viewer-context";

function revalidateCalendar() {
  revalidatePath("/app");
  revalidatePath("/app/calendar");
}

function parseOptionalString(value: FormDataEntryValue | null) {
  const normalized = String(value ?? "").trim();
  return normalized.length > 0 ? normalized : null;
}

export async function createCalendarBlockAction(formData: FormData) {
  const userId = await resolveActiveUserId();
  const title = String(formData.get("title") ?? "");
  const doItemId = parseOptionalString(formData.get("doItemId"));
  const habitId = parseOptionalString(formData.get("habitId"));
  const categoryId = parseOptionalString(formData.get("categoryId"));
  const notes = parseOptionalString(formData.get("notes"));
  const location = parseOptionalString(formData.get("location"));

  const window = windowFromFormData(formData);
  if (!window) {
    throw new Error("Date and time are required.");
  }

  const item = await createCalendarItem(userId, {
    title,
    startsAt: window.startsAt,
    endsAt: window.endsAt,
    notes,
    location,
    categoryId,
    kind: "block",
    status: "confirmed",
    sourceTool: doItemId ? "do" : habitId ? "habit" : null,
    sourceRefId: doItemId ?? habitId,
  });
  await syncRolodexMentionsForText(userId, {
    sourceTool: "calendar",
    sourceRecordId: item.id,
    sourceField: "notes",
    text: notes,
  });
  if (doItemId) {
    await updateDoItem(userId, doItemId, { status: "scheduled" });
  }

  revalidateCalendar();
}

export async function completeCalendarItemAction(formData: FormData) {
  const userId = await resolveActiveUserId();
  const id = String(formData.get("id") ?? "");
  const item = await updateCalendarItem(userId, id, { status: "done" });
  if (item?.sourceTool === "do" && item.sourceRefId) {
    await updateDoItem(userId, item.sourceRefId, { status: "done" });
  }
  if (item?.sourceTool === "habit" && item.sourceRefId) {
    const habits = await listHabits(userId, { includeArchived: true });
    const habit = habits.find(
      (candidate) => candidate.id === item.sourceRefId && !candidate.archivedAt,
    );
    if (habit) {
      const remaining =
        habit.cadence === "weekly"
          ? Math.max(0, habit.targetCount - habit.progressThisWeek)
          : Math.max(0, habit.targetCount - habit.progressToday);

      if (remaining > 0) {
        await logHabitProgress(userId, item.sourceRefId, {
          quantity: habit.goalUnit === "minutes" ? Math.max(5, remaining) : remaining,
          notes: "Completed from Calendar.",
        });
      }
    }
  }
  revalidateCalendar();
}

export async function updateCalendarBlockAction(formData: FormData) {
  const userId = await resolveActiveUserId();
  const id = String(formData.get("id") ?? "");
  const title = String(formData.get("title") ?? "");
  const notes = parseOptionalString(formData.get("notes"));
  const location = parseOptionalString(formData.get("location"));
  // The edit sheet always submits the categoryId field (empty = clear), so
  // read it as a tri-state: present field → set/clear; absent → leave alone.
  const categoryId = formData.has("categoryId")
    ? parseOptionalString(formData.get("categoryId"))
    : undefined;

  const window = windowFromFormData(formData);
  if (!window) {
    throw new Error("Date and time are required.");
  }

  await updateCalendarItem(userId, id, {
    title,
    startsAt: window.startsAt,
    endsAt: window.endsAt,
    notes,
    location,
    categoryId,
    status: "confirmed",
  });
  await syncRolodexMentionsForText(userId, {
    sourceTool: "calendar",
    sourceRecordId: id,
    sourceField: "notes",
    text: notes,
  });
  revalidateCalendar();
}

export async function moveCalendarItemAction(formData: FormData) {
  const userId = await resolveActiveUserId();
  const id = String(formData.get("id") ?? "");

  const window = windowFromFormData(formData);
  if (!window) {
    throw new Error("Date and time are required.");
  }

  await updateCalendarItem(userId, id, {
    startsAt: window.startsAt,
    endsAt: window.endsAt,
    status: "confirmed",
  });
  revalidateCalendar();
}

export async function startTimerFromCalendarItemAction(formData: FormData) {
  const userId = await resolveActiveUserId();
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
  redirect("/app/time");
}

// Habit ghost block → start a live timer for the habit, then jump to the time
// page where the running controls live (mirrors startTimerFromCalendarItem).
export async function startHabitTimerAction(formData: FormData) {
  const userId = await resolveActiveUserId();
  const habitId = parseOptionalString(formData.get("habitId"));
  if (!habitId) {
    throw new Error("Missing habit id.");
  }
  await startTimerForHabit(userId, habitId);
  revalidateCalendar();
  revalidatePath("/app/time");
  redirect("/app/time");
}

// Habit ghost block → log the reminder window as a completed time entry on that
// day, linked back to the habit so it counts toward progress/streaks.
export async function logHabitBlockDoneAction(formData: FormData) {
  const userId = await resolveActiveUserId();
  const habitId = parseOptionalString(formData.get("habitId"));
  const title = String(formData.get("title") ?? "").trim();
  const category = parseOptionalString(formData.get("category"));
  const startIso = String(formData.get("startIso") ?? "");
  const endIso = String(formData.get("endIso") ?? "");
  if (!habitId || !title) {
    throw new Error("Missing habit.");
  }

  await timeService.createPastEntry(userId, {
    label: title,
    category: category ?? "habit",
    habitId,
    startedAt: new Date(startIso),
    endedAt: new Date(endIso),
  });

  revalidateCalendar();
  revalidatePath("/app/time");
}

export async function deleteCalendarItemAction(formData: FormData) {
  const userId = await resolveActiveUserId();
  const id = String(formData.get("id") ?? "");
  await deleteCalendarItem(userId, id);
  revalidateCalendar();
}
