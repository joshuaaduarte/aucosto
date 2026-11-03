// Pure helpers for the Home tool (lists, chores, maintenance). No DB.

const DAY_MS = 24 * 60 * 60 * 1000;

export const HOME_TASK_KINDS = ["chore", "maintenance"] as const;
export type HomeTaskKind = (typeof HOME_TASK_KINDS)[number];

export function isHomeTaskKind(value: string): value is HomeTaskKind {
  return (HOME_TASK_KINDS as readonly string[]).includes(value);
}

/** One-tap presets: common chores and the maintenance people forget. */
export const HOME_TASK_PRESETS: Array<{ kind: HomeTaskKind; title: string; cadenceDays: number }> = [
  { kind: "chore", title: "Take out trash and recycling", cadenceDays: 7 },
  { kind: "chore", title: "Change bed sheets", cadenceDays: 14 },
  { kind: "chore", title: "Clean bathrooms", cadenceDays: 7 },
  { kind: "chore", title: "Vacuum and mop", cadenceDays: 7 },
  { kind: "chore", title: "Clean out the fridge", cadenceDays: 14 },
  { kind: "maintenance", title: "Replace HVAC filter", cadenceDays: 90 },
  { kind: "maintenance", title: "Test smoke and CO detectors", cadenceDays: 180 },
  { kind: "maintenance", title: "Clean dryer vent", cadenceDays: 365 },
  { kind: "maintenance", title: "Clean dishwasher and disposal", cadenceDays: 30 },
  { kind: "maintenance", title: "Flush water heater", cadenceDays: 365 },
];

export const HOME_LIST_PRESETS = ["Groceries", "Costco", "Target", "Home projects"];

export function cadenceLabel(days: number): string {
  if (days === 1) return "Daily";
  if (days === 7) return "Weekly";
  if (days === 14) return "Every 2 weeks";
  if (days % 365 === 0) return days === 365 ? "Yearly" : `Every ${days / 365} years`;
  if (days % 30 === 0) return days === 30 ? "Monthly" : `Every ${days / 30} months`;
  if (days % 7 === 0) return `Every ${days / 7} weeks`;
  return `Every ${days} days`;
}

/** Calendar days from today to due (negative = overdue). */
export function homeDaysUntil(due: Date, now: Date): number {
  const a = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const b = new Date(due.getFullYear(), due.getMonth(), due.getDate()).getTime();
  return Math.round((b - a) / DAY_MS);
}

export function homeDueLabel(daysUntilDue: number): string {
  if (daysUntilDue < -1) return `${Math.abs(daysUntilDue)} days late`;
  if (daysUntilDue === -1) return "1 day late";
  if (daysUntilDue === 0) return "Today";
  if (daysUntilDue === 1) return "Tomorrow";
  if (daysUntilDue < 14) return `In ${daysUntilDue} days`;
  if (daysUntilDue < 60) return `In ${Math.round(daysUntilDue / 7)} weeks`;
  return `In ${Math.round(daysUntilDue / 30)} months`;
}

/** Due date after marking done at `doneAt`: next cycle starts from completion. */
export function nextDueAfterDone(doneAt: Date, cadenceDays: number): Date {
  const next = new Date(doneAt.getFullYear(), doneAt.getMonth(), doneAt.getDate(), 9, 0, 0, 0);
  next.setDate(next.getDate() + Math.max(1, cadenceDays));
  return next;
}

/**
 * Who is on a rotating chore next: the other member from whoever just did
 * it (or the current assignee). Fixed chores keep their assignee.
 */
export function nextAssignee(input: {
  rotate: boolean;
  assigneeUserId: string | null;
  doneByUserId: string;
  memberUserIds: string[];
}): string | null {
  if (!input.rotate || input.memberUserIds.length < 2) return input.assigneeUserId;
  const from = input.assigneeUserId ?? input.doneByUserId;
  const index = input.memberUserIds.indexOf(from);
  if (index === -1) return input.memberUserIds[0] ?? null;
  return input.memberUserIds[(index + 1) % input.memberUserIds.length] ?? null;
}

export type HomeTaskLike = {
  id: string;
  kind: string;
  nextDueAt: Date;
};

export function groupHomeTasks<T extends HomeTaskLike>(
  tasks: T[],
  now: Date,
): { dueNow: T[]; upcoming: T[] } {
  const dueNow: T[] = [];
  const upcoming: T[] = [];
  for (const task of [...tasks].sort((a, b) => a.nextDueAt.getTime() - b.nextDueAt.getTime())) {
    if (homeDaysUntil(task.nextDueAt, now) <= 0) dueNow.push(task);
    else upcoming.push(task);
  }
  return { dueNow, upcoming };
}

/** Split "milk, eggs\nbread" into list items; trims, drops blanks and dupes. */
export function parseListItemsInput(raw: string): string[] {
  const seen = new Set<string>();
  const items: string[] = [];
  for (const part of raw.split(/[\n,]/)) {
    const title = part.trim().replace(/\s+/g, " ").slice(0, 120);
    if (!title) continue;
    const key = title.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    items.push(title);
  }
  return items;
}

/**
 * Morning household nudge text, or null when nothing needs attention.
 * `bills` are already filtered to the next few days and exclude autopay.
 */
export function householdNudgeText(input: {
  dueTaskTitles: string[];
  bills: Array<{ name: string; daysUntil: number }>;
}): { title: string; body: string } | null {
  const parts: string[] = [];
  if (input.dueTaskTitles.length === 1) parts.push(`${input.dueTaskTitles[0]} is due`);
  else if (input.dueTaskTitles.length > 1) parts.push(`${input.dueTaskTitles.length} home tasks are due`);
  for (const bill of input.bills.slice(0, 2)) {
    parts.push(
      `${bill.name} ${bill.daysUntil < 0 ? "is overdue" : bill.daysUntil === 0 ? "is due today" : bill.daysUntil === 1 ? "is due tomorrow" : `is due in ${bill.daysUntil} days`}`,
    );
  }
  if (input.bills.length > 2) parts.push(`${input.bills.length - 2} more bills coming up`);
  if (parts.length === 0) return null;
  const body = parts.join(". ") + ".";
  return { title: "Home today", body };
}

/**
 * How "fresh" a repeating task is, 1 right after it's done down to 0 when
 * it's due (Tody-style). Drives the ring next to each chore.
 */
export function homeFreshness(daysUntilDue: number, cadenceDays: number): number {
  if (cadenceDays <= 0) return daysUntilDue > 0 ? 1 : 0;
  return Math.max(0, Math.min(1, daysUntilDue / cadenceDays));
}

/** "Ana Duarte" → "A"; used for the small who-added / whose-turn badges. */
export function personInitial(name: string | null | undefined): string {
  const trimmed = (name ?? "").trim();
  return trimmed ? trimmed[0]!.toUpperCase() : "?";
}
