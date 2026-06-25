import "server-only";
import { z } from "zod";

import { createDoItem, updateDoItem, getDoItemSummary } from "@/lib/services/do";
import { getRunningEntry, startEntry, stopRunning, updateEntry, listRecentEntries } from "@/lib/services/time";
import { listHabits, logHabitProgress } from "@/lib/services/habits";
import { createCalendarItem } from "@/lib/services/calendar";
import {
  getReflection,
  upsertReflection,
  buildReflectionSnapshot,
} from "@/lib/services/reflect";
import { updateProject, listBoardProjects } from "@/lib/services/projects";
import { dayKey } from "@/lib/reflect";

// ── Types ─────────────────────────────────────────────────────────────────

export type AmbiguityCandidate = { id: string; name: string; [key: string]: string };

export interface PreviewResult {
  ok: boolean;
  error?: string;
  candidates?: AmbiguityCandidate[];
  previewText: string;
  normalizedInput: Record<string, unknown>;
  warnings: string[];
}

export interface ExecuteResult {
  ok: boolean;
  error?: string;
  recordId: string | null;
  recordType: string | null;
  summary: string;
}

// ── Input schemas ─────────────────────────────────────────────────────────

const CreateTaskInput = z.object({
  title: z.string().min(1).max(200),
  projectName: z.string().optional(),
  bucket: z.enum(["today", "next", "later", "someday", "backlog"]).default("someday"),
  notes: z.string().optional(),
});

const CompleteTaskInput = z.object({
  taskId: z.string().min(1),
});

const UpdateTaskInput = z.object({
  taskId: z.string().min(1),
  title: z.string().min(1).max(200).optional(),
  bucket: z.enum(["today", "next", "later", "someday"]).optional(),
  projectName: z.string().optional(),
});

const CreateCalendarBlockInput = z.object({
  title: z.string().min(1).max(200),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
  notes: z.string().optional(),
});

const StartTimerInput = z.object({
  title: z.string().min(1).max(200),
  categoryName: z.string().optional(),
  habitName: z.string().optional(),
});

const StopTimerInput = z.object({
  entryId: z.string().optional(),
  endedAtLocal: z.string().optional(), // "YYYY-MM-DDTHH:MM:SS" local time; omit for now
  note: z.string().optional(),
});

const EditTimeEntryInput = z.object({
  entryId: z.string().min(1),
  title: z.string().min(1).max(200).optional(),
  startedAt: z.string().optional(), // ISO
  endedAt: z.string().optional(),   // ISO
});

const LogHabitInput = z.object({
  habitName: z.string().min(1),
  value: z.number().positive().optional(),
  note: z.string().optional(),
});

const AddReflectionInput = z.object({
  mood: z.number().min(1).max(5).optional(),
  note: z.string().optional(),
});

const UpdateProjectInput = z.object({
  projectName: z.string().min(1),
  status: z.enum(["active", "paused", "done"]).optional(),
  notes: z.string().optional(),
});

// ── Name resolvers (read-only) ────────────────────────────────────────────

type ResolveResult<T> =
  | { found: true; match: T }
  | { found: false; candidates: AmbiguityCandidate[] };

async function resolveProjectByName(
  userId: string,
  name: string,
): Promise<ResolveResult<{ id: string; name: string }>> {
  const projects = await listBoardProjects(userId);
  const lower = name.toLowerCase();

  const exact = projects.filter((p) => p.name.toLowerCase() === lower);
  if (exact.length === 1) return { found: true, match: exact[0]! };

  const partial = projects.filter((p) => p.name.toLowerCase().includes(lower));
  if (partial.length === 1) return { found: true, match: partial[0]! };

  const pool = exact.length > 1 ? exact : partial;
  return {
    found: false,
    candidates: pool.map((p) => ({ id: p.id, name: p.name })),
  };
}

async function resolveHabitByName(
  userId: string,
  name: string,
): Promise<ResolveResult<{ id: string; title: string; bucket: string | null }>> {
  const habits = await listHabits(userId);
  const lower = name.toLowerCase();

  const exact = habits.filter((h) => h.title.toLowerCase() === lower);
  if (exact.length === 1) return { found: true, match: exact[0]! };

  const partial = habits.filter((h) => h.title.toLowerCase().includes(lower));
  if (partial.length === 1) return { found: true, match: partial[0]! };

  const pool = exact.length > 1 ? exact : partial;
  return {
    found: false,
    candidates: pool.map((h) => ({
      id: h.id,
      name: h.title,
      bucket: h.bucket ?? "",
    })),
  };
}

