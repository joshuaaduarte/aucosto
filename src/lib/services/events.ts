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
import type { Prisma } from "@/generated/prisma/client";
import type { Tool } from "@/lib/auth/can";

export type EventInput = {
  userId: string;
  tool: Tool;
  type: string; // "{tool}.{verb}", e.g. "time.started"
  refId?: string | null;
  meta?: Prisma.InputJsonValue | null;
};

export async function recordEvent(input: EventInput): Promise<void> {
  await prisma.event.create({
    data: {
      userId: input.userId,
      tool: input.tool,
      type: input.type,
      refId: input.refId ?? null,
      meta: input.meta ?? undefined,
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
