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

// ---------------------------------------------------------------------------
// Board model (the rebuilt Projects experience)
//
// These are intentionally separate from the legacy PROJECT_STATUS_* maps above:
// the rebuilt board uses a richer status vocabulary (exploring → final push)
// and the legacy hub/Do surfaces keep working off the old normalizer. Both read
// the same Project rows; an unknown status just falls back gracefully on each
// side. Pure module — safe to import from client and server.
// ---------------------------------------------------------------------------

export const BOARD_STATUSES = [
  "exploring",
  "active",
  "final_push",
  "paused",
  "done",
] as const;

export type BoardStatus = (typeof BOARD_STATUSES)[number];

export type BoardStatusMeta = {
  value: BoardStatus;
  label: string;
  color: string;
  bg: string;
};

const BOARD_STATUS_META: Record<BoardStatus, BoardStatusMeta> = {
  exploring: { value: "exploring", label: "Exploring", color: "#8b5cf6", bg: "rgba(139, 92, 246, 0.14)" },
  active: { value: "active", label: "Active", color: "#10b981", bg: "rgba(16, 185, 129, 0.14)" },
  final_push: { value: "final_push", label: "Final Push", color: "#f97316", bg: "rgba(249, 115, 22, 0.16)" },
  paused: { value: "paused", label: "Paused", color: "#9ca3af", bg: "rgba(156, 163, 175, 0.16)" },
  done: { value: "done", label: "Done", color: "#3b82f6", bg: "rgba(59, 130, 246, 0.14)" },
};

export function normalizeBoardStatus(status: string | null | undefined): BoardStatus {
  switch (status) {
    case "exploring":
    case "active":
    case "final_push":
    case "paused":
    case "done":
      return status;
    // Map a few legacy values onto the closest board status.
    case "planned":
      return "exploring";
    case "waiting":
      return "paused";
    case "archived":
      return "done";
    default:
      return "active";
  }
}

export function boardStatusMeta(status: string | null | undefined): BoardStatusMeta {
  return BOARD_STATUS_META[normalizeBoardStatus(status)];
}

export const ENERGY_TYPES = [
  { value: "deep", label: "Deep Work", emoji: "🧠", color: "#6366f1" },
  { value: "light", label: "Light Work", emoji: "🌤", color: "#10b981" },
  { value: "creative", label: "Creative", emoji: "🎨", color: "#ec4899" },
  { value: "admin", label: "Admin", emoji: "🗂", color: "#64748b" },
] as const;

export type EnergyType = (typeof ENERGY_TYPES)[number]["value"];

export function normalizeEnergyType(value: string | null | undefined): EnergyType {
  switch (value) {
    case "deep":
    case "light":
    case "creative":
    case "admin":
      return value;
    default:
      return "deep";
  }
}

export function energyTypeMeta(value: string | null | undefined) {
  const normalized = normalizeEnergyType(value);
  return ENERGY_TYPES.find((type) => type.value === normalized) ?? ENERGY_TYPES[0];
}

/** Stable, pleasant default palette for areas the user creates. */
export const AREA_COLOR_PALETTE = [
  "#6366f1",
  "#10b981",
  "#f97316",
  "#ec4899",
  "#0ea5e9",
  "#8b5cf6",
  "#f59e0b",
  "#14b8a6",
  "#ef4444",
  "#84cc16",
] as const;

// ---------------------------------------------------------------------------
// Momentum signal — the heart of the project card. Computed purely from the
// signals the rest of aucosto already tracks (logged time, target date, budget).
// ---------------------------------------------------------------------------

export type MomentumLevel = "alive" | "slowing" | "stalled";

export type Momentum = {
  level: MomentumLevel;
  emoji: string;
  label: string;
  hint: string;
} | null;

export type MomentumInput = {
  status: string;
  /** Minutes logged in the last 7 days. */
  weekMinutes: number;
  /** Minutes logged in the last 14 days. */
  twoWeekMinutes: number;
  /** Whole days until the target date (negative if past). null when no target. */
  daysUntilTarget: number | null;
  /** Budget consumed, 0–1+ (totalMinutes / timeBudgetMinutes). null when no budget. */
  budgetUsedFraction: number | null;
};

export function computeMomentum(input: MomentumInput): Momentum {
  const status = normalizeBoardStatus(input.status);
  // Finished or intentionally parked projects don't get a pulse.
  if (status === "done" || status === "paused") return null;

  const { weekMinutes, twoWeekMinutes, daysUntilTarget, budgetUsedFraction } = input;
  const targetSoon = (days: number) =>
    daysUntilTarget !== null && daysUntilTarget <= days;
  const budgetUnder = (fraction: number) =>
    budgetUsedFraction === null || budgetUsedFraction < fraction;

  // 🔴 Stalled — no work in two weeks, or a hard deadline looming with the
  // budget barely touched.
  if (twoWeekMinutes <= 0 || (targetSoon(7) && budgetUnder(0.75))) {
    return {
      level: "stalled",
      emoji: "🔴",
      label: "Stalled",
      hint:
        twoWeekMinutes <= 0
          ? "No time logged in 2 weeks"
          : "Deadline near, barely started",
    };
  }

  // 🟡 Slowing — went quiet this week (but moved recently), or the target is
  // approaching and the budget is under half.
  if ((weekMinutes <= 0 && twoWeekMinutes > 0) || (targetSoon(14) && budgetUnder(0.5))) {
    return {
      level: "slowing",
      emoji: "🟡",
      label: "Slowing",
      hint:
        weekMinutes <= 0
          ? "Nothing logged this week"
          : "Target date approaching",
    };
  }

  // 🟢 Alive — logged time recently with no deadline pressure.
  return {
    level: "alive",
    emoji: "🟢",
    label: "Alive",
    hint: "Moving steadily",
  };
}

/** Like formatMinutes but renders 0 as "0m" instead of "N/A". */
export function formatBudgetMinutes(minutes: number | null | undefined): string {
  const value = minutes ?? 0;
  if (value <= 0) return "0m";
  const hours = Math.floor(value / 60);
  const mins = value % 60;
  if (hours === 0) return `${mins}m`;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
}

/** "Today", "2 days ago", "3 weeks ago", or "Never". LA-pinned server clock. */
export function formatLastWorked(value: Date | null | undefined, now: Date): string {
  if (!value) return "Never";
  const startOfDay = (d: Date) => {
    const next = new Date(d);
    next.setHours(0, 0, 0, 0);
    return next;
  };
  const diffDays = Math.round(
    (startOfDay(now).getTime() - startOfDay(value).getTime()) / 86_400_000,
  );
  if (diffDays <= 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 14) return "Last week";
  const weeks = Math.round(diffDays / 7);
  if (weeks < 5) return `${weeks} weeks ago`;
  const months = Math.round(diffDays / 30);
  if (months < 2) return "A month ago";
  if (months < 12) return `${months} months ago`;
  return ">1 year ago";
}
