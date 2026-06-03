export const PROJECT_STATUSES = [
  "active",
  "planned",
  "waiting",
  "paused",
  "done",
] as const;

export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  active: "Active",
  planned: "Planned",
  waiting: "Waiting",
  paused: "Paused",
  done: "Done",
};

export function normalizeProjectStatus(
  status: string | null | undefined,
): ProjectStatus {
  switch (status) {
    case "active":
    case "planned":
    case "waiting":
    case "paused":
    case "done":
      return status;
    default:
      return "active";
  }
}
