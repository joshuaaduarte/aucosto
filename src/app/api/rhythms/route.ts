// Programmatic surface for Life Rhythms. The app UI uses server actions
// (src/app/app/rhythms/actions.ts); this route handler is the same-service
// entry point a token-authenticated agent would eventually use. Both delegate
// to src/lib/services/rhythms.ts.
//
// The proxy matcher excludes /api, so these handlers authenticate themselves
// via getViewerContext() and 401 when there's no session.

import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getViewerContext } from "@/lib/viewer-context";
import { isRhythmType } from "@/lib/rhythms";
import {
  completeMorning,
  endRhythm,
  getActiveRhythm,
  listActiveRhythms,
  listRecentRhythms,
  logRhythmSession,
  startMorning,
  startRhythm,
  updateSleepWakeTime,
  updateWakeTime,
} from "@/lib/services/rhythms";
import { stopRunning } from "@/lib/services/time";

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
    wakeAt?: string;
    wakeTime?: string | null;
    notes?: string | null;
  };

  try {
    // Morning check-in: log/refresh today's wake time, carry over last
    // night's sleep duration. Returns { sleepMinutes }. Also closes any
    // open sleep session (resolveLastNightSleepMinutes inside startMorning),
    // so the time tracker must refresh to show the wake-up marker.
    if (payload.action === "morning") {
      const result = await startMorning(
        userId,
        typeof payload.wakeTime === "string" ? payload.wakeTime : null,
      );
      revalidatePath("/app");
      revalidatePath("/app/time");
      return NextResponse.json(result, { status: 201 });
    }
    // Correct an already-recorded wake time (the morning card's edit pencil).
    if (payload.action === "update-wake") {
      if (!payload.sessionId) {
        return NextResponse.json({ error: "sessionId is required." }, { status: 400 });
      }
      if (typeof payload.wakeTime !== "string") {
        return NextResponse.json({ error: "wakeTime is required." }, { status: 400 });
      }
      await updateWakeTime(userId, payload.sessionId, payload.wakeTime);
      revalidatePath("/app");
      revalidatePath("/app/time");
      return NextResponse.json({ ok: true });
    }
    // Correct a completed sleep session's wake time (the sleep card's edit
    // pencil). endedAt moves and the duration is re-derived in the service.
    if (payload.action === "update-sleep-wake") {
      if (!payload.sessionId) {
        return NextResponse.json({ error: "sessionId is required." }, { status: 400 });
      }
      if (typeof payload.wakeAt !== "string") {
        return NextResponse.json({ error: "wakeAt is required." }, { status: 400 });
      }
      const wakeAt = new Date(payload.wakeAt);
      if (Number.isNaN(wakeAt.getTime())) {
        return NextResponse.json(
          { error: "wakeAt must be a valid timestamp." },
          { status: 400 },
        );
      }
      const session = await updateSleepWakeTime(userId, payload.sessionId, wakeAt);
      if (!session) {
        return NextResponse.json({ error: "No sleep session with that id." }, { status: 404 });
      }
      revalidatePath("/app");
      revalidatePath("/app/time");
      return NextResponse.json({ session });
    }
    // Wrap up the morning so the hub card dismisses for the rest of the day.
    if (payload.action === "complete-morning") {
      await completeMorning(userId);
      revalidatePath("/app");
      revalidatePath("/app/time");
      return NextResponse.json({ ok: true });
    }
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
        revalidatePath("/app");
        revalidatePath("/app/time");
        return NextResponse.json({ session }, { status: 201 });
      }
      // Going to bed: stop any running time entry so it doesn't tick all night.
      if (payload.type === "sleep") {
        await stopRunning(userId);
      }
      const session = await startRhythm(userId, payload.type, payload.notes ?? null);
      revalidatePath("/app");
      revalidatePath("/app/time");
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
      revalidatePath("/app");
      revalidatePath("/app/time");
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
