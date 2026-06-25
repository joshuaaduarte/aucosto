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
import {
  updateProjectPlan,
  addProjectQuestion,
  addProjectBlocker,
  getProjectPlan,
} from "@/lib/services/project-planning";
import {
  findPersonByName,
  createPerson,
  updatePerson,
  addInteraction,
  updateFollowUp,
  getPerson,
} from "@/lib/services/rolodex";
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

const UpdateProjectPlanInput = z.object({
  projectName: z.string().min(1),
  goal: z.string().max(1000).optional(),
  whyItMatters: z.string().max(1000).optional(),
  nextMilestone: z.string().max(500).optional(),
  nextAction: z.string().max(500).optional(),
  planNotes: z.string().max(5000).optional(),
});

const AddProjectMilestoneInput = z.object({
  projectName: z.string().min(1),
  milestone: z.string().min(1).max(500),
});

const AddProjectQuestionInput = z.object({
  projectName: z.string().min(1),
  question: z.string().min(1).max(500),
});

const AddProjectBlockerInput = z.object({
  projectName: z.string().min(1),
  blocker: z.string().min(1).max(500),
});

const SetProjectNextActionInput = z.object({
  projectName: z.string().min(1),
  nextAction: z.string().min(1).max(500),
});

const CreateRolodexPersonInput = z.object({
  displayName: z.string().min(1).max(200),
  firstName: z.string().max(100).optional(),
  lastName: z.string().max(100).optional(),
  relationshipType: z.string().optional(),
  organization: z.string().max(200).optional(),
  birthday: z.string().optional(),
  notes: z.string().max(5000).optional(),
});

const UpdateRolodexPersonInput = z.object({
  personName: z.string().min(1),
  notes: z.string().max(5000).optional(),
  relationshipType: z.string().optional(),
  organization: z.string().max(200).optional(),
  giftIdeas: z.array(z.string()).optional(),
  communicationNotes: z.string().max(2000).optional(),
});

const AddRolodexInteractionInput = z.object({
  personName: z.string().min(1),
  title: z.string().min(1).max(300),
  body: z.string().max(5000).optional(),
  followUpNeeded: z.boolean().optional(),
  followUpDate: z.string().optional(),
});

const AddPersonFollowupInput = z.object({
  personName: z.string().min(1),
  title: z.string().min(1).max(300),
  followUpDate: z.string().optional(),
});

