import "server-only";
import { z } from "zod";

import { createDoItem, updateDoItem, getDoItemSummary } from "@/lib/services/do";
import { getRunningEntry, startEntry, stopRunning, updateEntry, listRecentEntries, createPastEntry, deleteEntry, getTimeEntry } from "@/lib/services/time";
import { setEntryPeople, listEntryPeople, clearEntryPeople } from "@/lib/services/time-people";
import { listTimeCategories } from "@/lib/services/time-categories";
import {
  setEntryCalendarLink,
  resolveCalendarBlockByTitle,
  suggestCalendarLinkForStart,
  suggestCalendarLinkForRange,
  type CalendarLinkSuggestion,
} from "@/lib/services/time-calendar";
import { listHabits, logHabitProgress, createHabit } from "@/lib/services/habits";
import { createCalendarItem, getCalendarItem, updateCalendarItem, deleteCalendarItem } from "@/lib/services/calendar";
import {
  getReflection,
  upsertReflection,
  buildReflectionSnapshot,
} from "@/lib/services/reflect";
import { updateProject, listBoardProjects, createBoardProject, deleteProject, getProjectDeleteImpact } from "@/lib/services/projects";
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
  getPerson,
  listPersons,
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
  /**
   * A calendar block the assistant may want to link this entry to. Suggested
   * only — the entry is never linked without an explicit calendarEventId /
   * calendarTitle confirmed by the assistant.
   */
  suggestedCalendarLink?: CalendarLinkSuggestion | null;
}

export interface ExecuteResult {
  ok: boolean;
  error?: string;
  recordId: string | null;
  recordType: string | null;
  summary: string;
  /**
   * Same as PreviewResult.suggestedCalendarLink: surfaced here too because
   * the execute path re-validates and the assistant still needs to decide.
   */
  suggestedCalendarLink?: CalendarLinkSuggestion | null;
  /**
   * For batch actions (e.g. log_time_entries): per-entry results in input
   * order. Entries that failed mid-batch carry `error` and a null recordId —
   * nothing is silently dropped.
   */
  entries?: LogTimeEntryBatchResult[];
}

/** Per-entry outcome for a batch time-entry write, in input order. */
export interface LogTimeEntryBatchResult {
  index: number;
  title: string;
  recordId: string | null;
  error?: string;
}

// ── Input schemas ─────────────────────────────────────────────────────────

const CreateTaskInput = z.object({
  title: z
    .string({ error: "title is required (1–200 characters)" })
    .min(1, "title cannot be empty")
    .max(200, "title must be 200 characters or fewer"),
  projectName: z.string().optional(),
  bucket: z.enum(["today", "next", "later", "someday", "backlog"]).default("someday"),
  notes: z.string().optional(),
});

const CompleteTaskInput = z.object({
  taskId: z
    .string({ error: "taskId is required" })
    .min(1, "taskId cannot be empty"),
});

const UpdateTaskInput = z.object({
  taskId: z
    .string({ error: "taskId is required" })
    .min(1, "taskId cannot be empty"),
  title: z.string().min(1, "title cannot be empty").max(200, "title must be 200 characters or fewer").optional(),
  bucket: z.enum(["today", "next", "later", "someday"]).optional(),
  projectName: z.string().optional(),
});

const CreateCalendarBlockInput = z.object({
  title: z
    .string({ error: "title is required (1–200 characters)" })
    .min(1, "title cannot be empty")
    .max(200, "title must be 200 characters or fewer"),
  date: z
    .string({ error: "date is required" })
    .regex(/^\d{4}-\d{2}-\d{2}$/, "date must be YYYY-MM-DD (e.g. 2026-10-16)"),
  startTime: z
    .string({ error: "startTime is required" })
    .regex(/^\d{2}:\d{2}$/, "startTime must be HH:MM from 00:00 to 23:59"),
  endTime: z
    .string({ error: "endTime is required" })
    .regex(/^\d{2}:\d{2}$/, "endTime must be HH:MM from 00:00 to 23:59"),
  notes: z.string().optional(),
});

const StartTimerInput = z.object({
  title: z
    .string({ error: "title is required (1–200 characters)" })
    .min(1, "title cannot be empty")
    .max(200, "title must be 200 characters or fewer"),
  categoryName: z.string().optional(),
  habitName: z.string().optional(),
  personNames: z.array(z.string()).optional(),
  /** Explicit calendar block id (or virtual recurrence-occurrence id). */
  calendarEventId: z.string().min(1).optional(),
  /** Fuzzy-matched against today's calendar blocks (warn-and-skip). */
  calendarTitle: z.string().min(1).max(200).optional(),
});

const StopTimerInput = z.object({
  entryId: z.string().optional(),
  endedAtLocal: z.string().optional(), // "YYYY-MM-DDTHH:MM:SS" local time; omit for now
  note: z.string().optional(),
});

const SwapTimerInput = z.object({
  title: z
    .string({ error: "title is required (1–200 characters)" })
    .min(1, "title cannot be empty")
    .max(200, "title must be 200 characters or fewer"),
  note: z.string().optional(), // saved onto the STOPPED entry
  categoryName: z.string().optional(),
  habitName: z.string().optional(),
  personNames: z.array(z.string()).optional(), // linked to the NEW timer
});

const EditTimeEntryInput = z.object({
  entryId: z
    .string({ error: "entryId is required — copy the id from the Time view" })
    .min(1, "entryId cannot be empty"),
  title: z.string().min(1, "title cannot be empty").max(200, "title must be 200 characters or fewer").optional(),
  startedAt: z.string().optional(), // ISO
  endedAt: z.string().optional(),   // ISO
  categoryName: z.string().optional(),
  personNames: z.array(z.string()).optional(),
});

const LogTimeEntryInput = z.object({
  title: z
    .string({ error: "title is required (1–200 characters)" })
    .min(1, "title cannot be empty")
    .max(200, "title must be 200 characters or fewer"),
  startedAt: z.string({ error: "startedAt is required (ISO datetime, e.g. 2026-10-16T09:00:00)" }),
  endedAt: z.string({ error: "endedAt is required (ISO datetime, e.g. 2026-10-16T10:00:00)" }),
  categoryName: z.string().optional(),
  notes: z.string().optional(),
  personNames: z.array(z.string()).optional(),
  /** Explicit calendar block id (or virtual recurrence-occurrence id). */
  calendarEventId: z.string().min(1).optional(),
  /** Fuzzy-matched against today's calendar blocks (warn-and-skip). */
  calendarTitle: z.string().min(1).max(200).optional(),
});

/**
 * Batch backfill: same per-entry shape as log_time_entry, 1–50 entries.
 * Validated all-or-nothing — every entry is checked before any are written.
 */
const LogTimeEntriesInput = z.object({
  entries: z
    .array(LogTimeEntryInput)
    .min(1, "entries must contain at least 1 time entry — nothing to log")
    .max(
      50,
      "entries is limited to 50 per call — split larger backfills into multiple calls",
    ),
});

const LogHabitInput = z.object({
  habitName: z
    .string({ error: "habitName is required" })
    .min(1, "habitName cannot be empty"),
  value: z.number().positive("value must be a positive number").optional(),
  note: z.string().optional(),
});

const CreateHabitInput = z.object({
  title: z
    .string({ error: "title is required (1–200 characters)" })
    .min(1, "title cannot be empty")
    .max(200, "title must be 200 characters or fewer"),
  cadence: z.enum(["daily", "weekdays", "weekly", "custom"]).default("daily"),
  dayPart: z.enum(["morning", "day", "evening", "anytime"]).default("anytime"),
  targetCount: z.number().int().positive().max(100000).optional(),
  goalUnit: z.enum(["check", "count", "minutes"]).default("check"),
  notes: z.string().max(2000).optional(),
  reminderTime: z
    .string()
    .regex(/^\d{2}:\d{2}$/, "reminderTime must be HH:MM")
    .optional(),
});

const AddReflectionInput = z.object({
  mood: z.number().min(1).max(5).optional(),
  note: z.string().optional(),
});

const UpdateProjectInput = z
  .object({
    projectName: z.string().min(1).optional(),
    /** Explicit project id (wins over projectName when both are given). */
    projectId: z.string().min(1).optional(),
    status: z.enum(["active", "paused", "done"]).optional(),
    notes: z.string().optional(),
  })
  .refine((v) => v.projectName || v.projectId, {
    message: "Provide projectName or projectId to identify the project to update",
  });

const CreateProjectInput = z.object({
  name: z.string().min(1).max(200),
  intent: z.string().max(1000).optional(),
  status: z
    .enum(["exploring", "active", "final_push", "paused", "done"], {
      error: "status must be one of: exploring, active, final_push, paused, done",
    })
    .optional(),
  energyType: z
    .enum(["deep", "light", "creative", "admin"], {
      error: "energyType must be one of: deep, light, creative, admin",
    })
    .optional(),
  timeBudgetMinutes: z.number().int().positive().max(10080).optional(),
  targetDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "targetDate must be YYYY-MM-DD")
    .optional(),
});

const DeleteProjectInput = z
  .object({
    projectName: z.string().min(1).optional(),
    projectId: z.string().min(1).optional(),
    deleteTasks: z.boolean().default(false),
  })
  .refine((v) => v.projectName || v.projectId, {
    message: "Provide projectName or projectId",
  });

const UpdateCalendarEventInput = z.object({
  eventId: z.string().min(1),
  title: z.string().min(1).max(200).optional(),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "date must be YYYY-MM-DD")
    .optional(),
  startTime: z
    .string()
    .regex(/^\d{2}:\d{2}$/, "startTime must be HH:MM")
    .optional(),
  endTime: z
    .string()
    .regex(/^\d{2}:\d{2}$/, "endTime must be HH:MM")
    .optional(),
  notes: z.string().max(5000).optional(),
  location: z.string().max(300).optional(),
});

const DeleteCalendarEventInput = z.object({
  eventId: z.string().min(1),
});

const DeleteTimeEntryInput = z.object({
  entryId: z.string().min(1),
});

/**
 * Every project-planning action identifies its project by projectName or
 * projectId (explicit id wins when both are given).
 */
const projectRefFields = {
  projectName: z.string().min(1).optional(),
  projectId: z.string().min(1).optional(),
};

const projectRefRefine = {
  message: "Provide projectName or projectId to identify the project",
} as const;

