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
import { currentActorUserId } from "@/lib/actor";

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
 * (household data). Pure so it can be tested; object metas only.
 */
export function withActorMeta(
  meta: Prisma.InputJsonValue | null | undefined,
  scopeUserId: string,
  actorUserId: string | null,
): Prisma.InputJsonValue | undefined {
  if (!actorUserId || actorUserId === scopeUserId) return meta ?? undefined;
  if (meta == null) return { actorUserId };
  if (typeof meta === "object" && !Array.isArray(meta)) {
    return { ...(meta as Record<string, Prisma.InputJsonValue>), actorUserId };
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
      meta: withActorMeta(input.meta, input.userId, currentActorUserId()),
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
