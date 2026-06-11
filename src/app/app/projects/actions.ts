"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { DO_LANES } from "@/lib/do";
import { PROJECT_STATUSES } from "@/lib/projects";
import { createCalendarItem } from "@/lib/services/calendar";
import { createDoItem, updateDoItem } from "@/lib/services/do";
import { createProject, updateProject } from "@/lib/services/projects";
import { resolveActiveUserId } from "@/lib/viewer-context";

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
export type ProjectTaskState = { error?: string } | undefined;
export type ProjectScheduleState = { error?: string } | undefined;

const projectTaskSchema = z.object({
  projectId: z.string().trim().min(1, "Project is required."),
  title: z.string().trim().min(1, "Task title is required.").max(200),
  lane: z.enum(DO_LANES).default("next"),
  estimatedMinutes: z.coerce.number().int().positive().max(24 * 60).nullable(),
  notes: z.string().trim().max(600).nullable(),
});

const projectScheduleSchema = z.object({
  projectId: z.string().trim().min(1, "Project is required."),
  doItemId: z.string().trim().min(1, "Pick a task to schedule."),
  title: z.string().trim().min(1, "Block title is required.").max(200),
  date: z.string().trim().min(1, "Date is required."),
  start: z.string().trim().min(1, "Start time is required."),
  end: z.string().trim().min(1, "End time is required."),
  location: z.string().trim().max(120).nullable(),
  notes: z.string().trim().max(600).nullable(),
});

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

function nullableNumber(formData: FormData, key: string) {
  const raw = String(formData.get(key) ?? "").trim();
  if (!raw) return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

function parseDateTime(date: string, time: string) {
  return new Date(`${date}T${time}`);
}

function revalidateProjects() {
  revalidatePath("/app");
  revalidatePath("/app/do");
  revalidatePath("/app/projects");
  revalidatePath("/app/calendar");
  revalidatePath("/app/time");
}

export async function createProjectAction(
  _prev: ProjectState,
  formData: FormData,
): Promise<ProjectState> {
  const userId = await resolveActiveUserId();
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
  const userId = await resolveActiveUserId();
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

export async function createProjectTaskAction(
  _prev: ProjectTaskState,
  formData: FormData,
): Promise<ProjectTaskState> {
  const userId = await resolveActiveUserId();
  const parsed = projectTaskSchema.safeParse({
    projectId: formData.get("projectId") ?? "",
    title: formData.get("title") ?? "",
    lane: (formData.get("lane") as string) ?? "next",
    estimatedMinutes: nullableNumber(formData, "estimatedMinutes"),
    notes: nullableString(formData, "notes"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid task." };
  }

  await createDoItem(userId, {
    title: parsed.data.title,
    projectId: parsed.data.projectId,
    lane: parsed.data.lane,
    estimatedMinutes: parsed.data.estimatedMinutes,
    notes: parsed.data.notes,
    status: "ready",
  });
  revalidateProjects();
}

export async function createProjectScheduleAction(
  _prev: ProjectScheduleState,
  formData: FormData,
): Promise<ProjectScheduleState> {
  const userId = await resolveActiveUserId();
  const parsed = projectScheduleSchema.safeParse({
    projectId: formData.get("projectId") ?? "",
    doItemId: formData.get("doItemId") ?? "",
    title: formData.get("title") ?? "",
    date: formData.get("date") ?? "",
    start: formData.get("start") ?? "",
    end: formData.get("end") ?? "",
    location: nullableString(formData, "location"),
    notes: nullableString(formData, "notes"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid block." };
  }

  const startsAt = parseDateTime(parsed.data.date, parsed.data.start);
  const endsAt = parseDateTime(parsed.data.date, parsed.data.end);
  if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) {
    return { error: "Date and time are required." };
  }
  if (endsAt <= startsAt) {
    return { error: "End time has to be after start time." };
  }

  await createCalendarItem(userId, {
    title: parsed.data.title,
    startsAt,
    endsAt,
    location: parsed.data.location,
    notes: parsed.data.notes,
    kind: "block",
    status: "confirmed",
    sourceTool: "do",
    sourceRefId: parsed.data.doItemId,
  });
  await updateDoItem(userId, parsed.data.doItemId, { status: "scheduled" });
  revalidateProjects();
}
