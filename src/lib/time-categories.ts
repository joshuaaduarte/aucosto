// Preset life categories for the time tracker.
//
// Pure module (no DB) — importable from client and server. The taxonomy is
// deliberately code-defined: single user, easy to edit, no migration. Custom
// free-text categories still work; they get a stable fallback color.

export type TimeCategory = {
  id: string;
  label: string;
  color: string;
};

export const PRESET_TIME_CATEGORIES: TimeCategory[] = [
  { id: "work", label: "Work", color: "#10b981" },
  { id: "reading", label: "Reading", color: "#3b82f6" },
  { id: "eating", label: "Eating", color: "#f59e0b" },
  { id: "cooking", label: "Cooking", color: "#f97316" },
  { id: "dishes", label: "Dishes", color: "#84cc16" },
  { id: "chores", label: "Chores", color: "#a8a29e" },
  { id: "bathroom", label: "Bathroom", color: "#0ea5e9" },
  { id: "shower", label: "Shower", color: "#06b6d4" },
  { id: "commute", label: "Commute", color: "#8b5cf6" },
  { id: "errands", label: "Errands", color: "#d946ef" },
  { id: "exercise", label: "Exercise", color: "#ef4444" },
  { id: "social", label: "Social", color: "#ec4899" },
  { id: "entertainment", label: "Entertainment", color: "#eab308" },
  { id: "rest", label: "Rest", color: "#14b8a6" },
  { id: "planning", label: "Planning", color: "#64748b" },
  { id: "sleep", label: "Sleep", color: "#6366f1" },
];

// Categories assigned automatically when a timer starts from another tool.
const LINKED_CATEGORY_META: Record<string, { label: string; color: string }> = {
  do: { label: "Do", color: "#10b981" },
  habit: { label: "Habit", color: "#14b8a6" },
  calendar: { label: "Calendar", color: "#f43f5e" },
};

export const UNCATEGORIZED_COLOR = "#9ca3af";

const FALLBACK_PALETTE = [
  "#0891b2",
  "#7c3aed",
  "#db2777",
  "#ca8a04",
  "#4f46e5",
  "#0d9488",
  "#ea580c",
  "#65a30d",
];

export function normalizeCategory(raw: string | null | undefined): string {
  return (raw ?? "").trim().toLowerCase();
}

function findPreset(normalized: string): TimeCategory | null {
  return (
    PRESET_TIME_CATEGORIES.find(
      (preset) =>
        preset.id === normalized || preset.label.toLowerCase() === normalized,
    ) ?? null
  );
}

/** Stable color for any category string (preset, linked, or custom). */
export function categoryColor(category: string | null | undefined): string {
  const normalized = normalizeCategory(category);
  if (!normalized) return UNCATEGORIZED_COLOR;
  const preset = findPreset(normalized);
  if (preset) return preset.color;
  const linked = LINKED_CATEGORY_META[normalized];
  if (linked) return linked.color;
  let hash = 0;
  for (let index = 0; index < normalized.length; index += 1) {
    hash = (hash * 31 + normalized.charCodeAt(index)) >>> 0;
  }
  return FALLBACK_PALETTE[hash % FALLBACK_PALETTE.length] ?? UNCATEGORIZED_COLOR;
}

/** Display label for a category string — preset casing when known. */
export function categoryLabel(category: string | null | undefined): string {
  const normalized = normalizeCategory(category);
  if (!normalized) return "Uncategorized";
  const preset = findPreset(normalized);
  if (preset) return preset.label;
  const linked = LINKED_CATEGORY_META[normalized];
  if (linked) return linked.label;
  return category!.trim();
}
