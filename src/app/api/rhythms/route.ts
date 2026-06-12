// Programmatic surface for Life Rhythms. The app UI uses server actions
// (src/app/app/rhythms/actions.ts); this route handler is the same-service
// entry point a token-authenticated agent would eventually use. Both delegate
// to src/lib/services/rhythms.ts.
//
// The proxy matcher excludes /api, so these handlers authenticate themselves
// via getViewerContext() and 401 when there's no session.

import { NextResponse } from "next/server";
import { getViewerContext } from "@/lib/viewer-context";
import { isRhythmType } from "@/lib/rhythms";
import {
  endRhythm,
  getActiveRhythm,
  listActiveRhythms,
  listRecentRhythms,
  logRhythmSession,
  startRhythm,
} from "@/lib/services/rhythms";

export const dynamic = "force-dynamic";

// GET /api/rhythms          → active sessions + recent history
// GET /api/rhythms?type=... → the active session for one rhythm type
export async function GET(request: Request) {
  const context = await getViewerContext();
  if (!context) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }
  const userId = context.effectiveUserId;
  const url = new URL(request.url);
  const type = url.searchParams.get("type");

  if (type) {
    if (!isRhythmType(type)) {
      return NextResponse.json({ error: "Unknown rhythm type." }, { status: 400 });
    }
    const active = await getActiveRhythm(userId, type);
    return NextResponse.json({ active });
  }

  const [activeByType, recent] = await Promise.all([
    listActiveRhythms(userId),
    listRecentRhythms(userId, { limit: 60 }),
  ]);
  return NextResponse.json({
    active: Object.fromEntries(activeByType),
    recent,
  });
}

// POST /api/rhythms  body: { action: "start" | "end", type?, sessionId?, notes? }
export async function POST(request: Request) {
  const context = await getViewerContext();
  if (!context) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }
  const userId = context.effectiveUserId;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const payload = (body ?? {}) as {
    action?: string;
    type?: string;
    sessionId?: string;
    startedAt?: string;
    endedAt?: string;
    notes?: string | null;
  };

  try {
    if (payload.action === "start") {
      if (!isRhythmType(payload.type)) {
        return NextResponse.json({ error: "Unknown rhythm type." }, { status: 400 });
      }
      // Backfill path: both timestamps present → create an already-completed
      // session (e.g. a forgotten sleep log). startedAt alone still starts a
      // live timer at that instant.
      if (payload.startedAt && payload.endedAt) {
        const start = new Date(payload.startedAt);
        const end = new Date(payload.endedAt);
        if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
          return NextResponse.json(
            { error: "startedAt and endedAt must be valid timestamps." },
            { status: 400 },
          );
        }
        const session = await logRhythmSession(
          userId,
          payload.type,
          start,
          end,
          payload.notes ?? null,
        );
        return NextResponse.json({ session }, { status: 201 });
      }
      const session = await startRhythm(userId, payload.type, payload.notes ?? null);
      return NextResponse.json({ session }, { status: 201 });
    }
    if (payload.action === "end") {
      if (!payload.sessionId) {
        return NextResponse.json({ error: "sessionId is required." }, { status: 400 });
      }
      const session = await endRhythm(userId, payload.sessionId, payload.notes ?? null);
      if (!session) {
        return NextResponse.json({ error: "No active session with that id." }, { status: 404 });
      }
      return NextResponse.json({ session });
    }
    return NextResponse.json(
      { error: "action must be 'start' or 'end'." },
      { status: 400 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Rhythm action failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
