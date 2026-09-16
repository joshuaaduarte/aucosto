// Day plan service. A "plan" is 1–3 named, time-boxed blocks written the
// night before and confirmed in the morning.
//
// Planned blocks are stored as CalendarItems tagged with
// sourceTool = PLAN_SOURCE_TOOL rather than in a table of their own: they're
// already calendar-shaped, they render on the existing timeline for free, and
// it avoids a migration (see CLAUDE.md — `prisma migrate dev` currently wants
// a destructive reset). This service only ever composes the calendar and
// events services; it never touches prisma directly.

import "server-only";
import { PLAN_SOURCE_TOOL, startOfDay } from "@/lib/day-plan";
import {
  createCalendarItem,
  deleteCalendarItem,
  listCalendarItems,
  updateCalendarItem,
  type CalendarOccurrence,
} from "@/lib/services/calendar";
import { recordEvent } from "@/lib/services/events";
import { prisma } from "@/lib/prisma";
import { requireCan } from "@/lib/auth/can";

export type PlannedBlock = {
  id: string;
  title: string;
  startsAt: Date;
  endsAt: Date;
  /** True once the morning confirm has been done for this block. */
  confirmed: boolean;
};

function toPlannedBlock(item: CalendarOccurrence): PlannedBlock {
  return {
    id: item.id,
    title: item.title,
    startsAt: item.startsAt,
    endsAt: item.endsAt,
    confirmed: item.status === "confirmed",
  };
}

/** Planned blocks for the local day containing `day`. */
export async function listPlannedBlocks(
  userId: string,
  day: Date,
): Promise<PlannedBlock[]> {
  const from = startOfDay(day);
  const to = startOfDay(day, 1);
  const items = await listCalendarItems(userId, { from, to });
  return items
    .filter((item) => item.sourceTool === PLAN_SOURCE_TOOL)
    .map(toPlannedBlock);
}

export type PlanBlockInput = {
  title: string;
  startsAt: Date;
  endsAt: Date;
};

/**
 * Replace the plan for a day. Blocks are written as tentative — the morning
 * confirm promotes them — so "planned but not yet confirmed" is a real state
 * the morning nudge can ask about.
 */
export async function savePlan(
  userId: string,
  day: Date,
  blocks: PlanBlockInput[],
): Promise<PlannedBlock[]> {
  requireCan(userId, "calendar", "write");

  const existing = await listPlannedBlocks(userId, day);
  for (const block of existing) {
    await deleteCalendarItem(userId, block.id).catch(() => {});
  }

  const created: PlannedBlock[] = [];
  for (const block of blocks) {
    const title = block.title.trim();
    if (!title) continue;
    const item = await createCalendarItem(userId, {
      title,
      startsAt: block.startsAt,
      endsAt: block.endsAt,
      kind: "block",
      status: "tentative",
      sourceTool: PLAN_SOURCE_TOOL,
    });
    created.push(toPlannedBlock(item as CalendarOccurrence));
  }

  await recordEvent({
    userId,
    tool: "calendar",
    type: "plan.saved",
    meta: { day: startOfDay(day).toISOString(), blocks: created.length },
  });

  return created;
}

/** Morning confirm: promote every tentative block for the day. */
export async function confirmPlan(
  userId: string,
  day: Date,
): Promise<number> {
  requireCan(userId, "calendar", "write");
  const blocks = await listPlannedBlocks(userId, day);
  let confirmed = 0;
  for (const block of blocks) {
    if (block.confirmed) continue;
    await updateCalendarItem(userId, block.id, { status: "confirmed" });
    confirmed += 1;
  }
  if (confirmed > 0) {
    await recordEvent({
      userId,
      tool: "calendar",
      type: "plan.confirmed",
      meta: { day: startOfDay(day).toISOString(), blocks: confirmed },
    });
  }
  return confirmed;
}

/**
 * When the user last did anything *before* `before`. Powers the fresh-start
 * reframe on re-entry.
 *
 * Callers pass today's local midnight, deliberately: the question is "how
 * long was I gone before today", and any event written earlier in this
 * session — even an incidental one like enabling notifications — would
 * otherwise collapse the gap to zero and suppress the welcome-back on the
 * exact day it's meant to appear.
 *
 * Reads the event log directly because that *is* the activity index; there is
 * no tool-level owner for "last active".
 */
export async function getLastActivityBefore(
  userId: string,
  before: Date,
): Promise<Date | null> {
  requireCan(userId, "events", "read");
  try {
    const row = await prisma.event.findFirst({
      where: { userId, at: { lt: before } },
      orderBy: { at: "desc" },
      select: { at: true },
    });
    return row?.at ?? null;
  } catch (error) {
    // Cosmetic read — a failure must never take down the hub.
    console.error("[day-plan] getLastActivityBefore failed", error);
    return null;
  }
}