const UpdateProjectPlanInput = z
  .object({
    ...projectRefFields,
    goal: z.string().max(1000).optional(),
    whyItMatters: z.string().max(1000).optional(),
    nextMilestone: z.string().max(500).optional(),
    nextAction: z.string().max(500).optional(),
    planNotes: z.string().max(5000).optional(),
  })
  .refine((v) => v.projectName || v.projectId, projectRefRefine);

const AddProjectMilestoneInput = z
  .object({ ...projectRefFields, milestone: z.string().min(1).max(500) })
  .refine((v) => v.projectName || v.projectId, projectRefRefine);

const AddProjectQuestionInput = z
  .object({ ...projectRefFields, question: z.string().min(1).max(500) })
  .refine((v) => v.projectName || v.projectId, projectRefRefine);

const AddProjectBlockerInput = z
  .object({ ...projectRefFields, blocker: z.string().min(1).max(500) })
  .refine((v) => v.projectName || v.projectId, projectRefRefine);

const SetProjectNextActionInput = z
  .object({ ...projectRefFields, nextAction: z.string().min(1).max(500) })
  .refine((v) => v.projectName || v.projectId, projectRefRefine);

const CreateRolodexPersonInput = z.object({
  displayName: z.string().min(1).max(200),
  firstName: z.string().max(100).optional(),
  lastName: z.string().max(100).optional(),
  relationshipType: z.string().optional(),
  organization: z.string().max(200).optional(),
  birthday: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "birthday must be YYYY-MM-DD (e.g. 1990-05-14)")
    .optional(),
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
  followUpDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "followUpDate must be YYYY-MM-DD (e.g. 2026-10-20)")
    .optional(),
});

const AddPersonFollowupInput = z.object({
  personName: z.string().min(1),
  title: z.string().min(1).max(300),
  followUpDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "followUpDate must be YYYY-MM-DD (e.g. 2026-10-20)")
    .optional(),
});

const AddGiftIdeaInput = z.object({
  personName: z.string().min(1),
  idea: z.string().min(1).max(300),
});

// ── Action → input schema map ──────────────────────────────────────────────
// Exported so the MCP wrapper (and any future API surface) can reuse the
// same input contracts as the HTTP preview/execute endpoints.

export const ACTION_INPUT_SCHEMAS: Record<string, z.ZodTypeAny> = {
  create_task: CreateTaskInput,
  complete_task: CompleteTaskInput,
  update_task: UpdateTaskInput,
  create_calendar_block: CreateCalendarBlockInput,
  update_calendar_event: UpdateCalendarEventInput,
  delete_calendar_event: DeleteCalendarEventInput,
  start_timer: StartTimerInput,
  stop_timer: StopTimerInput,
  swap_timer: SwapTimerInput,
  edit_time_entry: EditTimeEntryInput,
  log_time_entry: LogTimeEntryInput,
  log_time_entries: LogTimeEntriesInput,
  delete_time_entry: DeleteTimeEntryInput,
  log_habit: LogHabitInput,
  create_habit: CreateHabitInput,
  add_reflection: AddReflectionInput,
  update_project: UpdateProjectInput,
  create_project: CreateProjectInput,
  delete_project: DeleteProjectInput,
  update_project_plan: UpdateProjectPlanInput,
  add_project_milestone: AddProjectMilestoneInput,
  add_project_question: AddProjectQuestionInput,
  add_project_blocker: AddProjectBlockerInput,
  set_project_next_action: SetProjectNextActionInput,
  create_rolodex_person: CreateRolodexPersonInput,
  update_rolodex_person: UpdateRolodexPersonInput,
  add_rolodex_interaction: AddRolodexInteractionInput,
  add_person_followup: AddPersonFollowupInput,
  add_gift_idea: AddGiftIdeaInput,
};

// ── Name resolvers (read-only) ────────────────────────────────────────────
// Consistent policy for every name lookup across actions:
//   - exact (case-insensitive) match wins;
//   - a single close (substring) match is NEVER picked silently — optional
//     links warn-and-skip with a suggestion, required names fail with a
//     "did you mean …?" error;
//   - zero or ambiguous matches never guess: required names fail listing
//     candidates, optional links warn-and-skip.

type ResolveResult<T> =
  | { found: true; match: T }
  | { found: false; candidates: AmbiguityCandidate[]; suggestion?: string };
export type NameMatchKind = "exact" | "close" | "ambiguous" | "none";

export interface NameMatch<T> {
  kind: NameMatchKind;
  /** The single candidate for "exact" and "close"; null otherwise. */
  match: T | null;
  /** Close candidates: the one ("close") or the several ("ambiguous"). */
  candidates: T[];
}

/**
 * Classify a name against candidate items. `names` returns every name form an
 * item can be matched by (e.g. display name plus aliases); "exact" means some
 * form equals the query case-insensitively, "close" means exactly one item
 * has a form containing the query.
 */
export function classifyNameMatch<T>(
  items: T[],
  name: string,
  names: (item: T) => string[],
): NameMatch<T> {
  const lower = name.toLowerCase();
  const exact = items.filter((item) =>
    names(item).some((n) => n.toLowerCase() === lower),
  );
  if (exact.length === 1) return { kind: "exact", match: exact[0]!, candidates: [] };
  if (exact.length > 1) return { kind: "ambiguous", match: null, candidates: exact };
  const close = items.filter((item) =>
    names(item).some((n) => n.toLowerCase().includes(lower)),
  );
  if (close.length === 1) return { kind: "close", match: close[0]!, candidates: close };
  if (close.length > 1) return { kind: "ambiguous", match: null, candidates: close };
  return { kind: "none", match: null, candidates: [] };
}

/** Everything a caller needs: the classification plus the full item list. */
export interface ResolvedNames<T> {
  match: NameMatch<T>;
  all: T[];
}

async function resolveProjectByName(
  userId: string,
  name: string,
): Promise<ResolveResult<{ id: string; name: string }>> {
  const projects = await listBoardProjects(userId);
  const lower = name.toLowerCase();

  const exact = projects.filter((p) => p.name.toLowerCase() === lower);
  if (exact.length === 1) return { found: true, match: exact[0]! };

  const partial = projects.filter((p) => p.name.toLowerCase().includes(lower));
  if (partial.length === 1) {
    // One close match: never pick it silently — hand back a suggestion so
    // the caller can ask rather than guess.
    const only = partial[0]!;
    return {
      found: false,
      candidates: [{ id: only.id, name: only.name }],
      suggestion: only.name,
    };
  }

  const pool = exact.length > 1 ? exact : partial;
  return {
    found: false,
    candidates: pool.map((p) => ({ id: p.id, name: p.name })),
  };
}

/**
 * Shared "project not found" message for project actions. Exact match wins;
 * a single close match becomes a "did you mean" suggestion; several matches
 * list candidates; zero matches point at the project list.
 */
function projectResolutionError(
  name: string,
  candidates: AmbiguityCandidate[],
  suggestion: string | undefined,
  idHint: boolean,
): string {
  const retry = idHint
    ? " Retry with the exact project name, or pass projectId to pick one."
    : "";
  if (suggestion) {
    return `No exact project match for "${name}" — did you mean "${suggestion}"?${retry}`;
  }
  if (candidates.length > 0) {
    return `Ambiguous project match for "${name}" — ${candidates.length} projects match.${retry}`;
  }
  return `No project found matching "${name}". Use assistant_list_projects to see exact project names.`;
}

/**
 * Resolve a project by explicit id (wins when given) or by name. Used by
 * every project action so id formats and not-found behavior are identical.
 */
async function resolveProjectRef(
  userId: string,
  ref: { projectName?: string; projectId?: string },
): Promise<
  | { ok: true; project: { id: string; name: string } }
  | { ok: false; error: string; candidates: AmbiguityCandidate[] }
> {
  if (ref.projectId) {
    const projects = await listBoardProjects(userId);
    const found = projects.find((p) => p.id === ref.projectId);
    if (!found) {
      return {
        ok: false,
        error: `Project id "${ref.projectId}" not found. Use assistant_list_projects to see valid project ids.`,
        candidates: [],
      };
    }
    return { ok: true, project: found };
  }
  const resolved = await resolveProjectByName(userId, ref.projectName!);
  if (resolved.found) return { ok: true, project: resolved.match };
  return {
    ok: false,
    error: projectResolutionError(
      ref.projectName!,
      resolved.candidates,
      resolved.suggestion,
      true,
    ),
    candidates: resolved.candidates,
  };
}

async function resolveHabitByName(
  userId: string,
  name: string,
): Promise<
  ResolvedNames<{ id: string; title: string; bucket: string | null }>
> {
  const habits = await listHabits(userId);
  return {
    match: classifyNameMatch(habits, name, (h) => [h.title]),
    all: habits,
  };
}

/** Person name forms: display name plus first/last name and aliases. */
function personNameForms(p: {
  displayName: string;
  firstName?: string | null;
  lastName?: string | null;
  aliases: string[];
}): string[] {
  return [
    p.displayName,
    ...(p.firstName ? [p.firstName] : []),
    ...(p.lastName ? [p.lastName] : []),
    ...p.aliases,
  ];
}

const KNOWN_LIST_LIMIT = 8;

/** " Known projects: "A", "B" (+2 more)." — empty string when there's nothing. */
function formatKnownList(names: string[], label: string): string {
  if (names.length === 0) return "";
  const shown = names.slice(0, KNOWN_LIST_LIMIT);
  const more =
    names.length > shown.length ? ` (+${names.length - shown.length} more)` : "";
  return ` Known ${label}: ${shown.map((n) => `"${n}"`).join(", ")}${more}.`;
}

interface RequiredNameOpts<T> {
  label: string;
  input: string;
  toCandidate: (item: T) => AmbiguityCandidate;
  nameOf: (item: T) => string;
  /** Extra guidance appended to the no-match error (e.g. where to list ids). */
  hint?: string;
}

/**
 * Required-name failure: exact wins (caller handles it); a single close match
 * becomes a "did you mean …?" error (never picked silently); ambiguous lists
 * candidates; none lists what exists. Always ok:false with candidates.
 */
