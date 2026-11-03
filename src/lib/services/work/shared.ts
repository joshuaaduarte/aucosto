import "server-only";
import {
  resolveLinkedProjectStatus,
  resolveLinkedTaskStatus,
} from "@/lib/work";
import type {
  WorkAreaSummary,
  WorkMeetingSummary,
  WorkNoteSummary,
  WorkPersonSummary,
  WorkProjectSummary,
  WorkRecurrence,
  WorkReviewSummary,
  WorkTaskSummary,
} from "@/lib/work";

// ── Ensure tables (raw SQL, memoized — same pattern as rolodex.ts) ────────
// `prisma migrate dev` currently demands a destructive reset, so Work tables
// go in via idempotent DDL on first use. prisma/schema/work.prisma mirrors
// this exactly so `prisma generate` (Vercel build) picks up the types.

// ── Row types + mappers ───────────────────────────────────────────────────

function iso(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : String(value);
}

export type WorkspaceRow = {
  id: string;
  name: string;
  description: string | null;
};

export type AreaRow = {
  id: string;
  name: string;
  description: string | null;
  currentFocus: string | null;
  status: string;
  sortOrder: number;
};

export type ProjectRow = {
  id: string;
  areaId: string | null;
  name: string;
  outcome: string | null;
  status: string;
  dueDate: Date | null;
  nextAction: string | null;
  notes: string | null;
  updatedAt: Date;
  projectId: string | null;
  /** Status of the linked Aucosto Project (joined), null when unlinked. */
  linkedStatus: string | null;
};

export type PersonRow = {
  id: string;
  name: string;
  role: string | null;
  relationship: string | null;
  team: string | null;
  notes: string | null;
  oneOnOneNotes: string | null;
  rolodexPersonId: string | null;
};

export type MeetingRow = {
  id: string;
  title: string;
  scheduledAt: Date | null;
  durationMinutes: number | null;
  recurrence: string;
  personId: string | null;
  projectId: string | null;
  areaId: string | null;
  agenda: string | null;
  notes: string | null;
  status: string;
  calendarItemId: string | null;
};

export type TaskRow = {
  id: string;
  title: string;
  status: string;
  kind: string;
  dueDate: Date | null;
  isImportant: boolean;
  waitingOn: string | null;
  notes: string | null;
  areaId: string | null;
  projectId: string | null;
  personId: string | null;
  meetingId: string | null;
  completedAt: Date | null;
  createdAt: Date;
  doItemId: string | null;
  /** Status of the linked DoItem (joined), null when unlinked. */
  doStatus: string | null;
};

export type NoteRow = {
  id: string;
  kind: string;
  title: string | null;
  body: string;
  resolved: boolean;
  areaId: string | null;
  projectId: string | null;
  personId: string | null;
  meetingId: string | null;
  occurredAt: Date;
};

export type ReviewRow = {
  id: string;
  kind: string;
  periodKey: string;
  looseEnds: string | null;
  tomorrowFocus: string | null;
  wins: string | null;
  challenges: string | null;
  nextPriorities: string | null;
  energy: number | null;
  updatedAt: Date;
};

export function rowToArea(row: AreaRow): WorkAreaSummary {
  return { ...row };
}

export function rowToProject(row: ProjectRow): WorkProjectSummary {
  const { projectId, linkedStatus, ...rest } = row;
  return {
    ...rest,
    status: resolveLinkedProjectStatus(row.status, linkedStatus),
    dueDate: iso(row.dueDate),
    updatedAt: iso(row.updatedAt) ?? "",
    linkedProjectId: projectId,
  };
}

export function rowToPerson(row: PersonRow): WorkPersonSummary {
  return { ...row };
}

export function rowToMeeting(row: MeetingRow): WorkMeetingSummary {
  return {
    ...row,
    recurrence: row.recurrence as WorkRecurrence,
    scheduledAt: iso(row.scheduledAt),
  };
}

export function rowToTask(row: TaskRow): WorkTaskSummary {
  const { doStatus, ...rest } = row;
  return {
    ...rest,
    status: row.doItemId
      ? resolveLinkedTaskStatus(row.status, doStatus)
      : (row.status as WorkTaskSummary["status"]),
    kind: row.kind as WorkTaskSummary["kind"],
    dueDate: iso(row.dueDate),
    completedAt: iso(row.completedAt),
    createdAt: iso(row.createdAt) ?? "",
  };
}

export function rowToNote(row: NoteRow): WorkNoteSummary {
  return {
    ...row,
    kind: row.kind as WorkNoteSummary["kind"],
    occurredAt: iso(row.occurredAt) ?? "",
  };
}

export function rowToReview(row: ReviewRow): WorkReviewSummary {
  return {
    ...row,
    kind: row.kind as WorkReviewSummary["kind"],
    updatedAt: iso(row.updatedAt) ?? "",
  };
}
