"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import * as timeService from "@/lib/services/time";
import { reflectOnDoItemSession } from "@/lib/services/do";
import { resolveActiveUserId } from "@/lib/viewer-context";

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
  revalidatePath("/app/time");
}

export async function stopEntry() {
  const userId = await resolveActiveUserId();
  await timeService.stopRunning(userId);

  revalidatePath("/app");
  revalidatePath("/app/time");
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
  revalidatePath("/app/time");
  revalidatePath("/app/calendar");
}

export async function deleteEntry(id: string) {
  const userId = await resolveActiveUserId();
  await timeService.deleteEntry(userId, id);

  revalidatePath("/app");
  revalidatePath("/app/time");
}