function requiredNameError<T>(
  resolved: ResolvedNames<T>,
  opts: RequiredNameOpts<T>,
): PreviewResult {
  const { label, input } = opts;
  const { match, all } = resolved;
  if (match.kind === "close") {
    const item = match.match!;
    return errAmbiguous(
      `No ${label} exactly matching "${input}" — did you mean "${opts.nameOf(item)}"? Pass the exact name and retry.`,
      [opts.toCandidate(item)],
    );
  }
  if (match.kind === "ambiguous") {
    const names = match.candidates.map((c) => `"${opts.nameOf(c)}"`).join(", ");
    return errAmbiguous(
      `Ambiguous ${label} match for "${input}" — pass the exact name: ${names}.`,
      match.candidates.map(opts.toCandidate),
    );
  }
  const hint = opts.hint ? ` ${opts.hint}` : "";
  return errAmbiguous(
    `No ${label} found matching "${input}".${formatKnownList(all.map(opts.nameOf), `${label}s`)}${hint}`,
    [],
  );
}

interface OptionalNameOpts<T> {
  label: string;
  input: string;
  nameOf: (item: T) => string;
  /** Explains what happens without the link, e.g. "task will be created without a project". */
  skipNote?: string;
}

/** Shared options for every required projectName lookup. */
const PROJECT_NAME_OPTS = {
  label: "project",
  toCandidate: (p: { id: string; name: string }) => ({ id: p.id, name: p.name }),
  nameOf: (p: { id: string; name: string }) => p.name,
  hint: "List projects via GET /api/assistant/projects.",
};


/**
 * Optional-link warning: returns null when the match is exact (caller links
 * it); otherwise a warn-and-skip message — a close match suggests the exact
 * name instead of linking, never silently picks.
 */
function optionalNameWarning<T>(
  resolved: ResolvedNames<T>,
  opts: OptionalNameOpts<T>,
): string | null {
  const { label, input, skipNote } = opts;
  const { match } = resolved;
  const tail = skipNote ? ` ${skipNote}` : "";
  if (match.kind === "exact") return null;
  if (match.kind === "close") {
    return `"${input}" is close to "${opts.nameOf(match.match!)}" but not an exact match — not linked.${tail} Pass the exact name to link it.`;
  }
  if (match.kind === "ambiguous") {
    const names = match.candidates.map((c) => opts.nameOf(c)).join(", ");
    return `Multiple ${label}s matched "${input}" (${names}) — skipping to avoid a wrong link.${tail}`;
  }
  return `No ${label} matched "${input}" — skipping.${tail}`;
}

/**
 * Resolve display names to Rolodex person IDs. Exact matches (display name,
 * first/last name, or alias) win; a single close match warns and is skipped
 * with a suggestion; zero or ambiguous matches warn and skip. Never fails the
 * whole action, never guesses.
 */
async function resolvePeopleByNames(
  userId: string,
  names: string[],
): Promise<{ personIds: string[]; labels: string[]; warnings: string[] }> {
  const ids: string[] = [];
  const labels: string[] = [];
  const warnings: string[] = [];
  for (const raw of names) {
    const name = raw.trim();
    if (!name) continue;
    const matches = await findPersonByName(userId, name);
    const m = classifyNameMatch(matches, name, personNameForms);
    if (m.kind === "exact") {
      ids.push(m.match!.id);
      labels.push(m.match!.displayName);
    } else if (m.kind === "close") {
      warnings.push(
        `"${name}" is close to "${m.match!.displayName}" but not an exact match — not linked. Pass the exact name to link them.`,
      );
    } else if (m.kind === "ambiguous") {
      warnings.push(
        `Multiple people matched "${name}" (${m.candidates
          .map((p) => p.displayName)
          .join(", ")}) — skipping to avoid a wrong link`,
      );
    } else {
      warnings.push(
        `No Rolodex person matched "${name}" — no one linked for that name`,
      );
    }
  }
  return {
    personIds: [...new Set(ids)],
    labels: [...new Set(labels)],
    warnings,
  };
}

/**
 * Resolve a category name against the user's time categories. An exact
 * (case-insensitive) match is normalized to the stored name; a single close
 * or ambiguous match warns and is skipped (never silently remapped); with no
 * match at all the raw value is kept — categories are free text in the app,
 * so this saves it as a new category — with a warning naming the existing
 * categories.
 */
async function resolveCategoryName(
  userId: string,
  raw: string | undefined,
): Promise<{ category: string | null; warnings: string[] }> {
  const warnings: string[] = [];
  const name = raw?.trim();
  if (!name) return { category: null, warnings };
  let categories: { name: string }[] = [];
  try {
    categories = await listTimeCategories(userId);
  } catch (error) {
    console.error("[assistant] listTimeCategories failed", error);
  }
  const m = classifyNameMatch(categories, name, (c) => [c.name]);
  if (m.kind === "exact") return { category: m.match!.name, warnings };
  const known = formatKnownList(
    categories.map((c) => c.name),
    "categories",
  );
  if (m.kind === "close") {
    warnings.push(
      `Category "${name}" is close to "${m.match!.name}" but not an exact match — not set. Pass the exact category name.${known}`,
    );
    return { category: null, warnings };
  }
  if (m.kind === "ambiguous") {
    warnings.push(
      `Category "${name}" matched several categories (${m.candidates
        .map((c) => c.name)
        .join(", ")}) — not set. Pass the exact category name.`,
    );
    return { category: null, warnings };
  }
  warnings.push(
    `Category "${name}" is not one of your existing categories — it will be saved as a new category.${known}`,
  );
  return { category: name, warnings };
}

// ── Calendar link resolution (planned vs actual) ────────────────────────────

interface ResolvedCalendarLink {
  /** Backing CalendarItem id, or null when no link was established. */
  eventId: string | null;
  title: string | null;
  warnings: string[];
  /** Suffix for the preview text, e.g. ` · for "Standup"`. */
  linkedNote: string;
}

/**
 * Resolve an explicit calendarEventId (validated against the user's calendar;
 * virtual recurrence ids resolve to the parent row) or a fuzzy calendarTitle
 * (matched against today's blocks, warn-and-skip). An explicit id always wins;
 * an unknown id warns and skips — never fails, never guesses.
 */
async function resolveCalendarLinkInput(
  userId: string,
  input: { calendarEventId?: string; calendarTitle?: string },
): Promise<ResolvedCalendarLink> {
  const warnings: string[] = [];
  const { calendarEventId, calendarTitle } = input;

  if (calendarEventId) {
    if (calendarTitle) {
      warnings.push("calendarTitle ignored — explicit calendarEventId provided");
    }
    const item = await getCalendarItem(userId, calendarEventId);
    if (!item) {
      warnings.push(
        `Calendar event "${calendarEventId}" not found — continuing without a calendar link. List events via GET /api/assistant/calendar to get a valid event id`,
      );
      return { eventId: null, title: null, warnings, linkedNote: "" };
    }
    return {
      eventId: item.id,
      title: item.title,
      warnings,
      linkedNote: ` · for "${item.title}"`,
    };
  }

  if (calendarTitle) {
    const resolved = await resolveCalendarBlockByTitle(userId, calendarTitle);
    warnings.push(...resolved.warnings);
    if (resolved.eventId) {
      return {
        eventId: resolved.eventId,
        title: resolved.title,
        warnings,
        linkedNote: ` · for "${resolved.title}"`,
      };
    }
    return { eventId: null, title: null, warnings, linkedNote: "" };
  }

  return { eventId: null, title: null, warnings, linkedNote: "" };
}

/** Pass a suggestedCalendarLink through normalized input safely. */
function coerceCalendarSuggestion(
  value: unknown,
): CalendarLinkSuggestion | null {
  if (
    typeof value === "object" &&
    value !== null &&
    typeof (value as Record<string, unknown>).eventId === "string" &&
    typeof (value as Record<string, unknown>).title === "string"
  ) {
    const v = value as { eventId: string; title: string };
    return { eventId: v.eventId, title: v.title };
  }
  return null;
}

// ── Date helpers ──────────────────────────────────────────────────────────

/**
 * Parse "YYYY-MM-DD" + "HH:MM" as app-local time, strictly. Rejects impossible
 * times ("24:00") and impossible dates ("2026-02-30") that the native Date
 * parser silently rolls over into a different day.
 */
function parseLocalDateTimeStrict(
  date: string,
  time: string,
): { ok: true; date: Date } | { ok: false; error: string } {
  const tm = /^(\d{2}):(\d{2})$/.exec(time);
  const hh = tm ? Number(tm[1]) : NaN;
  const mm = tm ? Number(tm[2]) : NaN;
  if (!tm || hh > 23 || mm > 59) {
    return {
      ok: false,
      error: `"${time}" is not a valid time — use HH:MM from 00:00 to 23:59`,
    };
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return {
      ok: false,
      error: `"${date}" is not a valid date — use YYYY-MM-DD (e.g. 2026-10-16)`,
    };
  }
  const d = new Date(`${date}T${time}:00`);
  if (Number.isNaN(d.getTime())) {
    return { ok: false, error: `"${date} ${time}" is not a valid date/time` };
  }
  if (localDatePart(d) !== date) {
    return { ok: false, error: `"${date}" is not a real calendar date` };
  }
  return { ok: true, date: d };
}

/** "Thing" not found by id, with a pointer to where valid ids come from. */
function idNotFound(what: string, id: string, listHint: string): string {
  return `${what} "${id}" not found — ${listHint}`;
}

