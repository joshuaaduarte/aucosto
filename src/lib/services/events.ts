// Canonical activity-log writer. Tool services call recordEvent() after a
// successful mutation; readers (future "what happened today" widget, agent
// summaries, debugging) read from prisma.event.* through their own service
// once a real consumer exists.
//
// We deliberately do NOT wrap (mutation + recordEvent) in a transaction at
// V1 — losing one event row on a crash is acceptable for personal use, and
// dragging Prisma's interactive transactions through every write costs
// complexity we don't yet need. Revisit if/when an agent depends on the log
// for state reconstruction.

import "server-only";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { requireCan } from "@/lib/auth/can";
import type { Event, Prisma } from "@/generated/prisma/client";
import type { Tool } from "@/lib/auth/can";
import { currentActorUserId, currentActorVia } from "@/lib/actor";

export type EventInput = {
  userId: string;
  tool: Tool;
  type: string; // "{tool}.{verb}", e.g. "time.started"
  refId?: string | null;
  meta?: Prisma.InputJsonValue | null;
};

export async function listRecentEvents(
  userId: string,
  options: { limit?: number } = {},
): Promise<Event[]> {
  requireCan(userId, "events", "read");
  return prisma.event.findMany({
    where: { userId },
    orderBy: { at: "desc" },
    take: options.limit ?? 5,
  });
}

/** How many events of one type this user logged since `since` (rate limits). */
export async function countEventsSince(
  userId: string,
  type: string,
  since: Date,
): Promise<number> {
  requireCan(userId, "events", "read");
  return prisma.event.count({ where: { userId, type, at: { gte: since } } });
}

/** Most recent event of one type (optionally for one refId), or null. */
/** Events of one type since a moment, newest first. */
export async function listEventsOfTypeSince(
  userId: string,
  type: string,
  since: Date,
  options: { limit?: number } = {},
): Promise<Event[]> {
  requireCan(userId, "events", "read");
  return prisma.event.findMany({
    where: { userId, type, at: { gte: since } },
    orderBy: { at: "desc" },
    take: options.limit ?? 200,
  });
}

export async function findLatestEvent(
  userId: string,
  type: string,
  refId?: string,
): Promise<Event | null> {
  requireCan(userId, "events", "read");
  return prisma.event.findFirst({
    where: { userId, type, ...(refId ? { refId } : {}) },
    orderBy: { at: "desc" },
  });
}

/** Recent events across several types (household activity feed). */
export async function listEventsByTool(
  userId: string,
  tools: string[],
  options: { limit?: number } = {},
): Promise<Event[]> {
  requireCan(userId, "events", "read");
  return prisma.event.findMany({
    where: { userId, tool: { in: tools } },
    orderBy: { at: "desc" },
    take: options.limit ?? 10,
  });
}

/**
 * Stamp meta.actorUserId when someone other than the scope owner acted
 * (household data), and meta.via = "agent" when an external agent made the
 * write through the assistant API. Pure so it can be tested; object metas only.
 */
export function withActorMeta(
  meta: Prisma.InputJsonValue | null | undefined,
  scopeUserId: string,
  actorUserId: string | null,
  via: "agent" | null = null,
): Prisma.InputJsonValue | undefined {
  const extra: Record<string, Prisma.InputJsonValue> = {};
  if (actorUserId && actorUserId !== scopeUserId) extra.actorUserId = actorUserId;
  if (via) extra.via = via;
  if (Object.keys(extra).length === 0) return meta ?? undefined;
  if (meta == null) return extra;
  if (typeof meta === "object" && !Array.isArray(meta)) {
    return { ...(meta as Record<string, Prisma.InputJsonValue>), ...extra };
  }
  return meta;
}

export async function recordEvent(input: EventInput): Promise<void> {
  await prisma.event.create({
    data: {
      userId: input.userId,
      tool: input.tool,
      type: input.type,
      refId: input.refId ?? null,
      meta: withActorMeta(input.meta, input.userId, currentActorUserId(), currentActorVia()),
    },
  });
  logger.info(
    {
      userId: input.userId,
      tool: input.tool,
      type: input.type,
      refId: input.refId ?? undefined,
    },
    "event recorded",
  );
}

/** The few event fields the usage page needs. */
export type UsageEventRow = {
  userId: string;
  type: string;
  at: Date;
  meta: Prisma.JsonValue | null;
};

/**
 * Every event in a window for one or more data owners (the viewer plus the
 * household's shared data user), oldest first. Columns are kept minimal:
 * eight weeks of activity is a few thousand small rows.
 */
export async function listUsageEvents(
  userIds: string[],
  from: Date,
  to: Date,
): Promise<UsageEventRow[]> {
  for (const userId of userIds) requireCan(userId, "events", "read");
  if (userIds.length === 0) return [];
  return prisma.event.findMany({
    where: { userId: { in: userIds }, at: { gte: from, lt: to } },
    select: { userId: true, type: true, at: true, meta: true },
    orderBy: { at: "asc" },
    take: 20000,
  });
}
