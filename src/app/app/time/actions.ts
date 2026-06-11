"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import * as timeService from "@/lib/services/time";
import { reflectOnDoItemSession } from "@/lib/services/do";
import { logHabitProgress } from "@/lib/services/habits";
import { resolveActiveUserId } from "@/lib/viewer-context";
import { windowFromFormData } from "@/lib/wall-clock";

const startSchema = z.object({
  label: z.string().trim().min(1, "Label is required").max(200),
  category: z.string().trim().max(80).optional(),
  doItemId: z.string().trim().optional(),
  habitId: z.string().trim().optional(),
});

export type StartState = { error?: string } | undefined;

export async function startEntry(
  _prev: StartState,
  formData: FormData,
): Promise<StartState> {
  let userId: string;
  try {
    userId = await resolveActiveUserId();
  } catch {
    return { error: "Not signed in." };
  }

  const parsed = startSchema.safeParse({
    label: formData.get("label") ?? "",
    category: (formData.get("category") as string) || undefined,
    doItemId: (formData.get("doItemId") as string) || undefined,
    habitId: (formData.get("habitId") as string) || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  await timeService.startEntry(userId, {
    label: parsed.data.label,
    category: parsed.data.category ?? null,
    doItemId: parsed.data.doItemId ?? null,
    habitId: parsed.data.habitId ?? null,
  });

  revalidatePath("/app");
  revalidatePath("/app/do");
  revalidatePath("/app/habits");
  revalidatePath("/app/time");
  revalidatePath("/app/calendar");
}

// One-tap start used by the quick-start chips and the switch panel.
// Starting auto-stops any running entry (service behavior), so a single tap
// rolls straight from one activity into the next.
export async function quickStartEntry(formData: FormData) {
  const userId = await resolveActiveUserId();

  const parsed = startSchema.safeParse({
    label: formData.get("label") ?? "",
    category: (formData.get("category") as string) || undefined,
    doItemId: (formData.get("doItemId") as string) || undefined,
    habitId: (formData.get("habitId") as string) || undefined,
  });
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Invalid input.");
  }

  await timeService.startEntry(userId, {
    label: parsed.data.label,
    category: parsed.data.category ?? null,
    doItemId: parsed.data.doItemId ?? null,
    habitId: parsed.data.habitId ?? null,
  });

  revalidatePath("/app");
  revalidatePath("/app/do");
  revalidatePath("/app/habits");
  revalidatePath("/app/time");
  revalidatePath("/app/calendar");
}

// Rename the running entry without touching the clock — used by the
// "what specifically?" row after a one-tap category start.
export async function describeEntryAction(formData: FormData) {
  const userId = await resolveActiveUserId();
  const id = String(formData.get("id") ?? "").trim();
  const label = String(formData.get("label") ?? "").trim().slice(0, 200);
  if (!id || !label) return;

  await timeService.updateEntry(userId, id, { label });

  revalidatePath("/app");
  revalidatePath("/app/time");
  revalidatePath("/app/calendar");
}

export type EntryFormState = { error?: string } | { ok: true } | undefined;

// Times arrive as absolute ISO timestamps built in the BROWSER's timezone
// by the entry editor (see fillIsoWindowFields). Never parse naive
// "date + time" strings here — the server's timezone would decide what
// wall-clock times mean, shifting entries whenever the two differ.
const entryFormSchema = z.object({
  id: z.string().trim().optional(),
  label: z.string().trim().min(1, "Label is required").max(200),
  category: z.string().trim().max(80).optional(),
});

// Edit an existing completed entry, or manually add one (no id).
// Used by the entry editor modal on the time page.
export async function saveEntryAction(
  _prev: EntryFormState,
  formData: FormData,
): Promise<EntryFormState> {
  let userId: string;
  try {
    userId = await resolveActiveUserId();
  } catch {
    return { error: "Not signed in." };
  }

  const parsed = entryFormSchema.safeParse({
    id: (formData.get("id") as string) || undefined,
    label: formData.get("label") ?? "",
    category: (formData.get("category") as string) || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const window = windowFromFormData(formData);
  if (!window) {
    return { error: "Date and time are required." };
  }
  const startedAt = window.startsAt;
  const endedAt = window.endsAt;

  try {
    if (parsed.data.id) {
      const updated = await timeService.updateEntry(userId, parsed.data.id, {
        label: parsed.data.label,
        category: parsed.data.category ?? null,
        startedAt,
        endedAt,
      });
      if (!updated) {
        return { error: "Entry not found." };
      }
    } else {
      await timeService.createPastEntry(userId, {
        label: parsed.data.label,
        category: parsed.data.category ?? null,
        startedAt,
        endedAt,
      });
    }
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Could not save entry.",
    };
  }

  revalidatePath("/app");
  revalidatePath("/app/time");
  revalidatePath("/app/calendar");
  return { ok: true };
}

const backfillSchema = z.object({
  label: z.string().trim().min(1, "Label is required").max(200),
  category: z.string().trim().max(80).optional(),
  startedAt: z.string().min(1),
  endedAt: z.string().min(1),
});

// Retroactively log the untracked gap since the last entry.
export async function backfillEntry(formData: FormData) {
  const userId = await resolveActiveUserId();

  const parsed = backfillSchema.safeParse({
    label: formData.get("label") ?? "",
    category: (formData.get("category") as string) || undefined,
    startedAt: formData.get("startedAt") ?? "",
    endedAt: formData.get("endedAt") ?? "",
  });
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Invalid input.");
  }

  await timeService.createPastEntry(userId, {
    label: parsed.data.label,
    category: parsed.data.category ?? null,
    startedAt: new Date(parsed.data.startedAt),
    endedAt: new Date(parsed.data.endedAt),
  });

  revalidatePath("/app");
  revalidatePath("/app/time");
  revalidatePath("/app/calendar");
}

export async function stopEntry() {
  const userId = await resolveActiveUserId();
  await timeService.stopRunning(userId);

  revalidatePath("/app");
  revalidatePath("/app/do");
  revalidatePath("/app/habits");
  revalidatePath("/app/time");
  revalidatePath("/app/calendar");
}

export async function stopEntryAndCompleteDoItem(formData: FormData) {
  const userId = await resolveActiveUserId();
  const doItemId = String(formData.get("doItemId") ?? "").trim();
  const actualRaw = String(formData.get("actualMinutes") ?? "").trim();

  if (!doItemId) {
    throw new Error("Missing task id.");
  }

  await timeService.stopRunning(userId);
  await reflectOnDoItemSession(userId, doItemId, {
    outcome: "done",
    actualMinutes: actualRaw ? Number(actualRaw) : undefined,
  });

  revalidatePath("/app");
  revalidatePath("/app/do");
  revalidatePath("/app/habits");
  revalidatePath("/app/time");
  revalidatePath("/app/calendar");
}

export async function stopEntryWithReflection(formData: FormData) {
  const userId = await resolveActiveUserId();
  const doItemId = String(formData.get("doItemId") ?? "").trim();
  const outcome = String(formData.get("outcome") ?? "continue").trim();
  const actualRaw = String(formData.get("actualMinutes") ?? "").trim();
  const remainingRaw = String(formData.get("remainingMinutes") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();

  await timeService.stopRunning(userId);

  if (doItemId) {
    if (outcome !== "done" && outcome !== "continue" && outcome !== "waiting") {
      throw new Error("Invalid reflection outcome.");
    }
    await reflectOnDoItemSession(userId, doItemId, {
      outcome,
      actualMinutes: outcome === "done" && actualRaw ? Number(actualRaw) : undefined,
      remainingMinutes: remainingRaw ? Number(remainingRaw) : undefined,
      notes: notes || null,
    });
  }

  revalidatePath("/app");
  revalidatePath("/app/do");
  revalidatePath("/app/habits");
  revalidatePath("/app/time");
  revalidatePath("/app/calendar");
}

export async function stopEntryWithHabitReflection(formData: FormData) {
  const userId = await resolveActiveUserId();
  const habitId = String(formData.get("habitId") ?? "").trim();
  const quantityRaw = String(formData.get("quantity") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();

  if (!habitId) {
    throw new Error("Missing habit id.");
  }

  await timeService.stopRunning(userId);

  if (quantityRaw) {
    const quantity = Number(quantityRaw);
    if (!Number.isFinite(quantity) || quantity < 1) {
      throw new Error("Invalid habit quantity.");
    }
    await logHabitProgress(userId, habitId, {
      quantity,
      notes: notes || "Completed from timed habit session.",
      mode: "full",
    });
  }

  revalidatePath("/app");
  revalidatePath("/app/do");
  revalidatePath("/app/habits");
  revalidatePath("/app/time");
  revalidatePath("/app/calendar");
}

export async function deleteEntry(id: string) {
  const userId = await resolveActiveUserId();
  await timeService.deleteEntry(userId, id);

  revalidatePath("/app");
  revalidatePath("/app/time");
}
