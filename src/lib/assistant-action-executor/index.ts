// Assistant action executor — Dispatch tables + public API (previewAction / executeAction).
// (Split out of the former single-file assistant-action-executor.ts.)

import "server-only";
import { executeCreateCalendarBlock, executeDeleteCalendarEvent, executeUpdateCalendarEvent, previewCreateCalendarBlock, previewDeleteCalendarEvent, previewUpdateCalendarEvent } from "./calendar";
import { executeCreateHabit, executeLogHabit, previewCreateHabit, previewLogHabit } from "./habits";
import { executeAddProjectBlocker, executeAddProjectMilestone, executeAddProjectQuestion, executeCreateProject, executeDeleteProject, executeSetProjectNextAction, executeUpdateProject, executeUpdateProjectPlan, previewAddProjectBlocker, previewAddProjectMilestone, previewAddProjectQuestion, previewCreateProject, previewDeleteProject, previewSetProjectNextAction, previewUpdateProject, previewUpdateProjectPlan } from "./projects";
import { executeAddReflection, previewAddReflection } from "./reflect";
import { executeAddGiftIdea, executeAddPersonFollowup, executeAddRolodexInteraction, executeCreateRolodexPerson, executeUpdateRolodexPerson, previewAddGiftIdea, previewAddPersonFollowup, previewAddRolodexInteraction, previewCreateRolodexPerson, previewUpdateRolodexPerson } from "./rolodex";
import { err, err2 } from "./shared";
import { executeCompleteTask, executeCreateTask, executeUpdateTask, previewCompleteTask, previewCreateTask, previewUpdateTask } from "./tasks";
import { executeDeleteTimeEntry, executeEditTimeEntry, executeLogTimeEntries, executeLogTimeEntry, previewDeleteTimeEntry, previewEditTimeEntry, previewLogTimeEntries, previewLogTimeEntry } from "./time-entries";
import { executeStartTimer, executeStopTimer, executeSwapTimer, previewStartTimer, previewStopTimer, previewSwapTimer } from "./time-timers";
import { ExecuteResult, PreviewResult } from "./types";

// Public surface (unchanged from the single-file module).
export type { AmbiguityCandidate, PreviewResult, ExecuteResult, LogTimeEntryBatchResult } from "./types";
export { ACTION_INPUT_SCHEMAS } from "./schemas";
export { classifyNameMatch, type NameMatchKind, type NameMatch, type ResolvedNames } from "./shared";

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
