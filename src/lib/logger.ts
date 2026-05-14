// Structured JSON logging.
//
// Pino runs in Node (Server Components, Server Actions, route handlers).
// Edge code (src/proxy.ts) does NOT import this — edge sets the x-request-id
// header that Node-side callers correlate against via getRequestLogger().
//
// In dev, Vercel/local stdout shows JSON lines; pipe through `pino-pretty`
// manually if you want colors. Production logs are JSON by default, which is
// what Vercel's log aggregator expects.

import "server-only";
import pino, { type Logger } from "pino";
import { headers } from "next/headers";

export const logger: Logger = pino({
  level:
    process.env.LOG_LEVEL ??
    (process.env.NODE_ENV === "production" ? "info" : "debug"),
  base: { app: "aucosto" },
  timestamp: pino.stdTimeFunctions.isoTime,
});

// Returns a child logger bound to the current request id (set by proxy.ts).
// Call from Server Components / Server Actions where headers() is available.
export async function getRequestLogger(): Promise<Logger> {
  const h = await headers();
  const requestId = h.get("x-request-id") ?? undefined;
  return logger.child({ requestId });
}
