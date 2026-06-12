"use server";

import { revalidatePath } from "next/cache";
import { resolveActiveUserId } from "@/lib/viewer-context";
import { normalizeRhythmType } from "@/lib/rhythms";
import { endRhythm, startRhythm } from "@/lib/services/rhythms";

function revalidateRhythms() {
  revalidatePath("/app");
  revalidatePath("/app/rhythms");
}

export async function startRhythmAction(formData: FormData): Promise<void> {
  const userId = await resolveActiveUserId();
  const type = normalizeRhythmType(String(formData.get("type") ?? ""));
  if (!type) throw new Error("Unknown rhythm type.");
  const notes = String(formData.get("notes") ?? "").trim() || null;
  await startRhythm(userId, type, notes);
  revalidateRhythms();
}

export async function endRhythmAction(formData: FormData): Promise<void> {
  const userId = await resolveActiveUserId();
  const sessionId = String(formData.get("sessionId") ?? "").trim();
  if (!sessionId) throw new Error("Missing session id.");
  await endRhythm(userId, sessionId);
  revalidateRhythms();
}
