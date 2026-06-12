// User-selectable project statuses (shown in the create/edit dropdowns and
// validated by the action-layer zod enum). "archived" is intentionally NOT
// here — archiving is a dedicated toggle, not a status you pick — but it is a
// valid stored value, so the ProjectStatus type and the label/style/normalize
// helpers below all account for it.
export const PROJECT_STATUSES = [
  "active",
  "planned",
  "waiting",
  "paused",
  "done",
] as const;

export type SelectableProjectStatus = (typeof PROJECT_STATUSES)[number];
export type ProjectStatus = SelectableProjectStatus | "archived";

export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  active: "Active",
  planned: "Not Started",
  waiting: "Waiting",
  paused: "On Hold",
  done: "Complete",
  archived: "Archived",
};

export type ProjectStatusStyle = {
  label: string;
  /** Text/accent color for the badge. */
  color: string;
  /** Tinted badge background. */
  bg: string;
};

export const PROJECT_STATUS_STYLES: Record<ProjectStatus, ProjectStatusStyle> = {
  active: { label: "Active", color: "#10b981", bg: "rgba(16, 185, 129, 0.12)" },
  planned: {
    label: "Not Started",
    color: "#9ca3af",
    bg: "rgba(156, 163, 175, 0.14)",
  },
  waiting: { label: "Waiting", color: "#f59e0b", bg: "rgba(245, 158, 11, 0.14)" },
  paused: { label: "On Hold", color: "#f97316", bg: "rgba(249, 115, 22, 0.14)" },
  done: { label: "Complete", color: "#3b82f6", bg: "rgba(59, 130, 246, 0.14)" },
  archived: {
    label: "Archived",
    color: "#9ca3af",
    bg: "rgba(156, 163, 175, 0.12)",
  },
};

export function projectStatusStyle(status: ProjectStatus): ProjectStatusStyle {
  return PROJECT_STATUS_STYLES[status] ?? PROJECT_STATUS_STYLES.active;
}

export function normalizeProjectStatus(
  status: string | null | undefined,
): ProjectStatus {
  switch (status) {
    case "active":
    case "planned":
    case "waiting":
    case "paused":
    case "done":
    case "archived":
      return status;
    default:
      return "active";
  }
}

/** Percent of linked tasks completed (0–100). Zero tasks → 0. */
export function projectProgress(doneCount: number, openCount: number): number {
  const total = doneCount + openCount;
  if (total === 0) return 0;
  return Math.round((doneCount / total) * 100);
}
