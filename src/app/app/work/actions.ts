"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { resolveActiveUserId } from "@/lib/viewer-context";
import {
  createArea,
  updateArea,
  createProject,
  updateProject,
  createWorkPerson,
  updateWorkPerson,
  createMeeting,
  updateMeeting,
  createTask,
  updateTask,
  setTaskDone,
  deleteTask,
  createNote,
  setNoteResolved,
  deleteNote,
  saveReview,
} from "@/lib/services/work";
import { workDayKey, workWeekKey } from "@/lib/work";

export type WorkFormState = { error?: string } | undefined;

function revalidateWork() {
  revalidatePath("/app");
  revalidatePath("/app/work");
}

async function requireViewer(): Promise<string | null> {
  try {
    return await resolveActiveUserId();
  } catch {
    return null;
  }
}

const optional = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => v || null);

const id = z.string().trim().min(1);
const optionalId = z
  .string()
  .trim()
  .optional()
  .transform((v) => v || null);
// <input type="date"> — store as local midnight (server TZ = owner TZ).
const optionalDate = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v ? new Date(`${v}T00:00`).toISOString() : null));
// <input type="datetime-local"> — wall-clock in the owner's timezone.
const optionalDateTime = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v ? new Date(v).toISOString() : null));

function fd(formData: FormData): Record<string, string | undefined> {
  const out: Record<string, string | undefined> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value === "string") out[key] = value;
  }
  return out;
}

type Parsed<S extends z.ZodType> =
  | { ok: true; data: z.infer<S> }
  | { ok: false; error: string };

function parse<S extends z.ZodType>(schema: S, formData: FormData): Parsed<S> {
  const result = schema.safeParse(fd(formData));
  if (!result.success) {
    return { ok: false, error: result.error.issues[0]?.message ?? "Invalid input." };
  }
  return { ok: true, data: result.data };
}

async function runForm(
  work: (userId: string) => Promise<void>,
  fallback: string,
): Promise<WorkFormState> {
  const userId = await requireViewer();
  if (!userId) return { error: "Not signed in." };
  try {
    await work(userId);
  } catch (error) {
    return { error: error instanceof Error ? error.message : fallback };
  }
  revalidateWork();
  return undefined;
}

// ── Tasks ─────────────────────────────────────────────────────────────────

const taskSchema = z.object({
  workspaceId: id,
  title: z.string().trim().min(1, "Task title is required").max(300),
  kind: z.enum(["task", "prep", "followup"]).catch("task"),
  dueDate: optionalDate,
  isImportant: z.string().optional(),
  waitingOn: optional(200),
  notes: optional(4000),
  areaId: optionalId,
  projectId: optionalId,
  personId: optionalId,
  meetingId: optionalId,
});

export async function createTaskAction(
  _prev: WorkFormState,
  formData: FormData,
): Promise<WorkFormState> {
  const parsed = parse(taskSchema, formData);
  if (!parsed.ok) return { error: parsed.error };
  const { workspaceId, isImportant, ...input } = parsed.data;
  return runForm(
    (userId) =>
      createTask(userId, workspaceId, { ...input, isImportant: isImportant === "on" }).then(() => {}),
    "Could not create the task.",
  );
}

export async function updateTaskAction(
  _prev: WorkFormState,
  formData: FormData,
): Promise<WorkFormState> {
  const parsed = parse(taskSchema.extend({ id }), formData);
  if (!parsed.ok) return { error: parsed.error };
  const { id: taskId, workspaceId: _ws, isImportant, waitingOn, ...input } = parsed.data;
  return runForm(
    (userId) =>
      updateTask(userId, taskId, {
        ...input,
        waitingOn,
        status: waitingOn ? "waiting" : "open",
        isImportant: isImportant === "on",
      }),
    "Could not update the task.",
  );
}

export async function toggleTaskDoneAction(formData: FormData): Promise<void> {
  const userId = await requireViewer();
  if (!userId) return;
  const taskId = formData.get("id");
  const done = formData.get("done") === "true";
  if (typeof taskId !== "string" || !taskId) return;
  await setTaskDone(userId, taskId, done);
  revalidateWork();
}

export async function deleteTaskAction(formData: FormData): Promise<void> {
  const userId = await requireViewer();
  if (!userId) return;
  const taskId = formData.get("id");
  if (typeof taskId !== "string" || !taskId) return;
  await deleteTask(userId, taskId);
  revalidateWork();
}

