export const DO_LANES = ["today", "next", "later", "someday"] as const;
export const DO_STATUSES = [
  "ready",
  "scheduled",
  "in_progress",
  "waiting",
  "done",
] as const;
export const DO_BUCKET_SUGGESTIONS = [
  "work",
  "business",
  "wedding",
  "personal",
  "health",
  "home",
  "admin",
] as const;

export type DoLane = (typeof DO_LANES)[number];
export type DoStatus = (typeof DO_STATUSES)[number];

export const DO_LANE_LABELS: Record<DoLane, string> = {
  today: "Today",
  next: "Next",
  later: "Later",
  someday: "Someday",
};

export const DO_LANE_DESCRIPTIONS: Record<DoLane, string> = {
  today: "Needs attention soon.",
  next: "Worth protecting next.",
  later: "Not urgent yet.",
  someday: "Hold without pressure.",
};

export const DO_STATUS_LABELS: Record<DoStatus, string> = {
  ready: "Ready",
  scheduled: "Scheduled",
  in_progress: "In progress",
  waiting: "Waiting",
  done: "Done",
};

export function normalizeDoStatus(status: string | null | undefined): DoStatus {
  switch (status) {
    case "open":
      return "ready";
    case "ready":
    case "scheduled":
    case "in_progress":
    case "waiting":
    case "done":
      return status;
    default:
      return "ready";
  }
}

export function parseMinutes(input: string | number | null | undefined): number | null {
  if (input === null || input === undefined || input === "") return null;
  const value = typeof input === "number" ? input : Number(input);
  if (!Number.isFinite(value) || value <= 0) return null;
  return Math.round(value);
}

export function formatMinutes(minutes: number | null | undefined): string {
  if (!minutes || minutes <= 0) return "No estimate";
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours === 0) return `${mins}m`;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
}