// ── Date helpers ──────────────────────────────────────────────────────────

// Build a local Date from "YYYY-MM-DD" + "HH:MM". Node.js interprets date-time
// strings without a timezone offset as local time (using process.env.TZ), which
// is pinned to the app timezone by src/instrumentation.ts.
function parseDateTimeLocal(date: string, time: string): Date {
  return new Date(`${date}T${time}:00`);
}

// ── Preview handlers ──────────────────────────────────────────────────────

async function previewCreateTask(
  userId: string,
  raw: unknown,
): Promise<PreviewResult> {
  const parsed = CreateTaskInput.safeParse(raw);
  if (!parsed.success) {
    return err(parsed.error.issues[0]?.message ?? "Invalid input");
  }
  const { title, projectName, bucket, notes } = parsed.data;
  const warnings: string[] = [];
  let projectId: string | null = null;
  let resolvedProjectName: string | null = null;

  if (projectName) {
    const resolved = await resolveProjectByName(userId, projectName);
    if (!resolved.found) {
      warnings.push(`Project "${projectName}" not found — task will be created without a project`);
    } else {
      projectId = resolved.match.id;
      resolvedProjectName = resolved.match.name;
    }
  }

  // "backlog" → "someday" (no backlog lane in the service)
  const lane = bucket === "backlog" ? "someday" : bucket;
  const normalizedInput: Record<string, unknown> = { title, lane, projectId, notes: notes ?? null };

  const lines: string[] = [`Create task: ${title}`];
  if (resolvedProjectName) lines.push(`Project: ${resolvedProjectName}`);
  lines.push(`Lane: ${lane}`);

  return {
    ok: true,
    previewText: lines.join("\n"),
    normalizedInput,
    warnings,
  };
}

async function previewCompleteTask(
  userId: string,
  raw: unknown,
): Promise<PreviewResult> {
  const parsed = CompleteTaskInput.safeParse(raw);
  if (!parsed.success) {
    return err(parsed.error.issues[0]?.message ?? "Invalid input");
  }
  const { taskId } = parsed.data;
  const task = await getDoItemSummary(userId, taskId);
  if (!task) return err(`Task "${taskId}" not found`);
  if (task.status === "done") {
    return err(`Task "${task.title}" is already done`);
  }

  return {
    ok: true,
    previewText: `Complete task "${task.title}" (currently [${task.lane}])`,
    normalizedInput: { taskId, beforeTitle: task.title, beforeLane: task.lane },
    warnings: [],
  };
}

async function previewUpdateTask(
  userId: string,
  raw: unknown,
): Promise<PreviewResult> {
  const parsed = UpdateTaskInput.safeParse(raw);
  if (!parsed.success) {
    return err(parsed.error.issues[0]?.message ?? "Invalid input");
  }
  const { taskId, title, bucket, projectName } = parsed.data;
  const task = await getDoItemSummary(userId, taskId);
  if (!task) return err(`Task "${taskId}" not found`);

  const warnings: string[] = [];
  let projectId: string | undefined | null = undefined;

  if (projectName !== undefined) {
    if (projectName === "") {
      projectId = null;
    } else {
      const resolved = await resolveProjectByName(userId, projectName);
      if (!resolved.found) {
        warnings.push(`Project "${projectName}" not found — project will not be changed`);
      } else {
        projectId = resolved.match.id;
      }
    }
  }

  const normalizedInput: Record<string, unknown> = {
    taskId,
    beforeTitle: task.title,
    beforeLane: task.lane,
  };
  if (title !== undefined) normalizedInput.title = title;
  if (bucket !== undefined) normalizedInput.lane = bucket;
  if (projectId !== undefined) normalizedInput.projectId = projectId;

  const changes: string[] = [];
  if (title) changes.push(`title → "${title}"`);
  if (bucket) changes.push(`lane → [${bucket}]`);
  if (projectId !== undefined) changes.push(`project → ${projectId ?? "none"}`);

  return {
    ok: true,
    previewText: `Update task "${task.title}": ${changes.join(", ") || "no changes"}`,
    normalizedInput,
    warnings,
  };
}

