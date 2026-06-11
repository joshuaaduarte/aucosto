// Public surface for the habits service. Callers should keep importing from
// `@/lib/services/habits` — the split into sibling files is an internal
// reorganization. Internal helpers (shared.ts, plus the non-re-exported parts
// of derive.ts) are deliberately not re-exported.

export { listHabits, listHabitTaskItems, listSuggestedHabits } from "./reads";
export {
  archiveHabit,
  createHabit,
  deleteHabit,
  logHabitProgress,
  startTimerForHabit,
  updateHabit,
  type SaveHabitInput,
} from "./mutations";
export type { HabitSummary, HabitTaskSummary } from "./derive";
