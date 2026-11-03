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
  "time.category_created": "added a time category",
  "time.category_updated": "updated a time category",

  // reflect
  "reflect.saved": "saved a daily reflection",

  // day plan
  "plan.saved": "planned the day",
  "plan.confirmed": "confirmed the day's plan",

  // finance — manual edits
  "finance.account_created": "added a finance account",
  "finance.account_updated": "updated a finance account",
  "finance.goal_created": "added a goal bucket",
  "finance.goal_updated": "updated a goal bucket",
  "finance.category_updated": "recategorized a transaction",
  "finance.category_bulk_updated": "recategorized matching transactions",

  // finance — imports and clears
  "finance.imported": "imported transactions",
  "finance.import_undone": "undid an import",
  "finance.cleared": "cleared finance data",

  // finance — linked banks
  "finance.connection_linked": "linked a bank",
  "finance.connection_synced": "synced linked accounts",
  "finance.connection_disconnected": "disconnected a linked bank",
  "finance.webhook_transactions_processed": "new linked transactions",

  // finance — household sharing + planning
  "finance.moved_in": "moved accounts into this space",
  "finance.moved_out": "moved accounts out of this space",
  "finance.budget_saved": "set a monthly budget",
  "finance.budget_deleted": "removed a budget",
  "finance.bill_created": "added a bill",
  "finance.bill_updated": "updated a bill",
  "finance.bill_paid": "marked a bill paid",
  "finance.bill_archived": "removed a bill",
  "finance.money_date_done": "finished the weekly money date",

  // finance — day-to-day tracking
  "finance.entry_added": "logged spending",
  "finance.entry_updated": "edited an entry",
  "finance.entry_deleted": "removed an entry",
  "finance.balance_updated": "updated an account balance",
  "finance.statement_checked": "checked a statement",
  "finance.plan_saved": "updated projection settings",
  "finance.shortcut_key_created": "made a new iPhone Shortcut key",
  "finance.money_moved": "moved money between accounts",
  "finance.card_statement_set": "entered a card statement",
  "finance.card_paid": "marked a card bill paid",
  "finance.caught_up": "caught up account balances",

  // account
  "user.password_changed": "changed their password",

  // household
  "household.created": "set up the household",
  "household.invited": "invited someone to the household",
  "household.joined": "joined the household",
  "household.member_removed": "removed someone from the household",

  // home
  "home.list_created": "made a list",
  "home.list_deleted": "deleted a list",
  "home.items_added": "added to a list",
  "home.task_created": "added a home task",
  "home.task_updated": "edited a home task",
  "home.task_done": "finished a home task",
  "home.task_archived": "removed a home task",

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
  "rhythm.updated": "corrected a wake time",

  // rolodex
  "rolodex.person_created": "Created contact",
  "rolodex.person_updated": "Updated contact",
  "rolodex.interaction_added": "Logged interaction",
  "rolodex.mention_resolved": "Resolved @mention",
  "rolodex.followup_added": "Added follow-up",
  "rolodex.gift_idea_added": "Added gift idea",

  // insights
  "insight.captured": "captured an insight",

  // push notifications
  "push.subscribed": "enabled notifications on a device",
  "push.unsubscribed": "disabled notifications on a device",

  // whoop
  "whoop.connected": "connected Whoop",
  "whoop.disconnected": "disconnected Whoop",

  // location signals
  "location.arrived": "arrived at a place",
  "location.left": "left a place",

  // work
  "work.area_created": "added a work area",
  "work.area_updated": "updated a work area",
  "work.project_created": "added a work project",
  "work.project_updated": "updated a work project",
  "work.person_created": "added a work contact",
  "work.person_updated": "updated a work contact",
  "work.person_linked": "connected a Rolodex contact to work",
  "work.person_removed": "removed a contact from a work workspace",
  "work.project_linked": "linked a project to a work workspace",
  "work.project_unlinked": "unlinked a project from a work workspace",
  "work.meeting_created": "added a work meeting",
  "work.meeting_updated": "updated a work meeting",
  "work.task_created": "added a work task",
  "work.task_updated": "updated a work task",
  "work.task_completed": "completed a work task",
  "work.task_reopened": "reopened a work task",
  "work.task_deleted": "deleted a work task",
  "work.note_created": "logged a work note",
  "work.note_deleted": "deleted a work note",
  "work.decision_logged": "logged a work decision",
  "work.decision_resolved": "resolved a work decision",
  "work.review_saved": "saved a work review",

  // user
  "user.privacy_updated": "updated privacy settings",
  "user.login_failed": "had a failed sign-in attempt",
};

export function describeEventType(type: string): string {
  return EVENT_LABELS[type] ?? type;
}