async function previewCreateCalendarBlock(
  _userId: string,
  raw: unknown,
): Promise<PreviewResult> {
  const parsed = CreateCalendarBlockInput.safeParse(raw);
  if (!parsed.success) {
    return err(parsed.error.issues[0]?.message ?? "Invalid input");
  }
  const { title, date, startTime, endTime, notes } = parsed.data;

  const startsAt = parseDateTimeLocal(date, startTime);
  const endsAt = parseDateTimeLocal(date, endTime);
  if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) {
    return err("Invalid date or time");
  }
  if (endsAt <= startsAt) {
    return err("End time must be after start time");
  }

  return {
    ok: true,
    previewText: `Create calendar block "${title}" on ${date} ${startTime}–${endTime}`,
    normalizedInput: {
      title,
      startsAtIso: startsAt.toISOString(),
      endsAtIso: endsAt.toISOString(),
      notes: notes ?? null,
    },
    warnings: [],
  };
}

async function previewStartTimer(
  userId: string,
  raw: unknown,
): Promise<PreviewResult> {
  const parsed = StartTimerInput.safeParse(raw);
  if (!parsed.success) {
    return err(parsed.error.issues[0]?.message ?? "Invalid input");
  }
  const { title, categoryName, habitName } = parsed.data;
  const warnings: string[] = [];
  let habitId: string | null = null;

  if (habitName) {
    const resolved = await resolveHabitByName(userId, habitName);
    if (!resolved.found) {
      warnings.push(`Habit "${habitName}" not found — timer will start without habit link`);
    } else {
      habitId = resolved.match.id;
    }
  }

  const running = await getRunningEntry(userId);
  const stopNote = running ? ` (stops running timer: "${running.label}")` : "";

  return {
    ok: true,
    previewText: `Start timer "${title}"${categoryName ? ` [${categoryName}]` : ""}${stopNote}`,
    normalizedInput: {
      title,
      category: categoryName ?? null,
      habitId,
    },
    warnings,
  };
}

async function previewStopTimer(
  userId: string,
  raw: unknown,
): Promise<PreviewResult> {
  const parsed = StopTimerInput.safeParse(raw);
  if (!parsed.success) {
    return err(parsed.error.issues[0]?.message ?? "Invalid input");
  }
  const { endedAtLocal, note } = parsed.data;

  const running = await getRunningEntry(userId);
  if (!running) return err("No timer is currently running");

  const now = new Date();
  // Interpret endedAtLocal in server TZ (pinned by instrumentation.ts to APP_TIMEZONE)
  const proposedEnd = endedAtLocal ? new Date(endedAtLocal) : now;

  if (Number.isNaN(proposedEnd.getTime())) {
    return err("Invalid endedAtLocal — must be a datetime string like '2024-06-24T09:15:00'");
  }
  if (proposedEnd.getTime() > now.getTime() + 60_000) {
    return err("Stop time cannot be in the future");
  }

  const elapsedMs = now.getTime() - running.startedAt.getTime();
  const elapsedMin = Math.round(elapsedMs / 60000);
  const proposedDurationMs = proposedEnd.getTime() - running.startedAt.getTime();
  const proposedDurationMin = Math.max(0, Math.round(proposedDurationMs / 60000));

  const startClock = fmtClock(running.startedAt);
  const proposedEndClock = fmtClock(proposedEnd);

  const lines = [
    `Stop timer: ${running.label}`,
    `Started: ${startClock} · Running for ${fmtMinutes(elapsedMin)}`,
    `Proposed end: ${proposedEndClock}`,
    `Final duration: ${fmtMinutes(proposedDurationMin)}`,
  ];

  return {
    ok: true,
    previewText: lines.join("\n"),
    normalizedInput: {
      entryId: running.id,
      endedAtIso: proposedEnd.toISOString(),
      note: note ?? null,
    },
    warnings: [],
  };
}

