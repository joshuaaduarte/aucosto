// Assistant action executor — Zod input schemas for every action.
// (Split out of the former single-file assistant-action-executor.ts.)

import "server-only";
import { z } from "zod";

export const CreateTaskInput = z.object({
  title: z
    .string({ error: "title is required (1–200 characters)" })
    .min(1, "title cannot be empty")
    .max(200, "title must be 200 characters or fewer"),
  projectName: z.string().optional(),
  bucket: z.enum(["today", "next", "later", "someday", "backlog"]).default("someday"),
  notes: z.string().optional(),
});

export const CompleteTaskInput = z.object({
  taskId: z
    .string({ error: "taskId is required" })
    .min(1, "taskId cannot be empty"),
});

export const UpdateTaskInput = z.object({
  taskId: z
    .string({ error: "taskId is required" })
    .min(1, "taskId cannot be empty"),
  title: z.string().min(1, "title cannot be empty").max(200, "title must be 200 characters or fewer").optional(),
  bucket: z.enum(["today", "next", "later", "someday"]).optional(),
  projectName: z.string().optional(),
});

export const CreateCalendarBlockInput = z.object({
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

export const StartTimerInput = z.object({
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

export const StopTimerInput = z.object({
  entryId: z.string().optional(),
  endedAtLocal: z.string().optional(), // "YYYY-MM-DDTHH:MM:SS" local time; omit for now
  note: z.string().optional(),
});

export const SwapTimerInput = z.object({
  title: z
    .string({ error: "title is required (1–200 characters)" })
    .min(1, "title cannot be empty")
    .max(200, "title must be 200 characters or fewer"),
  note: z.string().optional(), // saved onto the STOPPED entry
  categoryName: z.string().optional(),
  habitName: z.string().optional(),
  personNames: z.array(z.string()).optional(), // linked to the NEW timer
});

export const EditTimeEntryInput = z.object({
  entryId: z
    .string({ error: "entryId is required — copy the id from the Time view" })
    .min(1, "entryId cannot be empty"),
  title: z.string().min(1, "title cannot be empty").max(200, "title must be 200 characters or fewer").optional(),
  startedAt: z.string().optional(), // ISO
  endedAt: z.string().optional(),   // ISO
  categoryName: z.string().optional(),
  personNames: z.array(z.string()).optional(),
});

export const LogTimeEntryInput = z.object({
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
export const LogTimeEntriesInput = z.object({
  entries: z
    .array(LogTimeEntryInput)
    .min(1, "entries must contain at least 1 time entry — nothing to log")
    .max(
      50,
      "entries is limited to 50 per call — split larger backfills into multiple calls",
    ),
});

export const LogHabitInput = z.object({
  habitName: z
    .string({ error: "habitName is required" })
    .min(1, "habitName cannot be empty"),
  value: z.number().positive("value must be a positive number").optional(),
  note: z.string().optional(),
});

export const CreateHabitInput = z.object({
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

export const AddReflectionInput = z.object({
  mood: z.number().min(1).max(5).optional(),
  note: z.string().optional(),
});

export const UpdateProjectInput = z
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

export const CreateProjectInput = z.object({
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

export const DeleteProjectInput = z
  .object({
    projectName: z.string().min(1).optional(),
    projectId: z.string().min(1).optional(),
    deleteTasks: z.boolean().default(false),
  })
  .refine((v) => v.projectName || v.projectId, {
    message: "Provide projectName or projectId",
  });

export const UpdateCalendarEventInput = z.object({
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

export const DeleteCalendarEventInput = z.object({
  eventId: z.string().min(1),
});

export const DeleteTimeEntryInput = z.object({
  entryId: z.string().min(1),
});

/**
 * Every project-planning action identifies its project by projectName or
 * projectId (explicit id wins when both are given).
 */
export const projectRefFields = {
  projectName: z.string().min(1).optional(),
  projectId: z.string().min(1).optional(),
};

export const projectRefRefine = {
  message: "Provide projectName or projectId to identify the project",
} as const;

export const UpdateProjectPlanInput = z
  .object({
    ...projectRefFields,
    goal: z.string().max(1000).optional(),
    whyItMatters: z.string().max(1000).optional(),
    nextMilestone: z.string().max(500).optional(),
    nextAction: z.string().max(500).optional(),
    planNotes: z.string().max(5000).optional(),
  })
  .refine((v) => v.projectName || v.projectId, projectRefRefine);

export const AddProjectMilestoneInput = z
  .object({ ...projectRefFields, milestone: z.string().min(1).max(500) })
  .refine((v) => v.projectName || v.projectId, projectRefRefine);

export const AddProjectQuestionInput = z
  .object({ ...projectRefFields, question: z.string().min(1).max(500) })
  .refine((v) => v.projectName || v.projectId, projectRefRefine);

export const AddProjectBlockerInput = z
  .object({ ...projectRefFields, blocker: z.string().min(1).max(500) })
  .refine((v) => v.projectName || v.projectId, projectRefRefine);

export const SetProjectNextActionInput = z
  .object({ ...projectRefFields, nextAction: z.string().min(1).max(500) })
  .refine((v) => v.projectName || v.projectId, projectRefRefine);

export const CreateRolodexPersonInput = z.object({
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

export const UpdateRolodexPersonInput = z.object({
  personName: z.string().min(1),
  notes: z.string().max(5000).optional(),
  relationshipType: z.string().optional(),
  organization: z.string().max(200).optional(),
  giftIdeas: z.array(z.string()).optional(),
  communicationNotes: z.string().max(2000).optional(),
});

export const AddRolodexInteractionInput = z.object({
  personName: z.string().min(1),
  title: z.string().min(1).max(300),
  body: z.string().max(5000).optional(),
  followUpNeeded: z.boolean().optional(),
  followUpDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "followUpDate must be YYYY-MM-DD (e.g. 2026-10-20)")
    .optional(),
});

export const AddPersonFollowupInput = z.object({
  personName: z.string().min(1),
  title: z.string().min(1).max(300),
  followUpDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "followUpDate must be YYYY-MM-DD (e.g. 2026-10-20)")
    .optional(),
});

export const AddGiftIdeaInput = z.object({
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