/** One-click prep / follow-up task from a meeting row. */
export async function addMeetingTaskAction(formData: FormData): Promise<void> {
  const userId = await requireViewer();
  if (!userId) return;
  const schema = z.object({
    workspaceId: id,
    meetingId: id,
    meetingTitle: z.string().trim().max(300).catch(""),
    kind: z.enum(["prep", "followup"]),
    title: optional(300),
  });
  const parsed = schema.safeParse(fd(formData));
  if (!parsed.success) return;
  const { workspaceId, meetingId, meetingTitle, kind, title } = parsed.data;
  const fallback = kind === "prep" ? `Prep for ${meetingTitle}` : `Follow up on ${meetingTitle}`;
  await createTask(userId, workspaceId, {
    title: title || fallback,
    kind,
    meetingId,
  });
  revalidateWork();
}

// ── Projects ──────────────────────────────────────────────────────────────

const projectSchema = z.object({
  workspaceId: id,
  name: z.string().trim().min(1, "Project name is required").max(200),
  outcome: optional(1000),
  status: z.enum(["active", "waiting", "paused", "done"]).catch("active"),
  dueDate: optionalDate,
  nextAction: optional(300),
  notes: optional(4000),
  areaId: optionalId,
});

export async function createProjectAction(
  _prev: WorkFormState,
  formData: FormData,
): Promise<WorkFormState> {
  const parsed = parse(projectSchema, formData);
  if (!parsed.ok) return { error: parsed.error };
  const { workspaceId, ...input } = parsed.data;
  return runForm(
    (userId) => createProject(userId, workspaceId, input).then(() => {}),
    "Could not create the project.",
  );
}

export async function updateProjectAction(
  _prev: WorkFormState,
  formData: FormData,
): Promise<WorkFormState> {
  const parsed = parse(projectSchema.extend({ id }), formData);
  if (!parsed.ok) return { error: parsed.error };
  const { id: projectId, workspaceId: _ws, ...input } = parsed.data;
  return runForm(
    (userId) => updateProject(userId, projectId, input),
    "Could not update the project.",
  );
}

// ── Areas ─────────────────────────────────────────────────────────────────

const areaSchema = z.object({
  workspaceId: id,
  name: z.string().trim().min(1, "Area name is required").max(200),
  description: optional(1000),
  currentFocus: optional(500),
});

export async function createAreaAction(
  _prev: WorkFormState,
  formData: FormData,
): Promise<WorkFormState> {
  const parsed = parse(areaSchema, formData);
  if (!parsed.ok) return { error: parsed.error };
  const { workspaceId, ...input } = parsed.data;
  return runForm(
    (userId) => createArea(userId, workspaceId, input).then(() => {}),
    "Could not create the area.",
  );
}

export async function updateAreaAction(
  _prev: WorkFormState,
  formData: FormData,
): Promise<WorkFormState> {
  const parsed = parse(areaSchema.extend({ id }), formData);
  if (!parsed.ok) return { error: parsed.error };
  const { id: areaId, workspaceId: _ws, ...input } = parsed.data;
  return runForm(
    (userId) => updateArea(userId, areaId, input),
    "Could not update the area.",
  );
}

export async function archiveAreaAction(formData: FormData): Promise<void> {
  const userId = await requireViewer();
  if (!userId) return;
  const areaId = formData.get("id");
  if (typeof areaId !== "string" || !areaId) return;
  await updateArea(userId, areaId, { status: "archived" });
  revalidateWork();
}

// ── People ────────────────────────────────────────────────────────────────

const personSchema = z.object({
  workspaceId: id,
  name: z.string().trim().min(1, "Name is required").max(200),
  role: optional(200),
  relationship: optional(50),
  team: optional(200),
  notes: optional(4000),
  oneOnOneNotes: optional(8000),
});

export async function createPersonAction(
  _prev: WorkFormState,
  formData: FormData,
): Promise<WorkFormState> {
  const parsed = parse(personSchema, formData);
  if (!parsed.ok) return { error: parsed.error };
  const { workspaceId, ...input } = parsed.data;
  return runForm(
    (userId) => createWorkPerson(userId, workspaceId, input).then(() => {}),
    "Could not add the person.",
  );
}

export async function updatePersonAction(
  _prev: WorkFormState,
  formData: FormData,
): Promise<WorkFormState> {
  const parsed = parse(personSchema.extend({ id }), formData);
  if (!parsed.ok) return { error: parsed.error };
  const { id: personId, workspaceId: _ws, ...input } = parsed.data;
  return runForm(
    (userId) => updateWorkPerson(userId, personId, input),
    "Could not update the person.",
  );
}

// ── Meetings ──────────────────────────────────────────────────────────────