async function previewEditTimeEntry(
  userId: string,
  raw: unknown,
): Promise<PreviewResult> {
  const parsed = EditTimeEntryInput.safeParse(raw);
  if (!parsed.success) {
    return err(parsed.error.issues[0]?.message ?? "Invalid input");
  }
  const { entryId, title, startedAt, endedAt } = parsed.data;
  const warnings: string[] = [];

  if (startedAt && Number.isNaN(new Date(startedAt).getTime())) {
    return err("Invalid startedAt — must be an ISO datetime string");
  }
  if (endedAt && Number.isNaN(new Date(endedAt).getTime())) {
    return err("Invalid endedAt — must be an ISO datetime string");
  }

  // Look up existing entry for before/after preview
  const recent = await listRecentEntries(userId, { limit: 200 });
  const existing = recent.find((e) => e.id === entryId);
  if (!existing) {
    return err(`Time entry "${entryId}" not found`);
  }

  if (title === undefined && startedAt === undefined && endedAt === undefined) {
    warnings.push("No changes specified");
  }

  const afterStart = startedAt ? new Date(startedAt) : existing.startedAt;
  const afterEnd = endedAt ? new Date(endedAt) : existing.endedAt;

  const beforeStart = fmtClock(existing.startedAt);
  const beforeEnd = existing.endedAt ? fmtClock(existing.endedAt) : "running";
  const beforeDur = existing.endedAt
    ? fmtMinutes(Math.round((existing.endedAt.getTime() - existing.startedAt.getTime()) / 60000))
    : "–";

  const afterEndStr = afterEnd ? fmtClock(afterEnd) : "running";
  const afterDur = afterEnd
    ? fmtMinutes(Math.max(0, Math.round((afterEnd.getTime() - afterStart.getTime()) / 60000)))
    : "–";

  const label = title ?? existing.label;
  const lines = [
    `Edit time entry: ${label}`,
    `Before: ${beforeStart}–${beforeEnd} · ${beforeDur}`,
    `After: ${fmtClock(afterStart)}–${afterEndStr} · ${afterDur}`,
  ];

  return {
    ok: true,
    previewText: lines.join("\n"),
    normalizedInput: {
      entryId,
      title: title ?? null,
      startedAtIso: startedAt ?? null,
      endedAtIso: endedAt ?? null,
    },
    warnings,
  };
}

async function previewLogHabit(
  userId: string,
  raw: unknown,
): Promise<PreviewResult> {
  const parsed = LogHabitInput.safeParse(raw);
  if (!parsed.success) {
    return err(parsed.error.issues[0]?.message ?? "Invalid input");
  }
  const { habitName, value, note } = parsed.data;

  const resolved = await resolveHabitByName(userId, habitName);
  if (!resolved.found) {
    return errAmbiguous(
      resolved.candidates.length === 0
        ? `No habit found matching "${habitName}"`
        : `Ambiguous habit match for "${habitName}"`,
      resolved.candidates,
    );
  }

  const habit = resolved.match;
  return {
    ok: true,
    previewText: `Log habit "${habit.title}"${value !== undefined ? ` (${value}x)` : ""}`,
    normalizedInput: {
      habitId: habit.id,
      habitTitle: habit.title,
      value: value ?? 1,
      note: note ?? null,
    },
    warnings: [],
  };
}

