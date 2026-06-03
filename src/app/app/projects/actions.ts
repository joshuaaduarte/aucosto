"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { PROJECT_STATUSES } from "@/lib/projects";
import { createProject, updateProject } from "@/lib/services/projects";
import { requireViewerContext } from "@/lib/viewer-context";

const projectSchema = z.object({
  name: z.string().trim().min(1, "Project name is required").max(120),
  status: z.enum(PROJECT_STATUSES).default("active"),
  bucket: z.string().trim().max(80).nullable(),
  summary: z.string().trim().max(240).nullable(),
  nextMilestone: z.string().trim().max(160).nullable(),
  targetDate: z.coerce.date().nullable(),
  notes: z.string().trim().max(1200).nullable(),
});

export type ProjectState = { error?: string } | undefined;

function nullableString(formData: FormData, key: string) {
  const value = String(formData.get(key) ?? "").trim();
  return value.length > 0 ? value : null;
}

function nullableDate(formData: FormData, key: string) {
  const raw = String(formData.get(key) ?? "").trim();
  if (!raw) return null;
  const value = new Date(raw);
  return Number.isNaN(value.getTime()) ? null : value;
}

function revalidateProjects() {
  revalidatePath("/app");
  revalidatePath("/app/do");
  revalidatePath("/app/projects");
}

async function requireUserId() {
  const context = await requireViewerContext();
  return context.effectiveUserId;
}

export async function createProjectAction(
  _prev: ProjectState,
  formData: FormData,
): Promise<ProjectState> {
  const userId = await requireUserId();
  const parsed = projectSchema.safeParse({
    name: formData.get("name") ?? "",
    status: (formData.get("status") as string) ?? "active",
    bucket: nullableString(formData, "bucket"),
    summary: nullableString(formData, "summary"),
    nextMilestone: nullableString(formData, "nextMilestone"),
    targetDate: nullableDate(formData, "targetDate"),
    notes: nullableString(formData, "notes"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid project." };
  }

  await createProject(userId, parsed.data);
  revalidateProjects();
}

export async function updateProjectAction(
  _prev: ProjectState,
  formData: FormData,
): Promise<ProjectState> {
  const userId = await requireUserId();
  const id = String(formData.get("id") ?? "");
  const parsed = projectSchema.safeParse({
    name: formData.get("name") ?? "",
    status: (formData.get("status") as string) ?? "active",
    bucket: nullableString(formData, "bucket"),
    summary: nullableString(formData, "summary"),
    nextMilestone: nullableString(formData, "nextMilestone"),
    targetDate: nullableDate(formData, "targetDate"),
    notes: nullableString(formData, "notes"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid project." };
  }

  await updateProject(userId, id, parsed.data);
  revalidateProjects();
}
