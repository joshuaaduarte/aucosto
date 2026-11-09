// Assistant action executor — Reflection actions.
// (Split out of the former single-file assistant-action-executor.ts.)

import "server-only";
import { getReflection, upsertReflection, buildReflectionSnapshot } from "@/lib/services/reflect";
import { dayKey } from "@/lib/reflect";
import { AddReflectionInput } from "./schemas";
import { err, zodErr } from "./shared";
import { ExecuteResult, PreviewResult } from "./types";

export async function previewAddReflection(
  _userId: string,
  raw: unknown,
): Promise<PreviewResult> {
  const parsed = AddReflectionInput.safeParse(raw);
  if (!parsed.success) {
    return zodErr(parsed.error);
  }
  const { mood, note } = parsed.data;
  if (mood === undefined && note === undefined) {
    return err("Provide at least one of: mood, note");
  }

  const parts: string[] = [];
  if (mood !== undefined) parts.push(`mood=${mood}/5`);
  if (note) parts.push(`note="${note.slice(0, 50)}${note.length > 50 ? "…" : ""}"`);

  return {
    ok: true,
    previewText: `Add reflection for today: ${parts.join(", ")}`,
    normalizedInput: { mood: mood ?? null, note: note ?? null },
    warnings: [],
  };
}

/** Stored in the NOT NULL rating columns when nobody rated the day. */
const PLACEHOLDER_RATING = 3;

export async function executeAddReflection(
  userId: string,
  n: Record<string, unknown>,
): Promise<ExecuteResult> {
  const now = new Date();
  const todayKey = dayKey(now);
  const inputMood = typeof n.mood === "number" ? n.mood : null;
  const inputNote = n.note ? String(n.note) : null;

  const [existing, contextSnapshot] = await Promise.all([
    getReflection(userId, todayKey),
    buildReflectionSnapshot(userId, now),
  ]);

  // Never invent a mood: a note-only save on a day nobody has rated keeps
  // the ratings unset. The columns are NOT NULL, so placeholders go in and
  // the snapshot flag makes the service read them back as null.
  const existingRated = existing !== null && existing.mood !== null;
  const ratingsUnset = inputMood === null && !existingRated;
  const mood = inputMood ?? existing?.mood ?? PLACEHOLDER_RATING;
  const energyLevel = existing?.energyLevel ?? mood;
  const productivityRating = existing?.productivityRating ?? PLACEHOLDER_RATING;
  const dayRating = existing?.dayRating ?? mood;
  const freeNotes = inputNote ?? existing?.freeNotes ?? null;

  await upsertReflection(userId, {
    dateKey: todayKey,
    mood,
    energyLevel,
    productivityRating,
    dayRating,
    freeNotes,
    wentWell: existing?.wentWell ?? null,
    carryForward: existing?.carryForward ?? null,
    contextSnapshot: ratingsUnset ? { ...contextSnapshot, ratingsUnset: true } : contextSnapshot,
  });

  return {
    ok: true,
    recordId: null,
    recordType: "DailyReflection",
    summary: `Updated reflection for ${todayKey}${inputMood ? ` — mood ${inputMood}/5` : ""}`,
  };
}