const meetingSchema = z.object({
  workspaceId: id,
  title: z.string().trim().min(1, "Meeting title is required").max(300),
  scheduledAt: optionalDateTime,
  durationMinutes: z
    .string()
    .trim()
    .optional()
    .transform((v) => {
      const n = v ? Number.parseInt(v, 10) : NaN;
      return Number.isFinite(n) && n > 0 ? n : null;
    }),
  recurrence: z.enum(["none", "daily", "weekly", "biweekly", "monthly"]).catch("none"),
  personId: optionalId,
  agenda: optional(4000),
  notes: optional(8000),
});

export async function createMeetingAction(
  _prev: WorkFormState,
  formData: FormData,
): Promise<WorkFormState> {
  const parsed = parse(meetingSchema, formData);
  if (!parsed.ok) return { error: parsed.error };
  const { workspaceId, ...input } = parsed.data;
  return runForm(
    (userId) => createMeeting(userId, workspaceId, input).then(() => {}),
    "Could not create the meeting.",
  );
}

export async function updateMeetingAction(
  _prev: WorkFormState,
  formData: FormData,
): Promise<WorkFormState> {
  const parsed = parse(meetingSchema.extend({ id }), formData);
  if (!parsed.ok) return { error: parsed.error };
  const { id: meetingId, workspaceId: _ws, ...input } = parsed.data;
  return runForm(
    (userId) => updateMeeting(userId, meetingId, input),
    "Could not update the meeting.",
  );
}

export async function archiveMeetingAction(formData: FormData): Promise<void> {
  const userId = await requireViewer();
  if (!userId) return;
  const meetingId = formData.get("id");
  if (typeof meetingId !== "string" || !meetingId) return;
  await updateMeeting(userId, meetingId, { status: "archived" });
  revalidateWork();
}

// ── Notes / decisions ─────────────────────────────────────────────────────

const noteSchema = z.object({
  workspaceId: id,
  kind: z.enum(["note", "decision"]).catch("note"),
  title: optional(300),
  body: z.string().trim().min(1, "Note text is required").max(20000),
  areaId: optionalId,
  projectId: optionalId,
  personId: optionalId,
  meetingId: optionalId,
});

export async function createNoteAction(
  _prev: WorkFormState,
  formData: FormData,
): Promise<WorkFormState> {
  const parsed = parse(noteSchema, formData);
  if (!parsed.ok) return { error: parsed.error };
  const { workspaceId, ...input } = parsed.data;
  return runForm(
    (userId) => createNote(userId, workspaceId, input).then(() => {}),
    "Could not save the note.",
  );
}

export async function setNoteResolvedAction(formData: FormData): Promise<void> {
  const userId = await requireViewer();
  if (!userId) return;
  const noteId = formData.get("id");
  const resolved = formData.get("resolved") === "true";
  if (typeof noteId !== "string" || !noteId) return;
  await setNoteResolved(userId, noteId, resolved);
  revalidateWork();
}

export async function deleteNoteAction(formData: FormData): Promise<void> {
  const userId = await requireViewer();
  if (!userId) return;
  const noteId = formData.get("id");
  if (typeof noteId !== "string" || !noteId) return;
  await deleteNote(userId, noteId);
  revalidateWork();
}

// ── Reviews ───────────────────────────────────────────────────────────────

export async function saveShutdownAction(
  _prev: WorkFormState,
  formData: FormData,
): Promise<WorkFormState> {
  const schema = z.object({
    workspaceId: id,
    looseEnds: optional(8000),
    tomorrowFocus: optional(500),
  });
  const parsed = parse(schema, formData);
  if (!parsed.ok) return { error: parsed.error };
  const { workspaceId, ...input } = parsed.data;
  return runForm(
    (userId) => saveReview(userId, workspaceId, "shutdown", workDayKey(new Date()), input),
    "Could not save the shutdown.",
  );
}

export async function saveWeeklyReviewAction(
  _prev: WorkFormState,
  formData: FormData,
): Promise<WorkFormState> {
  const schema = z.object({
    workspaceId: id,
    wins: optional(8000),
    challenges: optional(8000),
    nextPriorities: optional(8000),
    energy: z
      .string()
      .trim()
      .optional()
      .transform((v) => {
        const n = v ? Number.parseInt(v, 10) : NaN;
        return Number.isFinite(n) && n >= 1 && n <= 5 ? n : null;
      }),
  });
  const parsed = parse(schema, formData);
  if (!parsed.ok) return { error: parsed.error };
  const { workspaceId, ...input } = parsed.data;
  return runForm(
    (userId) => saveReview(userId, workspaceId, "weekly", workWeekKey(new Date()), input),
    "Could not save the weekly review.",
  );
}
