import type { TimeEntry } from "@/generated/prisma/client";

export type TimeCategorySummary = {
  category: string;
  totalMs: number;
};

export function entryDurationMs(entry: Pick<TimeEntry, "startedAt" | "endedAt">): number {
  if (!entry.endedAt) return 0;
  return Math.max(0, entry.endedAt.getTime() - entry.startedAt.getTime());
}

export function sumDurations(entries: Pick<TimeEntry, "startedAt" | "endedAt">[]): number {
  return entries.reduce((sum, entry) => sum + entryDurationMs(entry), 0);
}

export function summarizeCategories(
  entries: Pick<TimeEntry, "startedAt" | "endedAt" | "category">[],
  options: { limit?: number } = {},
): TimeCategorySummary[] {
  const totals = new Map<string, number>();

  for (const entry of entries) {
    const key = entry.category?.trim() || "Uncategorized";
    totals.set(key, (totals.get(key) ?? 0) + entryDurationMs(entry));
  }

  return Array.from(totals.entries())
    .map(([category, totalMs]) => ({ category, totalMs }))
    .sort((a, b) => b.totalMs - a.totalMs)
    .slice(0, options.limit ?? 3);
}
