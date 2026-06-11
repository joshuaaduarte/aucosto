// Internal helpers and types shared between do service modules. Only
// `DoItemSummary` is re-exported from the barrel — keep the rest out of
// public callsites.

import "server-only";
import { type DoStatus, normalizeDoStatus } from "@/lib/do";
import type { DoItem, TimeEntry } from "@/generated/prisma/client";

export type DoItemWithEntries = DoItem & {
  timeEntries: TimeEntry[];
  project: { id: string; name: string } | null;
  habit: { id: string; title: string } | null;
};

export type DoItemSummary = DoItem & {
  status: DoStatus;
  trackedMinutes: number;
  effectiveActualMinutes: number | null;
  scheduledMinutes: number;
  scheduledCount: number;
  projectName: string | null;
  habitTitle: string | null;
};

export function summarize(
  item: DoItemWithEntries,
  scheduledMinutes: number,
  scheduledCount: number,
): DoItemSummary {
  const trackedMinutes = item.timeEntries.reduce((total, entry) => {
    if (!entry.endedAt) return total;
    return total + Math.max(0, Math.round((entry.endedAt.getTime() - entry.startedAt.getTime()) / 60000));
  }, 0);
  const status = normalizeDoStatus(item.status);

  return {
    ...item,
    status,
    trackedMinutes,
    scheduledMinutes,
    scheduledCount,
    projectName: item.project?.name ?? null,
    habitTitle: item.habit?.title ?? null,
    effectiveActualMinutes:
      item.actualMinutes ?? (trackedMinutes > 0 ? trackedMinutes : null),
  };
}
