"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { DO_LANES } from "@/lib/do";
import {
  createDoItem,
  deleteDoItem,
  startTimerForDoItem,
  updateDoItem,
} from "@/lib/services/do";
import { requireViewerContext } from "@/lib/viewer-context";

const laneEnum = z.enum(DO_LANES);

const doSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(200),
  lane: laneEnum.default("next"),
  estimatedMinutes: z.coerce.number().int().positive().max(24 * 60).nullable(),
  actualMinutes: z.coerce.number().int().positive().max(24 * 60).nullable(),
  notes: z.string().trim().max(600).nullable(),
});

export type DoState = { error?: string } | undefined;

function revalidateDo() {
  revalidatePath("/app");
  revalidatePath("/app/do");
  revalidatePath("/app/calendar");
  revalidatePath("/app/time");
}

async function requireUserId() {
  const context = await requireViewerContext();
  return context.effectiveUserId;
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
  const userId = await requireUserId();
  const parsed = doSchema.safeParse({
    title: formData.get("title") ?? "",
    lane: formData.get("lane") ?? "next",
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
  const userId = await requireUserId();
  const id = String(formData.get("id") ?? "");
  const parsed = doSchema.safeParse({
    title: formData.get("title") ?? "",
    lane: formData.get("lane") ?? "next",
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
  const userId = await requireUserId();
  const id = String(formData.get("id") ?? "");
  const actualMinutes = nullableNumber(formData, "actualMinutes");
  await updateDoItem(userId, id, { status: "done", actualMinutes });
  revalidateDo();
}

export async function reopenDoItemAction(formData: FormData) {
  const userId = await requireUserId();
  const id = String(formData.get("id") ?? "");
  await updateDoItem(userId, id, { status: "open" });
  revalidateDo();
}

export async function deleteDoItemAction(formData: FormData) {
  const userId = await requireUserId();
  const id = String(formData.get("id") ?? "");
  await deleteDoItem(userId, id);
  revalidateDo();
}

export async function startDoItemTimerAction(formData: FormData) {
  const userId = await requireUserId();
  const id = String(formData.get("id") ?? "");
  await startTimerForDoItem(userId, id);
  revalidateDo();
}