// Extract local "YYYY-MM-DD" / "HH:MM" parts from a Date (same TZ assumption).
function localDatePart(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function localTimePart(d: Date): string {
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

// ── Preview handlers ──────────────────────────────────────────────────────

async function previewCreateTask(
  userId: string,
  raw: unknown,
): Promise<PreviewResult> {
  const parsed = CreateTaskInput.safeParse(raw);
  if (!parsed.success) {
    return zodErr(parsed.error);
  }
  const { title, projectName, bucket, notes } = parsed.data;
  const warnings: string[] = [];
  let projectId: string | null = null;
  let resolvedProjectName: string | null = null;

  if (projectName) {
    const resolved = await resolveProjectByName(userId, projectName);
    if (resolved.found) {
      projectId = resolved.match.id;
      resolvedProjectName = resolved.match.name;
    } else {
      const skipNote = "Task will be created without a project.";
      if (resolved.suggestion) {
        warnings.push(`"${projectName}" is close to "${resolved.suggestion}" but not an exact match — not linked. ${skipNote} Pass the exact name to link it.`);
      } else if (resolved.candidates.length > 0) {
        const names = resolved.candidates.map((c) => c.name).join(", ");
        warnings.push(`Multiple projects matched "${projectName}" (${names}) — skipping to avoid a wrong link. ${skipNote}`);
      } else {
        warnings.push(`No project matched "${projectName}" — skipping. ${skipNote}`);
      }
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
    return zodErr(parsed.error);
  }
  const { taskId } = parsed.data;
  const task = await getDoItemSummary(userId, taskId);
  if (!task) {
    return err(
      idNotFound(
        "Task",
        taskId,
        "list tasks via GET /api/assistant/tasks to get a valid task id",
      ),
    );
  }
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
    return zodErr(parsed.error);
  }
  const { taskId, title, bucket, projectName } = parsed.data;
  const task = await getDoItemSummary(userId, taskId);
  if (!task) {
    return err(
      idNotFound(
        "Task",
        taskId,
        "list tasks via GET /api/assistant/tasks to get a valid task id",
      ),
    );
  }

  const warnings: string[] = [];
  let projectId: string | undefined | null = undefined;
  let resolvedProjectName: string | null = null;

  if (projectName !== undefined) {
    if (projectName === "") {
      projectId = null;
    } else {
      const resolved = await resolveProjectByName(userId, projectName);
      if (resolved.found) {
        projectId = resolved.match.id;
        resolvedProjectName = resolved.match.name;
      } else {
        const skipNote = "Project will not be changed.";
        if (resolved.suggestion) {
          warnings.push(`"${projectName}" is close to "${resolved.suggestion}" but not an exact match — not linked. ${skipNote} Pass the exact name to link it.`);
        } else if (resolved.candidates.length > 0) {
          const names = resolved.candidates.map((c) => c.name).join(", ");
          warnings.push(`Multiple projects matched "${projectName}" (${names}) — skipping to avoid a wrong link. ${skipNote}`);
        } else {
          warnings.push(`No project matched "${projectName}" — skipping. ${skipNote}`);
        }
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
  if (title !== undefined && title !== task.title) changes.push(`title → "${title}"`);
  if (bucket !== undefined && bucket !== task.lane) changes.push(`lane → [${bucket}]`);
  if (projectId !== undefined) {
    if (projectId === task.projectId) {
      // Already on this project — not a change.
      projectId = undefined;
      delete normalizedInput.projectId;
    } else {
      changes.push(
        projectId === null ? `project → none` : `project → "${resolvedProjectName}"`,
      );
    }
  }
  if (changes.length === 0) {
    return err(
      "No changes specified — pass at least one of: title, bucket, projectName",
    );
  }

  return {
    ok: true,
    previewText: `Update task "${task.title}": ${changes.join(", ")}`,
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
    return zodErr(parsed.error);
  }
  const { title, date, startTime, endTime, notes } = parsed.data;

  const startsAt = parseLocalDateTimeStrict(date, startTime);
  if (!startsAt.ok) return err(`Invalid startTime: ${startsAt.error}`);
  const endsAt = parseLocalDateTimeStrict(date, endTime);
  if (!endsAt.ok) return err(`Invalid endTime: ${endsAt.error}`);
  if (endsAt.date <= startsAt.date) {
    return err(
      `End time must be after start time (got ${startTime}–${endTime} on ${date})`,
    );
  }

  return {
    ok: true,
    previewText: `Create calendar block "${title}" on ${date} ${startTime}–${endTime}`,
    normalizedInput: {
      title,
      startsAtIso: startsAt.date.toISOString(),
      endsAtIso: endsAt.date.toISOString(),
      notes: notes ?? null,
    },
    warnings: [],
  };
}

async function previewUpdateCalendarEvent(
  userId: string,
  raw: unknown,
): Promise<PreviewResult> {
  const parsed = UpdateCalendarEventInput.safeParse(raw);
  if (!parsed.success) {
    return zodErr(parsed.error);
  }
  const { eventId, title, date, startTime, endTime, notes, location } = parsed.data;

  const item = await getCalendarItem(userId, eventId);
  if (!item) {
    return err(
      idNotFound(
        "Calendar event",
        eventId,
        "list events via GET /api/assistant/calendar to get a valid event id",
      ),
    );
  }

  const newDate = date ?? localDatePart(item.startsAt);
  const newStartTime = startTime ?? localTimePart(item.startsAt);
  const newEndTime = endTime ?? localTimePart(item.endsAt);
  const startsAt = parseLocalDateTimeStrict(newDate, newStartTime);
  if (!startsAt.ok) return err(`Invalid start time: ${startsAt.error}`);
  const endsAt = parseLocalDateTimeStrict(newDate, newEndTime);
  if (!endsAt.ok) return err(`Invalid end time: ${endsAt.error}`);
  if (endsAt.date <= startsAt.date) {
    return err(
      `End time must be after start time (got ${newStartTime}–${newEndTime} on ${newDate})`,
    );
  }

  const changes: string[] = [];
  if (title !== undefined && title !== item.title) changes.push(`title → "${title}"`);
  if (
    startsAt.date.getTime() !== item.startsAt.getTime() ||
    endsAt.date.getTime() !== item.endsAt.getTime()
  ) {
    changes.push(`time → ${newDate} ${newStartTime}–${newEndTime}`);
  }
  if (notes !== undefined) changes.push(`notes updated`);
  if (location !== undefined) changes.push(`location → ${location || "none"}`);
  if (changes.length === 0) {
    return err(
      "No changes specified — pass at least one of: title, date, startTime, endTime, notes, location",
    );
  }

  return {
    ok: true,
    previewText: `Update calendar event "${item.title}": ${changes.join(", ")}`,
    normalizedInput: {
      eventId,
      beforeTitle: item.title,
      title: title ?? null,
      startsAtIso: startsAt.date.toISOString(),
      endsAtIso: endsAt.date.toISOString(),
      timeChanged:
        startsAt.date.getTime() !== item.startsAt.getTime() ||
        endsAt.date.getTime() !== item.endsAt.getTime(),
      notes: notes ?? null,
      notesChanged: notes !== undefined,
      location: location ?? null,
      locationChanged: location !== undefined,
    },
    warnings: [],
  };
}

async function previewDeleteCalendarEvent(
  userId: string,
  raw: unknown,
): Promise<PreviewResult> {
  const parsed = DeleteCalendarEventInput.safeParse(raw);
  if (!parsed.success) {
    return zodErr(parsed.error);
  }
  const { eventId } = parsed.data;

  const item = await getCalendarItem(userId, eventId);
  if (!item) {
    return err(
      idNotFound(
        "Calendar event",
        eventId,
        "list events via GET /api/assistant/calendar to get a valid event id",
      ),
    );
  }

  return {
    ok: true,
    previewText:
      `Delete calendar event "${item.title}" ` +
      `on ${localDatePart(item.startsAt)} ` +
      `${localTimePart(item.startsAt)}–${localTimePart(item.endsAt)}` +
      `\nThis permanently deletes the event. This cannot be undone.`,
    normalizedInput: { eventId, beforeTitle: item.title },
    warnings: [],
  };
}

async function previewStartTimer(
  userId: string,
  raw: unknown,
): Promise<PreviewResult> {
  const parsed = StartTimerInput.safeParse(raw);
  if (!parsed.success) {
    return zodErr(parsed.error);
  }
  const { title, categoryName, habitName, personNames, calendarEventId, calendarTitle } = parsed.data;
  const warnings: string[] = [];
  let habitId: string | null = null;

  if (habitName) {
    const resolved = await resolveHabitByName(userId, habitName);
    const warning = optionalNameWarning(resolved, {
      label: "habit",
      input: habitName,
      nameOf: (h) => h.title,
      skipNote: "Timer will start without a habit link.",
    });
    if (warning) {
      warnings.push(warning);
    } else {
      habitId = resolved.match.match!.id;
    }
  }

  let category: string | null = null;
  if (categoryName) {
    const resolved = await resolveCategoryName(userId, categoryName);
    category = resolved.category;
    warnings.push(...resolved.warnings);
  }

  let personIds: string[] = [];
  let peopleNote = "";
  if (personNames) {
    const resolved = await resolvePeopleByNames(userId, personNames);
    personIds = resolved.personIds;
    warnings.push(...resolved.warnings);
    peopleNote =
      resolved.labels.length > 0 ? ` · with ${resolved.labels.join(", ")}` : "";
  }

  const calendarLink = await resolveCalendarLinkInput(userId, {
    calendarEventId,
    calendarTitle,
  });
  warnings.push(...calendarLink.warnings);

  // Suggest a block when starting near its start — suggested only, never
  // linked without the assistant's explicit confirmation. Best-effort: a
  // calendar read failure must never break starting the timer.
  let suggestedCalendarLink: CalendarLinkSuggestion | null = null;
  if (!calendarLink.eventId) {
    try {
      suggestedCalendarLink = await suggestCalendarLinkForStart(userId);
    } catch (error) {
      console.error("[assistant] calendar suggestion failed", error);
    }
  }

  const running = await getRunningEntry(userId);
  const stopNote = running ? ` (stops running timer: "${running.label}")` : "";

  return {
    ok: true,
    previewText: `Start timer "${title}"${category ? ` [${category}]` : ""}${peopleNote}${calendarLink.linkedNote}${stopNote}`,
    normalizedInput: {
      title,
      category,
      habitId,
      personIds,
      calendarEventId: calendarLink.eventId,
      suggestedCalendarLink,
    },
    warnings,
    suggestedCalendarLink,
  };
}

async function previewStopTimer(
  userId: string,
  raw: unknown,
): Promise<PreviewResult> {
  const parsed = StopTimerInput.safeParse(raw);
  if (!parsed.success) {
    return zodErr(parsed.error);
  }
  const { entryId, endedAtLocal, note } = parsed.data;

  const running = await getRunningEntry(userId);
  if (!running) return err("No timer is currently running");

  if (entryId && entryId !== running.id) {
    return err(
      `entryId "${entryId}" does not match the running timer "${running.label}" (id "${running.id}") — pass entryId "${running.id}" or omit entryId to stop the running timer`,
    );
  }

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
  if (note && note.trim().length > 0) {
    lines.push(`Note: "${note.slice(0, 80)}${note.length > 80 ? "…" : ""}"`);
  }

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

async function previewSwapTimer(
  userId: string,
  raw: unknown,
): Promise<PreviewResult> {
  const parsed = SwapTimerInput.safeParse(raw);
  if (!parsed.success) {
    return zodErr(parsed.error);
  }
  const { title, note, categoryName, habitName, personNames } = parsed.data;
  const warnings: string[] = [];
  let habitId: string | null = null;

  if (habitName) {
    const resolved = await resolveHabitByName(userId, habitName);
    const warning = optionalNameWarning(resolved, {
      label: "habit",
      input: habitName,
      nameOf: (h) => h.title,
      skipNote: "Timer will start without a habit link.",
    });
    if (warning) {
      warnings.push(warning);
    } else {
      habitId = resolved.match.match!.id;
    }
  }

  let category: string | null = null;
  if (categoryName) {
    const resolved = await resolveCategoryName(userId, categoryName);
    category = resolved.category;
    warnings.push(...resolved.warnings);
  }

  let personIds: string[] = [];
  let peopleNote = "";
  if (personNames) {
    const resolved = await resolvePeopleByNames(userId, personNames);
    personIds = resolved.personIds;
    warnings.push(...resolved.warnings);
    peopleNote =
      resolved.labels.length > 0 ? ` · with ${resolved.labels.join(", ")}` : "";
  }

  const running = await getRunningEntry(userId);

  // No timer running: this is just a start; the note has nowhere to go.
  if (!running) {
    if (note !== undefined) {
      warnings.push("No timer is currently running — the note will be ignored");
    }
    return {
      ok: true,
      previewText: `Start timer "${title}"${category ? ` [${category}]` : ""}${peopleNote}`,
      normalizedInput: {
        title,
        category,
        habitId,
        personIds,
        note: null,
        stoppedEntryId: null,
        stoppedLabel: null,
      },
      warnings,
    };
  }

  const elapsedMin = Math.round(
    (Date.now() - running.startedAt.getTime()) / 60000,
  );
  const lines = [
    `Stop "${running.label}" (running ${fmtMinutes(elapsedMin)}) and start "${title}"${category ? ` [${category}]` : ""}${peopleNote}`,
  ];
  if (note !== undefined && note.trim().length > 0) {
    lines.push(
      `Note saved on stopped entry: "${note.slice(0, 80)}${note.length > 80 ? "…" : ""}"`,
    );
  }

  return {
    ok: true,
    previewText: lines.join("\n"),
    normalizedInput: {
      title,
      category,
      habitId,
      personIds,
      note: note ?? null,
      stoppedEntryId: running.id,
      stoppedLabel: running.label,
    },
    warnings,
  };
}

async function previewEditTimeEntry(
  userId: string,
  raw: unknown,
): Promise<PreviewResult> {
  const parsed = EditTimeEntryInput.safeParse(raw);
  if (!parsed.success) {
    return zodErr(parsed.error);
  }
  const { entryId, title, startedAt, endedAt, categoryName, personNames } = parsed.data;
  const warnings: string[] = [];

  if (startedAt && Number.isNaN(new Date(startedAt).getTime())) {
    return err(
      `Invalid startedAt "${startedAt}" — must be an ISO datetime string (e.g. 2026-10-16T09:00:00)`,
    );
  }
  if (endedAt && Number.isNaN(new Date(endedAt).getTime())) {
    return err(
      `Invalid endedAt "${endedAt}" — must be an ISO datetime string (e.g. 2026-10-16T10:00:00)`,
    );
  }

  // Look up existing entry for before/after preview (any age, not just recent).
  const existing = await getTimeEntry(userId, entryId);
  if (!existing) {
    return err(
      idNotFound("Time entry", entryId, "copy the id from the Time view"),
    );
  }

  if (title === undefined && startedAt === undefined && endedAt === undefined && categoryName === undefined && personNames === undefined) {
    return err(
      "No changes specified — pass at least one of: title, startedAt, endedAt, categoryName, personNames",
    );
  }

  const afterStart = startedAt ? new Date(startedAt) : existing.startedAt;
  const afterEnd = endedAt ? new Date(endedAt) : existing.endedAt;

  if (afterEnd && afterEnd <= afterStart) {
    return err("End time must be after start time");
  }
  if (
    afterEnd &&
    afterEnd.getTime() - afterStart.getTime() > 24 * 60 * 60 * 1000
  ) {
    return err("Entries are capped at 24 hours");
  }

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

  let category: string | null = null;
  if (categoryName !== undefined) {
    const resolved = await resolveCategoryName(userId, categoryName);
    category = resolved.category;
    warnings.push(...resolved.warnings);
    lines.push(`Category: ${category ?? "(none)"}`);
  }

  // personNames uses replace semantics: the provided list becomes the full
  // linked set (pass [] to clear). Omitted => leave links untouched.
  let personIds: string[] | null = null;
  if (personNames !== undefined) {
    const resolved = await resolvePeopleByNames(userId, personNames);
    personIds = resolved.personIds;
    warnings.push(...resolved.warnings);
    lines.push(
      `People: ${resolved.labels.length > 0 ? resolved.labels.join(", ") : "(none — links cleared)"}`,
    );
  }

  return {
    ok: true,
    previewText: lines.join("\n"),
    normalizedInput: {
      entryId,
      title: title ?? null,
      startedAtIso: startedAt ?? null,
      endedAtIso: endedAt ?? null,
      category,
      categoryChanged: categoryName !== undefined,
      personIds,
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
    return zodErr(parsed.error);
  }
  const { habitName, value, note } = parsed.data;

  const resolved = await resolveHabitByName(userId, habitName);
  if (resolved.match.kind !== "exact") {
    return requiredNameError(resolved, {
      label: "habit",
      input: habitName,
      toCandidate: (h) => ({ id: h.id, name: h.title, bucket: h.bucket ?? "" }),
      nameOf: (h) => h.title,
      hint: "List habits via GET /api/assistant/habits.",
    });
  }

  const habit = resolved.match.match!;
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

async function previewCreateHabit(
  userId: string,
  raw: unknown,
): Promise<PreviewResult> {
  const parsed = CreateHabitInput.safeParse(raw);
  if (!parsed.success) {
    return zodErr(parsed.error);
  }
  const { title, cadence, dayPart, targetCount, goalUnit, notes, reminderTime } = parsed.data;

  const warnings: string[] = [];
  const habits = await listHabits(userId);
  if (habits.some((h) => h.title.toLowerCase() === title.trim().toLowerCase())) {
    warnings.push(`A habit named "${title.trim()}" already exists`);
  }

  const lines: string[] = [`Create habit "${title.trim()}"`];
  lines.push(`Cadence: ${cadence}${dayPart !== "anytime" ? ` · ${dayPart}` : ""}`);
  if (goalUnit !== "check" || targetCount !== undefined) {
    lines.push(`Goal: ${targetCount ?? 1} ${goalUnit}`);
  }
  if (reminderTime) lines.push(`Reminder: ${reminderTime}`);

  return {
    ok: true,
    previewText: lines.join("\n"),
    normalizedInput: {
      title: title.trim(),
      cadence,
      dayPart,
      targetCount: targetCount ?? null,
      goalUnit,
      notes: notes ?? null,
      reminderTime: reminderTime ?? null,
    },
    warnings,
  };
}

async function previewAddReflection(
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

async function previewUpdateProject(
  userId: string,
  raw: unknown,
): Promise<PreviewResult> {
  const parsed = UpdateProjectInput.safeParse(raw);
  if (!parsed.success) {
    return zodErr(parsed.error);
  }
  const { projectName, projectId, status, notes } = parsed.data;

  const ref = await resolveProjectRef(userId, { projectName, projectId });
  if (!ref.ok) return errAmbiguous(ref.error, ref.candidates);

  const project = ref.project;
  const changes: string[] = [];
  if (status) changes.push(`status → ${status}`);
  if (notes !== undefined) changes.push(`notes updated`);
  if (changes.length === 0) {
    return err(
      "No changes specified — pass at least one of: status, notes",
    );
  }

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

async function previewCreateProject(
  userId: string,
  raw: unknown,
): Promise<PreviewResult> {
  const parsed = CreateProjectInput.safeParse(raw);
  if (!parsed.success) {
    return zodErr(parsed.error);
  }
  const { name, intent, status, energyType, timeBudgetMinutes, targetDate } = parsed.data;

  const warnings: string[] = [];
  const projects = await listBoardProjects(userId);
  if (projects.some((p) => p.name.toLowerCase() === name.trim().toLowerCase())) {
    warnings.push(`A project named "${name.trim()}" already exists`);
  }

  const lines: string[] = [`Create project "${name.trim()}"`];
  if (intent) lines.push(`Intent: ${intent.slice(0, 80)}${intent.length > 80 ? "…" : ""}`);
  if (status) lines.push(`Status: ${status}`);
  if (timeBudgetMinutes) lines.push(`Time budget: ${fmtMinutes(timeBudgetMinutes)}/week`);
  if (targetDate) lines.push(`Target date: ${targetDate}`);

  return {
    ok: true,
    previewText: lines.join("\n"),
    normalizedInput: {
      name: name.trim(),
      intent: intent ?? null,
      status: status ?? null,
      energyType: energyType ?? null,
      timeBudgetMinutes: timeBudgetMinutes ?? null,
      targetDateIso: targetDate ? new Date(`${targetDate}T12:00:00`).toISOString() : null,
    },
    warnings,
  };
}

async function previewDeleteProject(
  userId: string,
  raw: unknown,
): Promise<PreviewResult> {
  const parsed = DeleteProjectInput.safeParse(raw);
  if (!parsed.success) {
    return zodErr(parsed.error);
  }
  const { projectName, projectId, deleteTasks } = parsed.data;

  const ref = await resolveProjectRef(userId, { projectName, projectId });
  if (!ref.ok) return errAmbiguous(ref.error, ref.candidates);
  const project = ref.project;

  // Blast radius: project tasks cascade-delete with the project; to-do items
  // are deleted only with deleteTasks (otherwise unlinked); time entries are
  // always kept but unlinked.
  const impact = await getProjectDeleteImpact(userId, project.id);
  const plural = (n: number, one: string, many: string) =>
    `${n} ${n === 1 ? one : many}`;

  const lines = [
    `Delete project "${project.name}"`,
    "Blast radius:",
    `- ${plural(impact.projectTaskCount, "project task", "project tasks")} will be permanently deleted`,
    deleteTasks
      ? `- ${plural(impact.doItemCount, "to-do item", "to-do items")} will also be deleted`
      : `- ${plural(impact.doItemCount, "to-do item", "to-do items")} will be kept but unlinked from the project`,
    `- ${plural(impact.timeEntryCount, "time entry", "time entries")} will be kept but unlinked from the project`,
  ];

  const warnings = [
    `This permanently deletes the project "${project.name}". This cannot be undone.`,
  ];
  if (impact.projectTaskCount > 0) {
    warnings.push(
      `The project's ${plural(impact.projectTaskCount, "task", "tasks")} will be deleted with it — they cannot be recovered.`,
    );
  }
  if (deleteTasks) {
    warnings.push("All to-do items linked to this project will also be deleted.");
  } else {
    warnings.push("To-do items linked to this project will be kept (unlinked).");
  }

  return {
    ok: true,
    previewText: lines.join("\n"),
    normalizedInput: {
      projectId: project.id,
      projectName: project.name,
      deleteTasks,
    },
    warnings,
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
  if (Array.isArray(n.personIds) && n.personIds.length > 0) {
    await setEntryPeople(
      userId,
      entry.id,
      n.personIds.filter((id): id is string => typeof id === "string"),
    );
  }
  if (typeof n.calendarEventId === "string" && n.calendarEventId) {
    await setEntryCalendarLink(userId, entry.id, n.calendarEventId);
  }
  return {
    ok: true,
    recordId: entry.id,
    recordType: "TimeEntry",
    summary: `Started timer "${entry.label}"`,
    suggestedCalendarLink: coerceCalendarSuggestion(n.suggestedCalendarLink),
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

// Stop the currently running timer (if any) and start a new one back-to-back.
// The new timer starts at the exact instant the old one stopped — no gap, no
// overlap. The `note` is saved onto the stopped entry.
async function executeSwapTimer(
  userId: string,
  n: Record<string, unknown>,
): Promise<ExecuteResult> {
  // Re-resolve at execute time: whatever is running *now* is what gets stopped.
  const now = new Date();
  const running = await getRunningEntry(userId);

  let stoppedLabel: string | null = null;
  if (running) {
    await stopRunning(userId, now);
    if (typeof n.note === "string" && n.note.trim().length > 0) {
      await updateEntry(userId, running.id, { notes: n.note });
    }
    stoppedLabel = running.label;
  }

  const entry = await startEntry(userId, {
    label: String(n.title),
    category: n.category ? String(n.category) : null,
    habitId: n.habitId ? String(n.habitId) : null,
    startedAt: now,
  });
  if (Array.isArray(n.personIds) && n.personIds.length > 0) {
    await setEntryPeople(
      userId,
      entry.id,
      n.personIds.filter((id): id is string => typeof id === "string"),
    );
  }

  const summary = stoppedLabel
    ? `Stopped "${stoppedLabel}" and started "${entry.label}"`
    : `Started "${entry.label}" (no timer was running)`;
  return {
    ok: true,
    recordId: entry.id,
    recordType: "TimeEntry",
    summary,
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
  if (n.categoryChanged) patch.category = typeof n.category === "string" ? n.category : null;

  const updated = await updateEntry(userId, String(n.entryId), patch);
  if (!updated) return err2(`Time entry "${n.entryId}" not found`);
  if (Array.isArray(n.personIds)) {
    await setEntryPeople(
      userId,
      updated.id,
      n.personIds.filter((id): id is string => typeof id === "string"),
    );
  }
  return {
    ok: true,
    recordId: updated.id,
    recordType: "TimeEntry",
    summary: `Updated time entry "${updated.label}"`,
  };
}

/**
 * Per-item validation/normalization for log_time_entry and log_time_entries.
 * Person/category/calendar resolution reuses the exact same warn-and-skip
 * helpers every other timer action uses — never fails, never guesses.
 * Hard validation errors are reported with the entry index and title so a
 * batch caller knows exactly which item is broken.
 */
interface ValidatedLogTimeEntry {
  title: string;
  startedAt: string; // ISO
  endedAt: string; // ISO
  category: string | null;
  notes: string | null;
  personIds: string[];
  calendarEventId: string | null;
  suggestedCalendarLink: CalendarLinkSuggestion | null;
  durationMinutes: number;
  /** e.g. `6:00 PM–7:30 PM · 1h 30m · with Ana · for "Standup"` */
  detailLine: string;
}

async function validateLogTimeEntryInput(
  userId: string,
  raw: unknown,
  index: number,
  warnPrefix: string,
): Promise<
  | { ok: true; entry: ValidatedLogTimeEntry; warnings: string[] }
  | { ok: false; error: string }
> {
  const parsed = LogTimeEntryInput.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: `entries[${index}]: ${formatZodError(parsed.error)}` };
  }
  const { title, startedAt, endedAt, categoryName, notes, personNames, calendarEventId, calendarTitle } = parsed.data;
  const label = `entries[${index}] "${title}"`;

  const start = new Date(startedAt);
  const end = new Date(endedAt);
  if (Number.isNaN(start.getTime())) {
    return { ok: false, error: `${label}: Invalid startedAt "${startedAt}" — must be an ISO datetime string (e.g. 2026-10-16T09:00:00)` };
  }
  if (Number.isNaN(end.getTime())) {
    return { ok: false, error: `${label}: Invalid endedAt "${endedAt}" — must be an ISO datetime string (e.g. 2026-10-16T10:00:00)` };
  }
  if (end <= start) return { ok: false, error: `${label}: End time must be after start time.` };

  const warnings: string[] = [];
  let category: string | null = null;
  if (categoryName) {
    const resolved = await resolveCategoryName(userId, categoryName);
    category = resolved.category;
    warnings.push(...resolved.warnings);
  }
  let personIds: string[] = [];
  let peopleNote = "";
  if (personNames) {
    const resolved = await resolvePeopleByNames(userId, personNames);
    personIds = resolved.personIds;
    warnings.push(...resolved.warnings.map((w) => `${warnPrefix}${w}`));
    peopleNote =
      resolved.labels.length > 0 ? ` · with ${resolved.labels.join(", ")}` : "";
  }

  const calendarLink = await resolveCalendarLinkInput(userId, {
    calendarEventId,
    calendarTitle,
  });
  warnings.push(...calendarLink.warnings.map((w) => `${warnPrefix}${w}`));

  // Suggest a block the logged window overlaps — suggested only, never linked
  // without the assistant's explicit confirmation. Best-effort: a calendar
  // read failure must never break logging the entry.
  let suggestedCalendarLink: CalendarLinkSuggestion | null = null;
  if (!calendarLink.eventId) {
    try {
      suggestedCalendarLink = await suggestCalendarLinkForRange(userId, start, end);
    } catch (error) {
      console.error("[assistant] calendar suggestion failed", error);
    }
  }

  const durationMinutes = Math.round((end.getTime() - start.getTime()) / 60000);
  const detailLine = `${fmtClock(start)}–${fmtClock(end)} · ${fmtMinutes(durationMinutes)}${peopleNote}${calendarLink.linkedNote}`;
  const lines = [
    `Log time entry "${title}"`,
    detailLine,
  ];
  if (category) lines.push(`Category: ${category}`);
  if (notes) lines.push(`Notes: ${notes}`);

  return {
    ok: true,
    entry: {
      title,
      startedAt: start.toISOString(),
      endedAt: end.toISOString(),
      category,
      notes: notes ?? null,
      personIds,
      calendarEventId: calendarLink.eventId,
      suggestedCalendarLink,
      durationMinutes,
      detailLine,
    },
    warnings,
  };
}

async function previewLogTimeEntry(
  userId: string,
  raw: unknown,
): Promise<PreviewResult> {
  const result = await validateLogTimeEntryInput(userId, raw, 0, "");
  if (!result.ok) return err(result.error);
  const { entry, warnings } = result;

  const lines = [`Log time entry "${entry.title}"`, entry.detailLine];
  if (entry.category) lines.push(`Category: ${entry.category}`);
  if (entry.notes) lines.push(`Notes: ${entry.notes}`);

  return {
    ok: true,
    previewText: lines.join("\n"),
    normalizedInput: {
      title: entry.title,
      startedAt: entry.startedAt,
      endedAt: entry.endedAt,
      category: entry.category,
      notes: entry.notes,
      personIds: entry.personIds,
      calendarEventId: entry.calendarEventId,
      suggestedCalendarLink: entry.suggestedCalendarLink,
    },
    warnings,
    suggestedCalendarLink: entry.suggestedCalendarLink,
  };
}

/** The DB write (plus people/calendar links) for one normalized log entry. */
async function writeValidatedLogTimeEntry(
  userId: string,
  entry: {
    title: string;
    category: string | null;
    notes: string | null;
    startedAt: string;
    endedAt: string;
    personIds: string[];
    calendarEventId: string | null;
  },
) {
  const created = await createPastEntry(userId, {
    label: entry.title,
    category: entry.category,
    notes: entry.notes,
    startedAt: new Date(entry.startedAt),
    endedAt: new Date(entry.endedAt),
  });
  if (entry.personIds.length > 0) {
    await setEntryPeople(
      userId,
      created.id,
      entry.personIds.filter((id): id is string => typeof id === "string"),
    );
  }
  if (entry.calendarEventId) {
    await setEntryCalendarLink(userId, created.id, entry.calendarEventId);
  }
  return created;
}

async function executeLogTimeEntry(
  userId: string,
  n: Record<string, unknown>,
): Promise<ExecuteResult> {
  // Input was validated and normalized by previewLogTimeEntry.
  const entry = await writeValidatedLogTimeEntry(userId, {
    title: String(n.title),
    category: typeof n.category === "string" ? n.category : null,
    notes: typeof n.notes === "string" ? n.notes : null,
    startedAt: String(n.startedAt),
    endedAt: String(n.endedAt),
    personIds: Array.isArray(n.personIds) ? n.personIds : [],
    calendarEventId:
      typeof n.calendarEventId === "string" && n.calendarEventId
        ? n.calendarEventId
        : null,
  });
  return {
    ok: true,
    recordId: entry.id,
    recordType: "TimeEntry",
    summary: `Logged time entry "${entry.label}"`,
    suggestedCalendarLink: coerceCalendarSuggestion(n.suggestedCalendarLink),
  };
}

/**
 * Validate EVERY entry before writing ANY (all-or-nothing): one bad entry
 * rejects the whole batch with per-entry errors, so a confirmed batch can
 * never half-apply from bad input.
 */
async function previewLogTimeEntries(
  userId: string,
  raw: unknown,
): Promise<PreviewResult> {
  const parsed = LogTimeEntriesInput.safeParse(raw);
  if (!parsed.success) {
    return err(parsed.error.issues[0]?.message ?? "Invalid input");
  }
  const { entries } = parsed.data;

  const normalized: ValidatedLogTimeEntry[] = [];
  const errors: string[] = [];
  const warnings: string[] = [];
  let totalMinutes = 0;
  for (let i = 0; i < entries.length; i++) {
    const result = await validateLogTimeEntryInput(userId, entries[i], i, `[${i}] `);
    if (result.ok) {
      normalized.push(result.entry);
      warnings.push(...result.warnings);
      totalMinutes += result.entry.durationMinutes;
    } else {
      errors.push(result.error);
    }
  }
  if (errors.length > 0) {
    return err(
      `No entries logged — ${errors.length} of ${entries.length} failed validation:\n${errors.join("\n")}`,
    );
  }

  const lines = [
    `Log ${entries.length} time ${entries.length === 1 ? "entry" : "entries"} (${fmtMinutes(totalMinutes)} total)`,
  ];
  for (let i = 0; i < normalized.length; i++) {
    const e = normalized[i]!;
    lines.push(
      `[${i}] "${e.title}" · ${e.detailLine}${e.category ? ` · ${e.category}` : ""}`,
    );
  }

  return {
    ok: true,
    previewText: lines.join("\n"),
    normalizedInput: {
      entries: normalized.map((e) => ({
        title: e.title,
        startedAt: e.startedAt,
        endedAt: e.endedAt,
        category: e.category,
        notes: e.notes,
        personIds: e.personIds,
        calendarEventId: e.calendarEventId,
        suggestedCalendarLink: e.suggestedCalendarLink,
      })),
    },
    warnings,
  };
}

/**
 * Write all entries in order. Validation already ran all-or-nothing in the
 * preview step, so write failures here are exceptional (DB errors); each is
 * reported with its index and title alongside the ones that succeeded —
 * never silently dropped.
 */
async function executeLogTimeEntries(
  userId: string,
  n: Record<string, unknown>,
): Promise<ExecuteResult> {
  // Input was validated and normalized by previewLogTimeEntries.
  const entries = (Array.isArray(n.entries) ? n.entries : []) as Array<{
    title: string;
    category: string | null;
    notes: string | null;
    startedAt: string;
    endedAt: string;
    personIds: string[];
    calendarEventId: string | null;
  }>;

  const results: LogTimeEntryBatchResult[] = [];
  let okCount = 0;
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i]!;
    try {
      const created = await writeValidatedLogTimeEntry(userId, e);
      results.push({ index: i, title: e.title, recordId: created.id });
      okCount++;
    } catch (error) {
      results.push({
        index: i,
        title: e.title,
        recordId: null,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const totalMinutes = entries.reduce(
    (sum, e) =>
      sum +
      Math.round(
        (new Date(e.endedAt).getTime() - new Date(e.startedAt).getTime()) / 60000,
      ),
    0,
  );

  if (okCount === entries.length) {
    return {
      ok: true,
      recordId: null,
      recordType: "TimeEntry",
      summary: `Logged ${entries.length} time ${entries.length === 1 ? "entry" : "entries"} (${fmtMinutes(totalMinutes)} total)`,
      entries: results,
    };
  }

  const failures = results
    .filter((r) => r.recordId === null)
    .map((r) => `[${r.index}] "${r.title}": ${r.error}`)
    .join("; ");
  return {
    ok: false,
    error: `Logged ${okCount} of ${entries.length} time entries — ${entries.length - okCount} failed: ${failures}`,
    recordId: null,
    recordType: "TimeEntry",
    summary: "",
    entries: results,
  };
}

async function previewDeleteTimeEntry(
  userId: string,
  raw: unknown,
): Promise<PreviewResult> {
  const parsed = DeleteTimeEntryInput.safeParse(raw);
  if (!parsed.success) {
    return err(parsed.error.issues[0]?.message ?? "Invalid input");
  }
  const { entryId } = parsed.data;

  // Same recent-window lookup as previewEditTimeEntry — only completed
  // entries are visible there, so a missing row means "not found" here too.
  const recent = await listRecentEntries(userId, { limit: 200 });
  const existing = recent.find((e) => e.id === entryId);
  if (!existing) {
    return err(`Time entry "${entryId}" not found`);
  }
  if (!existing.endedAt) {
    return err(
      `Time entry "${existing.label}" is a running timer — stop it with stop_timer before deleting`,
    );
  }

  const durationMin = Math.max(
    0,
    Math.round(
      (existing.endedAt.getTime() - existing.startedAt.getTime()) / 60000,
    ),
  );
  const lines = [
    `Delete time entry: ${existing.label}`,
    `${localDatePart(existing.startedAt)} ${fmtClock(existing.startedAt)}–${fmtClock(existing.endedAt)} · ${fmtMinutes(durationMin)}`,
    `Category: ${existing.category?.trim() || "uncategorized"}`,
  ];

  // Deleting the entry also destroys its people links — name them so the
  // confirmer knows exactly what will be destroyed.
  const personIds = await listEntryPeople(userId, entryId);
  if (personIds.length > 0) {
    let nameById = new Map<string, string>();
    try {
      const persons = await listPersons(userId);
      nameById = new Map(persons.map((p) => [p.id, p.displayName]));
    } catch {
      // Rolodex unavailable — fall back to raw person IDs below.
    }
    lines.push(
      `Linked people (links removed): ${personIds.map((id) => nameById.get(id) ?? id).join(", ")}`,
    );
  }

  return {
    ok: true,
    previewText: lines.join("\n"),
    normalizedInput: { entryId, beforeTitle: existing.label },
    warnings: [],
  };
}

async function executeDeleteTimeEntry(
  userId: string,
  n: Record<string, unknown>,
): Promise<ExecuteResult> {
  // Input was validated and normalized by previewDeleteTimeEntry, which
  // refuses missing entries and running timers.
  const entryId = String(n.entryId);
  // Clear people links first so no orphaned rows remain in TimeEntryPerson.
  await clearEntryPeople(userId, entryId);
  await deleteEntry(userId, entryId);
  return {
    ok: true,
    recordId: entryId,
    recordType: "TimeEntry",
    summary: `Deleted time entry "${n.beforeTitle}"`,
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

async function executeCreateHabit(
  userId: string,
  n: Record<string, unknown>,
): Promise<ExecuteResult> {
  const habit = await createHabit(userId, {
    title: String(n.title),
    cadence: n.cadence as "daily" | "weekdays" | "weekly" | "custom",
    dayPart: n.dayPart as "morning" | "day" | "evening" | "anytime",
    targetCount: typeof n.targetCount === "number" ? n.targetCount : undefined,
    goalUnit: n.goalUnit as "check" | "count" | "minutes",
    notes: n.notes ? String(n.notes) : null,
    reminderTime: n.reminderTime ? String(n.reminderTime) : null,
  });
  return {
    ok: true,
    recordId: habit.id,
    recordType: "Habit",
    summary: `Created habit "${habit.title}"`,
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

async function executeCreateProject(
  userId: string,
  n: Record<string, unknown>,
): Promise<ExecuteResult> {
  const id = await createBoardProject(userId, {
    name: String(n.name),
    intent: n.intent ? String(n.intent) : null,
    status: n.status ? String(n.status) : null,
    energyType: n.energyType ? String(n.energyType) : null,
    timeBudgetMinutes: typeof n.timeBudgetMinutes === "number" ? n.timeBudgetMinutes : null,
    targetDate: n.targetDateIso ? new Date(String(n.targetDateIso)) : null,
  });
  return {
    ok: true,
    recordId: id,
    recordType: "Project",
    summary: `Created project "${n.name}"`,
  };
}

async function executeDeleteProject(
  userId: string,
  n: Record<string, unknown>,
): Promise<ExecuteResult> {
  await deleteProject(userId, String(n.projectId), {
    deleteTasks: n.deleteTasks === true,
  });
  return {
    ok: true,
    recordId: String(n.projectId),
    recordType: "Project",
    summary: `Deleted project "${n.projectName}"`,
  };
}

async function executeUpdateCalendarEvent(
  userId: string,
  n: Record<string, unknown>,
): Promise<ExecuteResult> {
  const patch: {
    title?: string;
    startsAt?: Date;
    endsAt?: Date;
    notes?: string | null;
    location?: string | null;
  } = {};
  if (n.title) patch.title = String(n.title);
  if (n.timeChanged) {
    patch.startsAt = new Date(String(n.startsAtIso));
    patch.endsAt = new Date(String(n.endsAtIso));
  }
  if (n.notesChanged) patch.notes = n.notes ? String(n.notes) : null;
  if (n.locationChanged) patch.location = n.location ? String(n.location) : null;

  const updated = await updateCalendarItem(userId, String(n.eventId), patch);
  if (!updated) return err2(`Calendar event "${n.eventId}" not found`);
  return {
    ok: true,
    recordId: updated.id,
    recordType: "CalendarItem",
    summary: `Updated calendar event "${updated.title}"`,
  };
}

async function executeDeleteCalendarEvent(
  userId: string,
  n: Record<string, unknown>,
): Promise<ExecuteResult> {
  await deleteCalendarItem(userId, String(n.eventId));
  return {
    ok: true,
    recordId: String(n.eventId),
    recordType: "CalendarItem",
    summary: `Deleted calendar event "${n.beforeTitle}"`,
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
  if (partial.length === 1) {
    // One close match: never pick it silently — hand back a suggestion so
    // the caller can ask rather than guess.
    const only = partial[0]!;
    return {
      found: false,
      candidates: [{ id: only.id, name: only.displayName }],
      suggestion: only.displayName,
    };
  }

  const pool = exact.length > 1 ? exact : partial;
  return {
    found: false,
    candidates: pool.map((p) => ({ id: p.id, name: p.displayName })),
  };
}

/**
 * Shared "contact not found" message for Rolodex actions. Exact display-name
 * match wins; a single close match becomes a "did you mean" suggestion;
 * several matches list candidates; zero matches point at creation.
 */
function personResolutionError(
  name: string,
  candidates: AmbiguityCandidate[],
  suggestion: string | undefined,
): string {
  if (suggestion) {
    return `No exact contact match for "${name}" — did you mean "${suggestion}"? Retry with the exact display name.`;
  }
  if (candidates.length > 0) {
    return `Ambiguous contact match for "${name}" — ${candidates.length} contacts match. Retry with the exact display name.`;
  }
  return `No contact found matching "${name}". Check the spelling, or create them with create_rolodex_person.`;
}

// ── Project planning preview/execute handlers ─────────────────────────────

async function previewUpdateProjectPlan(
  userId: string,
  raw: unknown,
): Promise<PreviewResult> {
  const parsed = UpdateProjectPlanInput.safeParse(raw);
  if (!parsed.success) return zodErr(parsed.error);

  const ref = await resolveProjectRef(userId, {
    projectName: parsed.data.projectName,
    projectId: parsed.data.projectId,
  });
  if (!ref.ok) return errAmbiguous(ref.error, ref.candidates);
  const project = ref.project;
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
    previewText: `Update planning for "${project.name}": ${changes.join(", ")}`,
    normalizedInput: {
      projectId: project.id,
      projectName: project.name,
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
  if (!parsed.success) return zodErr(parsed.error);

  const ref = await resolveProjectRef(userId, {
    projectName: parsed.data.projectName,
    projectId: parsed.data.projectId,
  });
  if (!ref.ok) return errAmbiguous(ref.error, ref.candidates);
  const project = ref.project;

  const current = await getProjectPlan(userId, project.id);
  const before = current?.nextMilestone ?? null;
  return {
    ok: true,
    previewText: `Set next milestone for "${project.name}": "${parsed.data.milestone}"${before ? `\n(was: "${before}")` : ""}`,
    normalizedInput: { projectId: project.id, projectName: project.name, milestone: parsed.data.milestone },
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
  if (!parsed.success) return zodErr(parsed.error);

  const ref = await resolveProjectRef(userId, {
    projectName: parsed.data.projectName,
    projectId: parsed.data.projectId,
  });
  if (!ref.ok) return errAmbiguous(ref.error, ref.candidates);
  const project = ref.project;

  const warnings: string[] = [];
  const current = await getProjectPlan(userId, project.id);
  if (
    current?.openQuestions.some(
      (q) => q.toLowerCase() === parsed.data.question.trim().toLowerCase(),
    )
  ) {
    warnings.push(
      `This question is already on "${project.name}"'s open questions list — adding it again will create a duplicate`,
    );
  }

  return {
    ok: true,
    previewText: `Add question to "${project.name}": "${parsed.data.question}"`,
    normalizedInput: { projectId: project.id, projectName: project.name, question: parsed.data.question },
    warnings,
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
  if (!parsed.success) return zodErr(parsed.error);

  const ref = await resolveProjectRef(userId, {
    projectName: parsed.data.projectName,
    projectId: parsed.data.projectId,
  });
  if (!ref.ok) return errAmbiguous(ref.error, ref.candidates);
  const project = ref.project;

  const warnings: string[] = [];
  const current = await getProjectPlan(userId, project.id);
  if (
    current?.blockers.some(
      (b) => b.toLowerCase() === parsed.data.blocker.trim().toLowerCase(),
    )
  ) {
    warnings.push(
      `This blocker is already on "${project.name}"'s blockers list — adding it again will create a duplicate`,
    );
  }

  return {
    ok: true,
    previewText: `Add blocker to "${project.name}": "${parsed.data.blocker}"`,
    normalizedInput: { projectId: project.id, projectName: project.name, blocker: parsed.data.blocker },
    warnings,
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
  if (!parsed.success) return zodErr(parsed.error);

  const ref = await resolveProjectRef(userId, {
    projectName: parsed.data.projectName,
    projectId: parsed.data.projectId,
  });
  if (!ref.ok) return errAmbiguous(ref.error, ref.candidates);
  const project = ref.project;

  const current = await getProjectPlan(userId, project.id);
  const before = current?.nextAction ?? null;
  return {
    ok: true,
    previewText: `Set next action for "${project.name}": "${parsed.data.nextAction}"${before ? `\n(was: "${before}")` : ""}`,
    normalizedInput: { projectId: project.id, projectName: project.name, nextAction: parsed.data.nextAction },
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
  userId: string,
  raw: unknown,
): Promise<PreviewResult> {
  const parsed = CreateRolodexPersonInput.safeParse(raw);
  if (!parsed.success) return zodErr(parsed.error);

  if (
    parsed.data.birthday &&
    Number.isNaN(new Date(parsed.data.birthday).getTime())
  ) {
    return err(
      `"birthday": "${parsed.data.birthday}" is not a real calendar date — use YYYY-MM-DD (e.g. 1990-05-14)`,
    );
  }

  const warnings: string[] = [];
  const displayName = parsed.data.displayName.trim();
  const matches = await findPersonByName(userId, displayName);
  const duplicate = matches.find(
    (m) => m.displayName.toLowerCase() === displayName.toLowerCase(),
  );
  if (duplicate) {
    warnings.push(
      `A contact named "${duplicate.displayName}" already exists — creating another will duplicate it. Use update_rolodex_person to change the existing contact instead.`,
    );
  }

  const parts: string[] = [`Create contact: ${displayName}`];
  if (parsed.data.relationshipType) parts.push(parsed.data.relationshipType);
  if (parsed.data.organization) parts.push(`@ ${parsed.data.organization}`);

  return {
    ok: true,
    previewText: parts.join(" · "),
    normalizedInput: { ...parsed.data, displayName },
    warnings,
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
  if (!parsed.success) return zodErr(parsed.error);

  const resolved = await resolvePersonByName(userId, parsed.data.personName);
  if (!resolved.found) {
    return errAmbiguous(
      personResolutionError(parsed.data.personName, resolved.candidates, resolved.suggestion),
      resolved.candidates,
    );
  }
  const person = resolved.match;

  const changes: string[] = [];
  if (parsed.data.notes !== undefined) changes.push("notes");
  if (parsed.data.relationshipType !== undefined) changes.push(`relationship → ${parsed.data.relationshipType}`);
  if (parsed.data.organization !== undefined) changes.push(`org → ${parsed.data.organization}`);
  if (parsed.data.giftIdeas !== undefined) changes.push("gift ideas");
  if (parsed.data.communicationNotes !== undefined) changes.push("communication notes");
  if (changes.length === 0) return err("No changes specified");

  return {
    ok: true,
    previewText: `Update contact "${person.name}": ${changes.join(", ")}`,
    normalizedInput: { ...parsed.data, personId: person.id, personName: person.name },
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
  if (!parsed.success) return zodErr(parsed.error);

  const resolved = await resolvePersonByName(userId, parsed.data.personName);
  if (!resolved.found) {
    return errAmbiguous(
      personResolutionError(parsed.data.personName, resolved.candidates, resolved.suggestion),
      resolved.candidates,
    );
  }
  const person = resolved.match;

  const lines = [`Log interaction with "${person.name}": "${parsed.data.title}"`];
  if (parsed.data.followUpNeeded) lines.push(`Follow-up: ${parsed.data.followUpDate ?? "no date set"}`);

  return {
    ok: true,
    previewText: lines.join("\n"),
    normalizedInput: { ...parsed.data, personId: person.id, personName: person.name },
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
  if (!parsed.success) return zodErr(parsed.error);

  const resolved = await resolvePersonByName(userId, parsed.data.personName);
  if (!resolved.found) {
    return errAmbiguous(
      personResolutionError(parsed.data.personName, resolved.candidates, resolved.suggestion),
      resolved.candidates,
    );
  }
  const person = resolved.match;

  return {
    ok: true,
    previewText: `Add follow-up with "${person.name}": "${parsed.data.title}"${parsed.data.followUpDate ? ` by ${parsed.data.followUpDate}` : ""}`,
    normalizedInput: { ...parsed.data, personId: person.id, personName: person.name },
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
  if (!parsed.success) return zodErr(parsed.error);

  const resolved = await resolvePersonByName(userId, parsed.data.personName);
  if (!resolved.found) {
    return errAmbiguous(
      personResolutionError(parsed.data.personName, resolved.candidates, resolved.suggestion),
      resolved.candidates,
    );
  }
  const person = resolved.match;

  const warnings: string[] = [];
  const existing = await getPerson(userId, person.id);
  if (
    existing?.giftIdeas.some(
      (g) => g.toLowerCase() === parsed.data.idea.trim().toLowerCase(),
    )
  ) {
    warnings.push(
      `Gift idea "${parsed.data.idea.trim()}" is already saved for "${person.name}" — adding it again will create a duplicate`,
    );
  }

  return {
    ok: true,
    previewText: `Add gift idea for "${person.name}": "${parsed.data.idea}"`,
    normalizedInput: { ...parsed.data, personId: person.id, personName: person.name },
    warnings,
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

/**
 * Turn a Zod validation failure into an actionable error: every issue names
 * the offending field and what was wrong with it (including valid enum values
 * and expected formats), so the caller knows exactly what to fix.
 */
function formatZodError(error: z.ZodError): string {
  const parts = error.issues.map((issue) => {
    const path = issue.path.length > 0 ? issue.path.join(".") : "input";
    return `"${path}": ${issue.message}`;
  });
  return `Invalid input: ${parts.join("; ")}`;
}

function zodErr(error: z.ZodError): PreviewResult {
  return err(formatZodError(error));
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
  update_calendar_event: previewUpdateCalendarEvent,
  delete_calendar_event: previewDeleteCalendarEvent,
  start_timer: previewStartTimer,
  stop_timer: previewStopTimer,
  swap_timer: previewSwapTimer,
  edit_time_entry: previewEditTimeEntry,
  log_time_entry: previewLogTimeEntry,
  log_time_entries: previewLogTimeEntries,
  delete_time_entry: previewDeleteTimeEntry,
  log_habit: previewLogHabit,
  create_habit: previewCreateHabit,
  add_reflection: previewAddReflection,
  update_project: previewUpdateProject,
  create_project: previewCreateProject,
  delete_project: previewDeleteProject,
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
  update_calendar_event: executeUpdateCalendarEvent,
  delete_calendar_event: executeDeleteCalendarEvent,
  start_timer: executeStartTimer,
  stop_timer: executeStopTimer,
  swap_timer: executeSwapTimer,
  edit_time_entry: executeEditTimeEntry,
  log_time_entry: executeLogTimeEntry,
  log_time_entries: executeLogTimeEntries,
  delete_time_entry: executeDeleteTimeEntry,
  log_habit: executeLogHabit,
  create_habit: executeCreateHabit,
  add_reflection: executeAddReflection,
  update_project: executeUpdateProject,
  create_project: executeCreateProject,
  delete_project: executeDeleteProject,
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