async function previewAddReflection(
  _userId: string,
  raw: unknown,
): Promise<PreviewResult> {
  const parsed = AddReflectionInput.safeParse(raw);
  if (!parsed.success) {
    return err(parsed.error.issues[0]?.message ?? "Invalid input");
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

async function previewUpdateProject(
  userId: string,
  raw: unknown,
): Promise<PreviewResult> {
  const parsed = UpdateProjectInput.safeParse(raw);
  if (!parsed.success) {
    return err(parsed.error.issues[0]?.message ?? "Invalid input");
  }
  const { projectName, status, notes } = parsed.data;

  const resolved = await resolveProjectByName(userId, projectName);
  if (!resolved.found) {
    return errAmbiguous(
      resolved.candidates.length === 0
        ? `No project found matching "${projectName}"`
        : `Ambiguous project match for "${projectName}"`,
      resolved.candidates,
    );
  }

  const project = resolved.match;
  const changes: string[] = [];
  if (status) changes.push(`status → ${status}`);
  if (notes !== undefined) changes.push(`notes updated`);
  if (changes.length === 0) return err("No changes specified");

  return {
    ok: true,
    previewText: `Update project "${project.name}": ${changes.join(", ")}`,
    normalizedInput: {
      projectId: project.id,
      projectName: project.name,
      status: status ?? null,
      notes: notes ?? null,
    },
    warnings: [],
  };
}

// ── Execute handlers ──────────────────────────────────────────────────────

async function executeCreateTask(
  userId: string,
  n: Record<string, unknown>,
): Promise<ExecuteResult> {
  const item = await createDoItem(userId, {
    title: String(n.title),
    lane: (n.lane as "today" | "next" | "later" | "someday") ?? "someday",
    projectId: n.projectId ? String(n.projectId) : null,
    notes: n.notes ? String(n.notes) : null,
  });
  return {
    ok: true,
    recordId: item.id,
    recordType: "DoItem",
    summary: `Created task "${item.title}" in [${item.lane}]`,
  };
}

async function executeCompleteTask(
  userId: string,
  n: Record<string, unknown>,
): Promise<ExecuteResult> {
  const updated = await updateDoItem(userId, String(n.taskId), { status: "done" });
  if (!updated) return err2(`Task "${n.taskId}" not found`);
  return {
    ok: true,
    recordId: updated.id,
    recordType: "DoItem",
    summary: `Completed task "${updated.title}"`,
  };
}

async function executeUpdateTask(
  userId: string,
  n: Record<string, unknown>,
): Promise<ExecuteResult> {
  const patch: Parameters<typeof updateDoItem>[2] = {};
  if (n.title !== undefined && n.title !== null) patch.title = String(n.title);
  if (n.lane !== undefined && n.lane !== null)
    patch.lane = n.lane as "today" | "next" | "later" | "someday";
  if ("projectId" in n) patch.projectId = n.projectId ? String(n.projectId) : null;

  const updated = await updateDoItem(userId, String(n.taskId), patch);
  if (!updated) return err2(`Task "${n.taskId}" not found`);
  return {
    ok: true,
    recordId: updated.id,
    recordType: "DoItem",
    summary: `Updated task "${updated.title}"`,
  };
}

async function executeCreateCalendarBlock(
  userId: string,
  n: Record<string, unknown>,
): Promise<ExecuteResult> {
  const item = await createCalendarItem(userId, {
    title: String(n.title),
    startsAt: new Date(String(n.startsAtIso)),
    endsAt: new Date(String(n.endsAtIso)),
    notes: n.notes ? String(n.notes) : null,
    kind: "block",
  });
  return {
    ok: true,
    recordId: item.id,
    recordType: "CalendarItem",
    summary: `Created calendar block "${item.title}"`,
  };
}

async function executeStartTimer(
  userId: string,
  n: Record<string, unknown>,
): Promise<ExecuteResult> {
  const entry = await startEntry(userId, {
    label: String(n.title),
    category: n.category ? String(n.category) : null,
    habitId: n.habitId ? String(n.habitId) : null,
  });
  return {
    ok: true,
    recordId: entry.id,
    recordType: "TimeEntry",
    summary: `Started timer "${entry.label}"`,
  };
}

async function executeStopTimer(
  userId: string,
  n: Record<string, unknown>,
): Promise<ExecuteResult> {
  const endedAt = n.endedAtIso ? new Date(String(n.endedAtIso)) : undefined;
  await stopRunning(userId, endedAt);
  return {
    ok: true,
    recordId: null,
    recordType: "TimeEntry",
    summary: "Stopped running timer",
  };
}

async function executeEditTimeEntry(
  userId: string,
  n: Record<string, unknown>,
): Promise<ExecuteResult> {
  const patch: Parameters<typeof updateEntry>[2] = {};
  if (n.title) patch.label = String(n.title);
  if (n.startedAtIso) patch.startedAt = new Date(String(n.startedAtIso));
  if (n.endedAtIso) patch.endedAt = new Date(String(n.endedAtIso));

  const updated = await updateEntry(userId, String(n.entryId), patch);
  if (!updated) return err2(`Time entry "${n.entryId}" not found`);
  return {
    ok: true,
    recordId: updated.id,
    recordType: "TimeEntry",
    summary: `Updated time entry "${updated.label}"`,
  };
}

async function executeLogHabit(
  userId: string,
  n: Record<string, unknown>,
): Promise<ExecuteResult> {
  const result = await logHabitProgress(userId, String(n.habitId), {
    quantity: typeof n.value === "number" ? n.value : 1,
    notes: n.note ? String(n.note) : null,
    mode: "full",
  });
  if (!result) return err2(`Habit "${n.habitId}" not found`);
  return {
    ok: true,
    recordId: result.id,
    recordType: "Habit",
    summary: `Logged habit "${result.title}"`,
  };
}

async function executeAddReflection(
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

  const mood = inputMood ?? existing?.mood ?? 3;
  const energyLevel = existing?.energyLevel ?? mood;
  const productivityRating = existing?.productivityRating ?? 3;
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
    contextSnapshot,
  });

  return {
    ok: true,
    recordId: null,
    recordType: "DailyReflection",
    summary: `Updated reflection for ${todayKey}${inputMood ? ` — mood ${inputMood}/5` : ""}`,
  };
}

