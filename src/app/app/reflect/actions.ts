"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { dayKey } from "@/lib/reflect";
import {
  buildReflectionSnapshot,
  upsertReflection,
} from "@/lib/services/reflect";
import { resolveActiveUserId } from "@/lib/viewer-context";

const rating = z.coerce.number().int().min(1).max(5);

const reflectionSchema = z.object({
  mood: rating,
  energyLevel: rating,
  productivityRating: rating,
  dayRating: rating,
  wentWell: z.string().trim().max(2000).optional(),
  carryForward: z.string().trim().max(2000).optional(),
  freeNotes: z.string().trim().max(4000).optional(),
});

export type ReflectionFormState =
  | { error?: string }
  | { ok: true }
  | undefined;

export async function saveReflectionAction(
  _prev: ReflectionFormState,
  formData: FormData,
): Promise<ReflectionFormState> {
  let userId: string;
  try {
    userId = await resolveActiveUserId();
  } catch {
    return { error: "Not signed in." };
  }

  const parsed = reflectionSchema.safeParse({
    mood: formData.get("mood"),
    energyLevel: formData.get("energyLevel"),
    productivityRating: formData.get("productivityRating"),
    dayRating: formData.get("dayRating"),
    wentWell: (formData.get("wentWell") as string) || undefined,
    carryForward: (formData.get("carryForward") as string) || undefined,
    freeNotes: (formData.get("freeNotes") as string) || undefined,
  });
  if (!parsed.success) {
    return { error: "Pick a 1–5 rating for each scale before saving." };
  }

  try {
    const now = new Date();
    // Context snapshot is captured at save time: tracked minutes, entry
    // notes, tasks completed, habit progress — a freeze-frame of the day.
    const contextSnapshot = await buildReflectionSnapshot(userId, now);
    await upsertReflection(userId, {
      dateKey: dayKey(now),
      mood: parsed.data.mood,
      energyLevel: parsed.data.energyLevel,
      productivityRating: parsed.data.productivityRating,
      dayRating: parsed.data.dayRating,
      wentWell: parsed.data.wentWell ?? null,
      carryForward: parsed.data.carryForward ?? null,
      freeNotes: parsed.data.freeNotes ?? null,
      contextSnapshot,
    });
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "Could not save reflection.",
    };
  }

  revalidatePath("/app");
  revalidatePath("/app/reflect");
  revalidatePath("/app/reflect/history");
  return { ok: true };
}
