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

// Save notes on an entry (typically the one still running) without touching
// the clock. Called from debounced, optimistic note inputs on the running card
// and the global timer bar, so it must never throw — a dropped keystroke-save
// should fail silently, not surface an error. No revalidate: the time page is
// force-dynamic and nothing else renders a running entry's notes live, so
// re-rendering mid-typing would only risk disrupting the input.
export async function updateEntryNotes(
  entryId: string,
  notes: string,
): Promise<{ ok: boolean }> {
  try {
    const userId = await resolveActiveUserId();
    const id = entryId.trim();
    if (!id) return { ok: false };
    const trimmed = notes.trim();
    const updated = await timeService.updateEntry(userId, id, {
      notes: trimmed ? notes.slice(0, 2000) : null,
    });
    return { ok: Boolean(updated) };
  } catch {
    return { ok: false };
  }
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
  doItemId: z.string().trim().optional(),
  notes: z.string().trim().max(600).optional(),
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
    doItemId: (formData.get("doItemId") as string) || undefined,
    notes: (formData.get("notes") as string) || undefined,
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
        doItemId: parsed.data.doItemId ?? null,
        notes: parsed.data.notes ?? null,
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
        doItemId: parsed.data.doItemId ?? null,
        notes: parsed.data.notes ?? null,
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

// One segment of a multi-entry gap fill. Deliberately does NOT revalidate:
// the gap card fires several of these back-to-back, and a revalidation between
// segments would recompute the (now smaller) gap on the server and tear down
// the open modal mid-flow. The card calls router.refresh() once on close, so
// the new entries surface then. Returns a result instead of throwing so the
// flow can show an inline error and keep the user's place.
export async function backfillSegment(
  formData: FormData,
): Promise<{ ok: boolean; error?: string }> {
  let userId: string;
  try {
    userId = await resolveActiveUserId();
  } catch {
    return { ok: false, error: "Not signed in." };
  }

  const parsed = backfillSchema.safeParse({
    label: formData.get("label") ?? "",
    category: (formData.get("category") as string) || undefined,
    startedAt: formData.get("startedAt") ?? "",
    endedAt: formData.get("endedAt") ?? "",
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  try {
    await timeService.createPastEntry(userId, {
      label: parsed.data.label,
      category: parsed.data.category ?? null,
      startedAt: new Date(parsed.data.startedAt),
      endedAt: new Date(parsed.data.endedAt),
    });
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Could not save entry.",
    };
  }
  return { ok: true };
}

const continueSchema = z.object({
  label: z.string().trim().min(1, "Label is required").max(200),
  category: z.string().trim().max(80).optional(),
  startedAt: z.string().min(1),
});

// "I'm still doing it." The activity ran the whole untracked gap and is still
// going — it's the "I forgot to hit start" recovery flow. Start a single
// running timer backdated to the gap start, so its elapsed time immediately
// reflects the full duration already spent. No separate completed entry is
// created (that would split one continuous activity into two rows).
export async function backfillAndContinue(formData: FormData) {
  const userId = await resolveActiveUserId();

  const parsed = continueSchema.safeParse({
    label: formData.get("label") ?? "",
    category: (formData.get("category") as string) || undefined,
    startedAt: formData.get("startedAt") ?? "",
  });
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Invalid input.");
  }

  await timeService.startEntry(userId, {
    label: parsed.data.label,
    category: parsed.data.category ?? null,
    startedAt: new Date(parsed.data.startedAt),
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

// Stop the running timer at an earlier moment than now — the "I finished at 2pm
// but forgot to hit stop" recovery. `endedAtIso` is an absolute timestamp built
// in the BROWSER's timezone (the picker resolves wall-clock → ISO there, so the
// server's timezone never reinterprets it). The service validates that it sits
// between the entry's start and now; the untracked stretch it leaves behind
// surfaces as the usual gap-backfill card on /app/time.
export async function stopEntryAt(endedAtIso: string) {
  const userId = await resolveActiveUserId();
  const endedAt = new Date(endedAtIso);
  if (Number.isNaN(endedAt.getTime())) {
    throw new Error("Stop time is invalid.");
  }
  await timeService.stopRunning(userId, endedAt);

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
