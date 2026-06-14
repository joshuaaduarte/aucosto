// Human-readable labels for the event log. Lives outside server-only so the
// activity widget and any future read-only consumer can import it without
// pulling in Prisma. Keep this in sync with the type strings used by the
// services that call recordEvent(); the rule of thumb: if you write a new
// "<tool>.<verb>" event type, add the label here too.

const EVENT_LABELS: Record<string, string> = {
  // time
  "time.started": "started a timer",
  "time.stopped": "stopped a timer",
  "time.deleted": "deleted a time entry",
  "time.logged": "backfilled a time entry",
  "time.updated": "edited a time entry",

  // reflect
  "reflect.saved": "saved a daily reflection",

  // finance — manual edits
  "finance.account_created": "added a finance account",
  "finance.account_updated": "updated a finance account",
  "finance.goal_created": "added a goal bucket",
  "finance.goal_updated": "updated a goal bucket",
  "finance.category_updated": "recategorized a transaction",
  "finance.category_bulk_updated": "recategorized matching transactions",

  // finance — imports and clears
  "finance.imported": "imported transactions",
  "finance.cleared": "cleared finance data",

  // finance — linked banks
  "finance.connection_linked": "linked a bank",
  "finance.connection_synced": "synced linked accounts",
  "finance.connection_disconnected": "disconnected a linked bank",
  "finance.webhook_transactions_processed": "new linked transactions",

  // calendar
  "calendar.created": "added a calendar block",
  "calendar.updated": "updated a calendar block",
  "calendar.deleted": "deleted a calendar block",
  "calendar.completed": "completed a calendar block",

  // do
  "do.created": "added a do item",
  "do.updated": "updated a do item",
  "do.completed": "completed a do item",
  "do.deleted": "deleted a do item",
  "do.bulk_deleted": "deleted a project's linked tasks",
  "do.timer_started": "started a timer from a do item",

  // habits
  "habit.created": "added a habit",
  "habit.updated": "updated a habit",
  "habit.logged": "logged habit progress",
  "habit.unlogged": "undid today's habit log",
  "habit.archived": "archived a habit",
  "habit.reopened": "reopened a habit",
  "habit.timer_started": "started a timer from a habit",

  // projects
  "project.created": "added a project",
  "project.updated": "updated a project",
  "project.deleted": "deleted a project",
  "project.area_created": "added a project area",
  "project.task_created": "added a project task",
  "project.task_completed": "completed a project task",
  "project.entry_tagged": "tagged a time entry to a project",
  "project.timer_started": "started a timer for a project",

  // rhythms
  "rhythm.started": "started a rhythm",
  "rhythm.ended": "completed a rhythm",

  // user
  "user.privacy_updated": "updated privacy settings",
};

export function describeEventType(type: string): string {
  return EVENT_LABELS[type] ?? type;
}
