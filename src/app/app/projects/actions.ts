"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { resolveActiveUserId } from "@/lib/viewer-context";
import {
  archiveBoardProject,
  completeProjectTask,
  completeTopOpenTask,
  createArea,
  createBoardProject,
  createProjectTask,
  reorderProjectTasks,
  startTimerForProject,
  tagTimeEntry,
  updateBoardProject,
  updateProjectTask,
  type AreaRecord,
} from "@/lib/services/projects";

function revalidateProjects(id?: string) {
  revalidatePath("/app");
  revalidatePath("/app/projects");
  revalidatePath("/app/time");
  if (id) revalidatePath(`/app/projects/${id}`);
}

/** "YYYY-MM-DD" → a Date at local noon (avoids TZ day-slip). null when blank. */
function parseTargetDate(raw: string | undefined): Date | null {
  if (!raw) return null;
  const [y, m, d] = raw.split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d, 12, 0, 0, 0);
}

const projectFormSchema = z.object({
  name: z.string().trim().min(1, "Project name is required").max(160),
  areaId: z.string().trim().optional(),
  intent: z.string().trim().max(280).optional(),
  status: z.string().trim().optional(),
  energyType: z.string().trim().optional(),
  timeBudgetHours: z.string().trim().optional(),
  targetDate: z.string().trim().optional(),
});

export type ProjectFormState = { error?: string } | undefined;

function readProjectForm(formData: FormData) {
  return projectFormSchema.safeParse({
    name: formData.get("name") ?? "",
    areaId: (formData.get("areaId") as string) || undefined,
    intent: (formData.get("intent") as string) || undefined,
    status: (formData.get("status") as string) || undefined,
    energyType: (formData.get("energyType") as string) || undefined,
    timeBudgetHours: (formData.get("timeBudgetHours") as string) || undefined,
    targetDate: (formData.get("targetDate") as string) || undefined,
  });
}

function budgetMinutesFromHours(raw: string | undefined): number | null {
  if (!raw) return null;
  const hours = Number(raw);
  return Number.isFinite(hours) && hours > 0 ? Math.round(hours * 60) : null;
}

export async function createProjectAction(
  _prev: ProjectFormState,
  formData: FormData,
): Promise<ProjectFormState> {
  let userId: string;
  try {
    userId = await resolveActiveUserId();
  } catch {
    return { error: "Not signed in." };
  }

  const parsed = readProjectForm(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  let newId: string;
  try {
    newId = await createBoardProject(userId, {
      name: parsed.data.name,
      areaId: parsed.data.areaId ?? null,
      intent: parsed.data.intent ?? null,
      status: parsed.data.status ?? null,
      energyType: parsed.data.energyType ?? null,
      timeBudgetMinutes: budgetMinutesFromHours(parsed.data.timeBudgetHours),
      targetDate: parseTargetDate(parsed.data.targetDate),
    });
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not create project." };
  }

  revalidateProjects(newId);
  redirect(`/app/projects/${newId}`);
}

export async function updateProjectAction(
  _prev: ProjectFormState,
  formData: FormData,
): Promise<ProjectFormState> {
  let userId: string;
  try {
    userId = await resolveActiveUserId();
  } catch {
    return { error: "Not signed in." };
  }

  const id = (formData.get("id") as string) || "";
  if (!id) return { error: "Missing project id." };

  const parsed = readProjectForm(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  try {
    await updateBoardProject(userId, id, {
      name: parsed.data.name,
      areaId: parsed.data.areaId ?? null,
      intent: parsed.data.intent ?? null,
      status: parsed.data.status ?? null,
      energyType: parsed.data.energyType ?? null,
      timeBudgetMinutes: budgetMinutesFromHours(parsed.data.timeBudgetHours),
      targetDate: parseTargetDate(parsed.data.targetDate),
    });
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not update project." };
  }

  revalidateProjects(id);
  return undefined;
}

const areaSchema = z.object({
  name: z.string().trim().min(1, "Area name is required").max(60),
  color: z.string().trim().regex(/^#[0-9a-fA-F]{6}$/, "Pick a color").optional(),
});

export type CreateAreaResult =
  | { ok: true; area: AreaRecord }
  | { ok: false; error: string };

export async function createAreaAction(
  name: string,
  color: string,
): Promise<CreateAreaResult> {
  let userId: string;
  try {
    userId = await resolveActiveUserId();
  } catch {
    return { ok: false, error: "Not signed in." };
  }
  const parsed = areaSchema.safeParse({ name, color });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  try {
    const area = await createArea(userId, {
      name: parsed.data.name,
      color: parsed.data.color ?? "#6366f1",
    });
    revalidateProjects();
    return { ok: true, area };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Could not create area." };
  }
}

export async function archiveProjectAction(id: string): Promise<void> {
  const userId = await resolveActiveUserId();
  await archiveBoardProject(userId, id);
  revalidateProjects(id);
}

export async function createTaskAction(
  projectId: string,
  title: string,
  isToday = false,
): Promise<void> {
  const clean = title.trim();
  if (!clean) return;
  const userId = await resolveActiveUserId();
  await createProjectTask(userId, projectId, clean, { isToday });
  revalidateProjects(projectId);
}

export async function toggleTaskAction(
  projectId: string,
  taskId: string,
  done: boolean,
): Promise<void> {
  const userId = await resolveActiveUserId();
  await updateProjectTask(userId, taskId, { done });
  revalidateProjects(projectId);
}

export async function renameTaskAction(
  projectId: string,
  taskId: string,
  title: string,
): Promise<void> {
  const clean = title.trim();
  if (!clean) return;
  const userId = await resolveActiveUserId();
  await updateProjectTask(userId, taskId, { title: clean });
  revalidateProjects(projectId);
}

export async function setTaskTodayAction(
  projectId: string,
  taskId: string,
  isToday: boolean,
): Promise<void> {
  const userId = await resolveActiveUserId();
  await updateProjectTask(userId, taskId, { isToday });
  revalidateProjects(projectId);
}

export async function completeTaskAction(projectId: string, taskId: string): Promise<void> {
  const userId = await resolveActiveUserId();
  await completeProjectTask(userId, taskId);
  revalidateProjects(projectId);
}

export async function completeNextActionAction(projectId: string): Promise<void> {
  const userId = await resolveActiveUserId();
  await completeTopOpenTask(userId, projectId);
  revalidateProjects(projectId);
}

export async function reorderTasksAction(
  projectId: string,
  orderedIds: string[],
): Promise<void> {
  const userId = await resolveActiveUserId();
  await reorderProjectTasks(userId, projectId, orderedIds);
  revalidateProjects(projectId);
}

export async function startProjectTimerAction(projectId: string): Promise<void> {
  const userId = await resolveActiveUserId();
  await startTimerForProject(userId, projectId);
  revalidateProjects(projectId);
}

export async function tagTimeEntryAction(
  entryId: string,
  projectId: string | null,
): Promise<{ ok: boolean; error?: string }> {
  let userId: string;
  try {
    userId = await resolveActiveUserId();
  } catch {
    return { ok: false, error: "Not signed in." };
  }
  try {
    await tagTimeEntry(userId, entryId, projectId);
    revalidateProjects();
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Could not tag entry." };
  }
}
