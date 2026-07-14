// Work domain — pure helpers + shared types. No DB access; importable from
// client components, widgets, and the service layer alike (the service in
// src/lib/services/work/ owns persistence).

// ── Shared types (plain serializable shapes returned by the service) ──────

export type WorkTaskStatus = "open" | "waiting" | "done";
export type WorkTaskKind = "task" | "prep" | "followup";
export type WorkProjectStatus = "active" | "waiting" | "paused" | "done";
export type WorkRecurrence = "none" | "daily" | "weekly" | "biweekly" | "monthly";
export type WorkNoteKind = "note" | "decision";
export type WorkReviewKind = "shutdown" | "weekly";

export interface WorkWorkspaceSummary {
  id: string;
  name: string;
  description: string | null;
}

export interface WorkAreaSummary {
  id: string;
  name: string;
  description: string | null;
  currentFocus: string | null;
  status: string;
  sortOrder: number;
}

export interface WorkProjectSummary {
  id: string;
  areaId: string | null;
  name: string;
  outcome: string | null;
  status: WorkProjectStatus;
  dueDate: string | null;
  nextAction: string | null;
  notes: string | null;
  updatedAt: string;
}

export interface WorkPersonSummary {
  id: string;
  name: string;
  role: string | null;
  relationship: string | null;
  team: string | null;
  notes: string | null;
  oneOnOneNotes: string | null;
}

export interface WorkMeetingSummary {
  id: string;
  title: string;
  scheduledAt: string | null;
  durationMinutes: number | null;
  recurrence: WorkRecurrence;
  personId: string | null;
  projectId: string | null;
  areaId: string | null;
  agenda: string | null;
  notes: string | null;
  status: string;
}

export interface WorkTaskSummary {
  id: string;
  title: string;
  status: WorkTaskStatus;
  kind: WorkTaskKind;
  dueDate: string | null;
  isImportant: boolean;
  waitingOn: string | null;
  notes: string | null;
  areaId: string | null;
  projectId: string | null;
  personId: string | null;
  meetingId: string | null;
  completedAt: string | null;
  createdAt: string;
}

export interface WorkNoteSummary {
  id: string;
  kind: WorkNoteKind;
  title: string | null;
  body: string;
  resolved: boolean;
  areaId: string | null;
  projectId: string | null;
  personId: string | null;
  meetingId: string | null;
  occurredAt: string;
}

export interface WorkReviewSummary {
  id: string;
  kind: WorkReviewKind;
  periodKey: string;
  looseEnds: string | null;
  tomorrowFocus: string | null;
  wins: string | null;
  challenges: string | null;
  nextPriorities: string | null;
  energy: number | null;
  updatedAt: string;
}

// ── Labels ────────────────────────────────────────────────────────────────

export const WORK_PROJECT_STATUSES: Array<{ value: WorkProjectStatus; label: string }> = [
  { value: "active", label: "Active" },
  { value: "waiting", label: "Waiting" },
  { value: "paused", label: "Paused" },
  { value: "done", label: "Done" },
];

export const WORK_RELATIONSHIPS: Array<{ value: string; label: string }> = [
  { value: "manager", label: "Manager" },
  { value: "report", label: "Report" },
  { value: "peer", label: "Peer" },
  { value: "stakeholder", label: "Stakeholder" },
  { value: "other", label: "Other" },
];

export const WORK_RECURRENCES: Array<{ value: WorkRecurrence; label: string }> = [
  { value: "none", label: "One-off" },
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "biweekly", label: "Biweekly" },
  { value: "monthly", label: "Monthly" },
];

export function taskKindLabel(kind: WorkTaskKind): string {
  if (kind === "prep") return "Prep";
  if (kind === "followup") return "Follow-up";
  return "Task";
}

// ── Day / week keys (server TZ is pinned to the owner's timezone) ─────────

export function workDayKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Monday of the week containing `date`, as YYYY-MM-DD. */
export function workWeekKey(date: Date): string {
  const monday = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const dow = monday.getDay(); // 0 = Sunday
  monday.setDate(monday.getDate() - ((dow + 6) % 7));
  return workDayKey(monday);
}

// ── Meeting recurrence: does a meeting occur on a given local day? ────────

function startOfLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function meetingOccursOnDay(
  meeting: Pick<WorkMeetingSummary, "scheduledAt" | "recurrence">,
  day: Date,
): boolean {
  if (!meeting.scheduledAt) return false;
  const start = startOfLocalDay(new Date(meeting.scheduledAt));
  const target = startOfLocalDay(day);
  if (target < start) return false;
  const diffDays = Math.round((target.getTime() - start.getTime()) / 86_400_000);
  switch (meeting.recurrence) {
    case "none":
      return diffDays === 0;
    case "daily":
      return true;
    case "weekly":
      return diffDays % 7 === 0;
    case "biweekly":
      return diffDays % 14 === 0;
    case "monthly":
      return new Date(meeting.scheduledAt).getDate() === target.getDate();
    default:
      return diffDays === 0;
  }
}

export function meetingsOnDay<T extends Pick<WorkMeetingSummary, "scheduledAt" | "recurrence">>(
  meetings: T[],
  day: Date,
): T[] {
  return meetings
    .filter((m) => meetingOccursOnDay(m, day))
    .sort((a, b) => timeOfDayMinutes(a.scheduledAt) - timeOfDayMinutes(b.scheduledAt));
}

function timeOfDayMinutes(iso: string | null): number {
  if (!iso) return 0;
  const d = new Date(iso);
  return d.getHours() * 60 + d.getMinutes();
}

// ── Today grouping for tasks ──────────────────────────────────────────────

export interface WorkTodayTasks<T> {
  /** Open tasks that are overdue, due today, or flagged important. */
  mustDo: T[];
  /** Open prep tasks not already in mustDo. */
  prep: T[];
  /** Tasks in waiting status. */
  waiting: T[];
}

export function groupTasksForToday<
  T extends Pick<WorkTaskSummary, "status" | "kind" | "dueDate" | "isImportant" | "createdAt">,
>(tasks: T[], today: Date): WorkTodayTasks<T> {
  const endOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999);
  const mustDo: T[] = [];
  const prep: T[] = [];
  const waiting: T[] = [];
  for (const task of tasks) {
    if (task.status === "done") continue;
    if (task.status === "waiting") {
      waiting.push(task);
      continue;
    }
    const dueSoon = task.dueDate ? new Date(task.dueDate) <= endOfToday : false;
    if (dueSoon || task.isImportant) {
      mustDo.push(task);
    } else if (task.kind === "prep") {
      prep.push(task);
    }
  }
  const byDueThenCreated = (a: T, b: T) => {
    const ad = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
    const bd = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
    if (ad !== bd) return ad - bd;
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  };
  mustDo.sort(byDueThenCreated);
  prep.sort(byDueThenCreated);
  waiting.sort(byDueThenCreated);
  return { mustDo, prep, waiting };
}

// ── Display helpers ───────────────────────────────────────────────────────

export function dueLabel(iso: string | null, today: Date): string | null {
  if (!iso) return null;
  const due = startOfLocalDay(new Date(iso));
  const now = startOfLocalDay(today);
  const diffDays = Math.round((due.getTime() - now.getTime()) / 86_400_000);
  if (diffDays < -1) return `${-diffDays}d overdue`;
  if (diffDays === -1) return "Yesterday";
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Tomorrow";
  if (diffDays < 7) return `In ${diffDays}d`;
  return due.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function meetingTimeLabel(iso: string | null): string {
  if (!iso) return "Unscheduled";
  return new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}