async function executeUpdateProject(
  userId: string,
  n: Record<string, unknown>,
): Promise<ExecuteResult> {
  const patch: Parameters<typeof updateProject>[2] = {};
  if (n.status) patch.status = n.status as "active" | "paused" | "done";
  if (n.notes !== undefined && n.notes !== null) patch.notes = String(n.notes);

  const updated = await updateProject(userId, String(n.projectId), patch);
  if (!updated) return err2(`Project "${n.projectId}" not found`);
  return {
    ok: true,
    recordId: updated.id,
    recordType: "Project",
    summary: `Updated project "${updated.name}"`,
  };
}

// ── Error helpers ─────────────────────────────────────────────────────────

function err(message: string): PreviewResult {
  return {
    ok: false,
    error: message,
    previewText: "",
    normalizedInput: {},
    warnings: [],
  };
}

function errAmbiguous(message: string, candidates: AmbiguityCandidate[]): PreviewResult {
  return {
    ok: false,
    error: message,
    candidates,
    previewText: "",
    normalizedInput: {},
    warnings: [],
  };
}

function err2(message: string): ExecuteResult {
  return { ok: false, error: message, recordId: null, recordType: null, summary: "" };
}

// ── Formatting helpers ────────────────────────────────────────────────────

function fmtClock(date: Date): string {
  return date.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

function fmtMinutes(minutes: number): string {
  const v = Math.max(0, Math.round(minutes));
  if (v === 0) return "0m";
  const h = Math.floor(v / 60);
  const m = v % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

// ── Dispatch tables ───────────────────────────────────────────────────────

const PREVIEWS: Record<
  string,
  (userId: string, raw: unknown) => Promise<PreviewResult>
> = {
  create_task: previewCreateTask,
  complete_task: previewCompleteTask,
  update_task: previewUpdateTask,
  create_calendar_block: previewCreateCalendarBlock,
  start_timer: previewStartTimer,
  stop_timer: previewStopTimer,
  edit_time_entry: previewEditTimeEntry,
  log_habit: previewLogHabit,
  add_reflection: previewAddReflection,
  update_project: previewUpdateProject,
};

const EXECUTES: Record<
  string,
  (userId: string, n: Record<string, unknown>) => Promise<ExecuteResult>
> = {
  create_task: executeCreateTask,
  complete_task: executeCompleteTask,
  update_task: executeUpdateTask,
  create_calendar_block: executeCreateCalendarBlock,
  start_timer: executeStartTimer,
  stop_timer: executeStopTimer,
  edit_time_entry: executeEditTimeEntry,
  log_habit: executeLogHabit,
  add_reflection: executeAddReflection,
  update_project: executeUpdateProject,
};

// ── Public API ────────────────────────────────────────────────────────────

export async function previewAction(
  userId: string,
  action: string,
  rawInput: Record<string, unknown>,
): Promise<PreviewResult> {
  const handler = PREVIEWS[action];
  if (!handler) {
    return err(`Unknown action: ${action}`);
  }
  try {
    return await handler(userId, rawInput);
  } catch (error) {
    return err(error instanceof Error ? error.message : String(error));
  }
}

export async function executeAction(
  userId: string,
  action: string,
  rawInput: Record<string, unknown>,
): Promise<ExecuteResult> {
  // Always re-validate and re-normalize input before executing.
  const preview = await previewAction(userId, action, rawInput);
  if (!preview.ok) {
    return { ok: false, error: preview.error, recordId: null, recordType: null, summary: "" };
  }

  const handler = EXECUTES[action];
  if (!handler) {
    return err2(`Unknown action: ${action}`);
  }
  try {
    return await handler(userId, preview.normalizedInput);
  } catch (error) {
    return err2(error instanceof Error ? error.message : String(error));
  }
}