const AddGiftIdeaInput = z.object({
  personName: z.string().min(1),
  idea: z.string().min(1).max(300),
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

// ── Person resolver ───────────────────────────────────────────────────────

async function resolvePersonByName(
  userId: string,
  name: string,
): Promise<ResolveResult<{ id: string; name: string }>> {
  const persons = await findPersonByName(userId, name);
  const lower = name.toLowerCase();

  const exact = persons.filter((p) => p.displayName.toLowerCase() === lower);
  if (exact.length === 1) return { found: true, match: { id: exact[0]!.id, name: exact[0]!.displayName } };

  const partial = persons.filter((p) => p.displayName.toLowerCase().includes(lower));
  if (partial.length === 1) return { found: true, match: { id: partial[0]!.id, name: partial[0]!.displayName } };

  const pool = exact.length > 1 ? exact : partial;
  return {
    found: false,
    candidates: pool.map((p) => ({ id: p.id, name: p.displayName })),
  };
}

// ── Project planning preview/execute handlers ─────────────────────────────

async function previewUpdateProjectPlan(
  userId: string,
  raw: unknown,
): Promise<PreviewResult> {
  const parsed = UpdateProjectPlanInput.safeParse(raw);
  if (!parsed.success) return err(parsed.error.issues[0]?.message ?? "Invalid input");

  const resolved = await resolveProjectByName(userId, parsed.data.projectName);
  if (!resolved.found) {
    return errAmbiguous(
      resolved.candidates.length === 0
        ? `No project found matching "${parsed.data.projectName}"`
        : `Ambiguous project match for "${parsed.data.projectName}"`,
      resolved.candidates,
    );
  }

  const { goal, whyItMatters, nextMilestone, nextAction, planNotes } = parsed.data;
  const changes: string[] = [];
  if (goal !== undefined) changes.push("goal");
  if (whyItMatters !== undefined) changes.push("why it matters");
  if (nextMilestone !== undefined) changes.push("next milestone");
  if (nextAction !== undefined) changes.push(`next action → "${nextAction}"`);
  if (planNotes !== undefined) changes.push("plan notes");
  if (changes.length === 0) return err("No changes specified");

  return {
    ok: true,
    previewText: `Update planning for "${resolved.match.name}": ${changes.join(", ")}`,
    normalizedInput: {
      projectId: resolved.match.id,
      projectName: resolved.match.name,
      goal: goal ?? null,
      whyItMatters: whyItMatters ?? null,
      nextMilestone: nextMilestone ?? null,
      nextAction: nextAction ?? null,
      planNotes: planNotes ?? null,
    },
    warnings: [],
  };
}

async function executeUpdateProjectPlan(
  userId: string,
  n: Record<string, unknown>,
): Promise<ExecuteResult> {
  const patch: Parameters<typeof updateProjectPlan>[2] = {};
  if (n.goal !== null && n.goal !== undefined) patch.goal = String(n.goal);
  if (n.whyItMatters !== null && n.whyItMatters !== undefined) patch.whyItMatters = String(n.whyItMatters);
  if (n.nextMilestone !== null && n.nextMilestone !== undefined) patch.nextMilestone = String(n.nextMilestone);
  if (n.nextAction !== null && n.nextAction !== undefined) patch.nextAction = String(n.nextAction);
  if (n.planNotes !== null && n.planNotes !== undefined) patch.planNotes = String(n.planNotes);

  await updateProjectPlan(userId, String(n.projectId), patch);
  return { ok: true, recordId: String(n.projectId), recordType: "Project", summary: `Updated planning for "${n.projectName}"` };
}

async function previewAddProjectMilestone(
  userId: string,
  raw: unknown,
): Promise<PreviewResult> {
  const parsed = AddProjectMilestoneInput.safeParse(raw);
  if (!parsed.success) return err(parsed.error.issues[0]?.message ?? "Invalid input");

  const resolved = await resolveProjectByName(userId, parsed.data.projectName);
  if (!resolved.found) {
    return errAmbiguous(
      resolved.candidates.length === 0
        ? `No project found matching "${parsed.data.projectName}"`
        : `Ambiguous project match for "${parsed.data.projectName}"`,
      resolved.candidates,
    );
  }

  return {
    ok: true,
    previewText: `Set next milestone for "${resolved.match.name}": "${parsed.data.milestone}"`,
    normalizedInput: { projectId: resolved.match.id, projectName: resolved.match.name, milestone: parsed.data.milestone },
    warnings: [],
  };
}

async function executeAddProjectMilestone(
  userId: string,
  n: Record<string, unknown>,
): Promise<ExecuteResult> {
  await updateProjectPlan(userId, String(n.projectId), { nextMilestone: String(n.milestone) });
  return { ok: true, recordId: String(n.projectId), recordType: "Project", summary: `Set milestone for "${n.projectName}"` };
}

async function previewAddProjectQuestion(
  userId: string,
  raw: unknown,
): Promise<PreviewResult> {
  const parsed = AddProjectQuestionInput.safeParse(raw);
  if (!parsed.success) return err(parsed.error.issues[0]?.message ?? "Invalid input");

  const resolved = await resolveProjectByName(userId, parsed.data.projectName);
  if (!resolved.found) {
    return errAmbiguous(
      resolved.candidates.length === 0
        ? `No project found matching "${parsed.data.projectName}"`
        : `Ambiguous project match for "${parsed.data.projectName}"`,
      resolved.candidates,
    );
  }

  return {
    ok: true,
    previewText: `Add question to "${resolved.match.name}": "${parsed.data.question}"`,
    normalizedInput: { projectId: resolved.match.id, projectName: resolved.match.name, question: parsed.data.question },
    warnings: [],
  };
}

async function executeAddProjectQuestion(
  userId: string,
  n: Record<string, unknown>,
): Promise<ExecuteResult> {
  await addProjectQuestion(userId, String(n.projectId), String(n.question));
  return { ok: true, recordId: String(n.projectId), recordType: "Project", summary: `Added question to "${n.projectName}"` };
}

async function previewAddProjectBlocker(
  userId: string,
  raw: unknown,
): Promise<PreviewResult> {
  const parsed = AddProjectBlockerInput.safeParse(raw);
  if (!parsed.success) return err(parsed.error.issues[0]?.message ?? "Invalid input");

  const resolved = await resolveProjectByName(userId, parsed.data.projectName);
  if (!resolved.found) {
    return errAmbiguous(
      resolved.candidates.length === 0
        ? `No project found matching "${parsed.data.projectName}"`
        : `Ambiguous project match for "${parsed.data.projectName}"`,
      resolved.candidates,
    );
  }

  return {
    ok: true,
    previewText: `Add blocker to "${resolved.match.name}": "${parsed.data.blocker}"`,
    normalizedInput: { projectId: resolved.match.id, projectName: resolved.match.name, blocker: parsed.data.blocker },
    warnings: [],
  };
}

async function executeAddProjectBlocker(
  userId: string,
  n: Record<string, unknown>,
): Promise<ExecuteResult> {
  await addProjectBlocker(userId, String(n.projectId), String(n.blocker));
  return { ok: true, recordId: String(n.projectId), recordType: "Project", summary: `Added blocker to "${n.projectName}"` };
}

async function previewSetProjectNextAction(
  userId: string,
  raw: unknown,
): Promise<PreviewResult> {
  const parsed = SetProjectNextActionInput.safeParse(raw);
  if (!parsed.success) return err(parsed.error.issues[0]?.message ?? "Invalid input");

  const resolved = await resolveProjectByName(userId, parsed.data.projectName);
  if (!resolved.found) {
    return errAmbiguous(
      resolved.candidates.length === 0
        ? `No project found matching "${parsed.data.projectName}"`
        : `Ambiguous project match for "${parsed.data.projectName}"`,
      resolved.candidates,
    );
  }

  const current = await getProjectPlan(userId, resolved.match.id);
  const before = current?.nextAction ?? null;
  return {
    ok: true,
    previewText: `Set next action for "${resolved.match.name}": "${parsed.data.nextAction}"${before ? `\n(was: "${before}")` : ""}`,
    normalizedInput: { projectId: resolved.match.id, projectName: resolved.match.name, nextAction: parsed.data.nextAction },
    warnings: [],
  };
}

async function executeSetProjectNextAction(
  userId: string,
  n: Record<string, unknown>,
): Promise<ExecuteResult> {
  await updateProjectPlan(userId, String(n.projectId), { nextAction: String(n.nextAction) });
  return { ok: true, recordId: String(n.projectId), recordType: "Project", summary: `Set next action for "${n.projectName}"` };
}

// ── Rolodex preview/execute handlers ─────────────────────────────────────

async function previewCreateRolodexPerson(
  _userId: string,
  raw: unknown,
): Promise<PreviewResult> {
  const parsed = CreateRolodexPersonInput.safeParse(raw);
  if (!parsed.success) return err(parsed.error.issues[0]?.message ?? "Invalid input");

  const parts: string[] = [`Create contact: ${parsed.data.displayName}`];
  if (parsed.data.relationshipType) parts.push(parsed.data.relationshipType);
  if (parsed.data.organization) parts.push(`@ ${parsed.data.organization}`);

  return {
    ok: true,
    previewText: parts.join(" · "),
    normalizedInput: parsed.data,
    warnings: [],
  };
}

async function executeCreateRolodexPerson(
  userId: string,
  n: Record<string, unknown>,
): Promise<ExecuteResult> {
  const id = await createPerson(userId, {
    displayName: String(n.displayName),
    firstName: n.firstName ? String(n.firstName) : undefined,
    lastName: n.lastName ? String(n.lastName) : undefined,
    relationshipType: n.relationshipType ? String(n.relationshipType) : undefined,
    organization: n.organization ? String(n.organization) : undefined,
    birthday: n.birthday ? String(n.birthday) : undefined,
    notes: n.notes ? String(n.notes) : undefined,
  });
  return { ok: true, recordId: id, recordType: "RolodexPerson", summary: `Created contact "${n.displayName}"` };
}

async function previewUpdateRolodexPerson(
  userId: string,
  raw: unknown,
): Promise<PreviewResult> {
  const parsed = UpdateRolodexPersonInput.safeParse(raw);
  if (!parsed.success) return err(parsed.error.issues[0]?.message ?? "Invalid input");

  const resolved = await resolvePersonByName(userId, parsed.data.personName);
  if (!resolved.found) {
    return errAmbiguous(
      resolved.candidates.length === 0
        ? `No contact found matching "${parsed.data.personName}"`
        : `Ambiguous contact match for "${parsed.data.personName}"`,
      resolved.candidates,
    );
  }

  const changes: string[] = [];
  if (parsed.data.notes !== undefined) changes.push("notes");
  if (parsed.data.relationshipType !== undefined) changes.push(`relationship → ${parsed.data.relationshipType}`);
  if (parsed.data.organization !== undefined) changes.push(`org → ${parsed.data.organization}`);
  if (parsed.data.giftIdeas !== undefined) changes.push("gift ideas");
  if (parsed.data.communicationNotes !== undefined) changes.push("communication notes");
  if (changes.length === 0) return err("No changes specified");

  return {
    ok: true,
    previewText: `Update contact "${resolved.match.name}": ${changes.join(", ")}`,
    normalizedInput: { ...parsed.data, personId: resolved.match.id, personName: resolved.match.name },
    warnings: [],
  };
}

async function executeUpdateRolodexPerson(
  userId: string,
  n: Record<string, unknown>,
): Promise<ExecuteResult> {
  const patch: Parameters<typeof updatePerson>[2] = {};
  if (n.notes !== undefined) patch.notes = n.notes ? String(n.notes) : null;
  if (n.relationshipType !== undefined) patch.relationshipType = n.relationshipType ? String(n.relationshipType) : null;
  if (n.organization !== undefined) patch.organization = n.organization ? String(n.organization) : null;
  if (n.communicationNotes !== undefined) patch.communicationNotes = n.communicationNotes ? String(n.communicationNotes) : null;
  if (Array.isArray(n.giftIdeas)) {
    const existing = await getPerson(userId, String(n.personId));
    patch.giftIdeas = [...(existing?.giftIdeas ?? []), ...(n.giftIdeas as string[])];
  }

  await updatePerson(userId, String(n.personId), patch);
  return { ok: true, recordId: String(n.personId), recordType: "RolodexPerson", summary: `Updated contact "${n.personName}"` };
}

async function previewAddRolodexInteraction(
  userId: string,
  raw: unknown,
): Promise<PreviewResult> {
  const parsed = AddRolodexInteractionInput.safeParse(raw);
  if (!parsed.success) return err(parsed.error.issues[0]?.message ?? "Invalid input");

  const resolved = await resolvePersonByName(userId, parsed.data.personName);
  if (!resolved.found) {
    return errAmbiguous(
      resolved.candidates.length === 0
        ? `No contact found matching "${parsed.data.personName}"`
        : `Ambiguous contact match for "${parsed.data.personName}"`,
      resolved.candidates,
    );
  }

  const lines = [`Log interaction with "${resolved.match.name}": "${parsed.data.title}"`];
  if (parsed.data.followUpNeeded) lines.push(`Follow-up: ${parsed.data.followUpDate ?? "no date set"}`);

  return {
    ok: true,
    previewText: lines.join("\n"),
    normalizedInput: { ...parsed.data, personId: resolved.match.id, personName: resolved.match.name },
    warnings: [],
  };
}

async function executeAddRolodexInteraction(
  userId: string,
  n: Record<string, unknown>,
): Promise<ExecuteResult> {
  const id = await addInteraction(userId, String(n.personId), {
    title: String(n.title),
    body: n.body ? String(n.body) : undefined,
    followUpNeeded: Boolean(n.followUpNeeded),
    followUpDate: n.followUpDate ? String(n.followUpDate) : undefined,
    sourceTool: "assistant",
  });
  return { ok: true, recordId: id, recordType: "RolodexInteraction", summary: `Logged interaction with "${n.personName}"` };
}

async function previewAddPersonFollowup(
  userId: string,
  raw: unknown,
): Promise<PreviewResult> {
  const parsed = AddPersonFollowupInput.safeParse(raw);
  if (!parsed.success) return err(parsed.error.issues[0]?.message ?? "Invalid input");

  const resolved = await resolvePersonByName(userId, parsed.data.personName);
  if (!resolved.found) {
    return errAmbiguous(
      resolved.candidates.length === 0
        ? `No contact found matching "${parsed.data.personName}"`
        : `Ambiguous contact match for "${parsed.data.personName}"`,
      resolved.candidates,
    );
  }

  return {
    ok: true,
    previewText: `Add follow-up with "${resolved.match.name}": "${parsed.data.title}"${parsed.data.followUpDate ? ` by ${parsed.data.followUpDate}` : ""}`,
    normalizedInput: { ...parsed.data, personId: resolved.match.id, personName: resolved.match.name },
    warnings: [],
  };
}

async function executeAddPersonFollowup(
  userId: string,
  n: Record<string, unknown>,
): Promise<ExecuteResult> {
  const id = await addInteraction(userId, String(n.personId), {
    title: String(n.title),
    followUpNeeded: true,
    followUpDate: n.followUpDate ? String(n.followUpDate) : undefined,
    sourceTool: "assistant",
  });
  return { ok: true, recordId: id, recordType: "RolodexInteraction", summary: `Added follow-up with "${n.personName}"` };
}

async function previewAddGiftIdea(
  userId: string,
  raw: unknown,
): Promise<PreviewResult> {
  const parsed = AddGiftIdeaInput.safeParse(raw);
  if (!parsed.success) return err(parsed.error.issues[0]?.message ?? "Invalid input");

  const resolved = await resolvePersonByName(userId, parsed.data.personName);
  if (!resolved.found) {
    return errAmbiguous(
      resolved.candidates.length === 0
        ? `No contact found matching "${parsed.data.personName}"`
        : `Ambiguous contact match for "${parsed.data.personName}"`,
      resolved.candidates,
    );
  }

  return {
    ok: true,
    previewText: `Add gift idea for "${resolved.match.name}": "${parsed.data.idea}"`,
    normalizedInput: { ...parsed.data, personId: resolved.match.id, personName: resolved.match.name },
    warnings: [],
  };
}

async function executeAddGiftIdea(
  userId: string,
  n: Record<string, unknown>,
): Promise<ExecuteResult> {
  const existing = await getPerson(userId, String(n.personId));
  const updated = [...(existing?.giftIdeas ?? []), String(n.idea)];
  await updatePerson(userId, String(n.personId), { giftIdeas: updated });
  return { ok: true, recordId: String(n.personId), recordType: "RolodexPerson", summary: `Added gift idea for "${n.personName}"` };
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
  // project planning
  update_project_plan: previewUpdateProjectPlan,
  add_project_milestone: previewAddProjectMilestone,
  add_project_question: previewAddProjectQuestion,
  add_project_blocker: previewAddProjectBlocker,
  set_project_next_action: previewSetProjectNextAction,
  // rolodex
  create_rolodex_person: previewCreateRolodexPerson,
  update_rolodex_person: previewUpdateRolodexPerson,
  add_rolodex_interaction: previewAddRolodexInteraction,
  add_person_followup: previewAddPersonFollowup,
  add_gift_idea: previewAddGiftIdea,
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
  // project planning
  update_project_plan: executeUpdateProjectPlan,
  add_project_milestone: executeAddProjectMilestone,
  add_project_question: executeAddProjectQuestion,
  add_project_blocker: executeAddProjectBlocker,
  set_project_next_action: executeSetProjectNextAction,
  // rolodex
  create_rolodex_person: executeCreateRolodexPerson,
  update_rolodex_person: executeUpdateRolodexPerson,
  add_rolodex_interaction: executeAddRolodexInteraction,
  add_person_followup: executeAddPersonFollowup,
  add_gift_idea: executeAddGiftIdea,
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
