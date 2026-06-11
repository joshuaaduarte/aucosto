"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { DO_LANES, DO_STATUSES } from "@/lib/do";
import {
  createDoItem,
  deleteDoItem,
  getDoItemSummary,
  reflectOnDoItemSession,
  startTimerForDoItem,
  updateDoItem,
} from "@/lib/services/do";
import { getRunningEntry, stopRunning } from "@/lib/services/time";
import { resolveActiveUserId } from "@/lib/viewer-context";

const laneEnum = z.enum(DO_LANES);
const statusEnum = z.enum(DO_STATUSES);

const doSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(200),
  bucket: z.string().trim().max(80).nullable(),
  projectId: z.string().trim().max(80).nullable(),
  lane: laneEnum.default("next"),
  status: statusEnum.default("ready"),
  estimatedMinutes: z.coerce.number().int().positive().max(24 * 60).nullable(),
  actualMinutes: z.coerce.number().int().positive().max(24 * 60).nullable(),
  notes: z.string().trim().max(600).nullable(),
});

export type DoState = { error?: string } | undefined;

function revalidateDo() {
  revalidatePath("/app");
  revalidatePath("/app/do");
  revalidatePath("/app/habits");
  revalidatePath("/app/calendar");
  revalidatePath("/app/time");
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

export async function createDoItemAction(
  _prev: DoState,
  formData: FormData,
): Promise<DoState> {
  const userId = await resolveActiveUserId();
  const parsed = doSchema.safeParse({
    title: formData.get("title") ?? "",
    bucket: nullableString(formData, "bucket"),
    projectId: nullableString(formData, "projectId"),
    lane: formData.get("lane") ?? "next",
    status: "ready",
    estimatedMinutes: nullableNumber(formData, "estimatedMinutes"),
    actualMinutes: null,
    notes: nullableString(formData, "notes"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid task." };
  }

  await createDoItem(userId, parsed.data);
  revalidateDo();
}

export async function updateDoItemAction(formData: FormData) {
  const userId = await resolveActiveUserId();
  const id = String(formData.get("id") ?? "");
  const parsed = doSchema.safeParse({
    title: formData.get("title") ?? "",
    bucket: nullableString(formData, "bucket"),
    projectId: nullableString(formData, "projectId"),
    lane: formData.get("lane") ?? "next",
    status: (formData.get("status") as string) ?? "ready",
    estimatedMinutes: nullableNumber(formData, "estimatedMinutes"),
    actualMinutes: nullableNumber(formData, "actualMinutes"),
    notes: nullableString(formData, "notes"),
  });
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Invalid task.");
  }

  await updateDoItem(userId, id, parsed.data);
  revalidateDo();
}

export async function completeDoItemAction(formData: FormData) {
  const userId = await resolveActiveUserId();
  const id = String(formData.get("id") ?? "");
  const actualMinutes = nullableNumber(formData, "actualMinutes");
  const running = await getRunningEntry(userId);

  if (running?.doItem?.id === id) {
    const summary = await getDoItemSummary(userId, id);
    const startedAtMs = running.startedAt.getTime();
    const elapsedMinutes = Math.max(
      5,
      Math.round((Date.now() - startedAtMs) / 60000 / 5) * 5,
    );
    await stopRunning(userId);
    await reflectOnDoItemSession(userId, id, {
      outcome: "done",
      actualMinutes:
        actualMinutes ?? (summary ? summary.trackedMinutes + elapsedMinutes : elapsedMinutes),
    });
    revalidateDo();
    return;
  }

  await reflectOnDoItemSession(userId, id, { outcome: "done", actualMinutes });
  revalidateDo();
}

export async function reopenDoItemAction(formData: FormData) {
  const userId = await resolveActiveUserId();
  const id = String(formData.get("id") ?? "");
  await updateDoItem(userId, id, { status: "ready" });
  revalidateDo();
}

export async function deleteDoItemAction(formData: FormData) {
  const userId = await resolveActiveUserId();
  const id = String(formData.get("id") ?? "");
  await deleteDoItem(userId, id);
  revalidateDo();
}

export async function startDoItemTimerAction(formData: FormData) {
  const userId = await resolveActiveUserId();
  const id = String(formData.get("id") ?? "");
  await startTimerForDoItem(userId, id);
  revalidateDo();
}

export async function reflectDoItemSessionAction(formData: FormData) {
  const userId = await resolveActiveUserId();
  const id = String(formData.get("id") ?? "");
  const outcome = String(formData.get("outcome") ?? "continue");
  if (outcome !== "done" && outcome !== "continue" && outcome !== "waiting") {
    throw new Error("Invalid reflection outcome.");
  }
  await reflectOnDoItemSession(userId, id, {
    outcome,
    actualMinutes: nullableNumber(formData, "actualMinutes"),
    remainingMinutes: nullableNumber(formData, "remainingMinutes"),
    notes: nullableString(formData, "notes"),
  });
  revalidateDo();
}
