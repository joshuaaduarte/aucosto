// Scheduled nudges (vercel.json crons hit this twice a day). Authenticated
// with CRON_SECRET — Vercel sends it as `Authorization: Bearer <CRON_SECRET>`
// automatically when the env var is set.
//
// Timing: the cron hours are derived from the owner's own activity histogram
// rather than guessed — see src/lib/nudge-timing.ts, and re-derive with
// `npx tsx --env-file=.env scripts/derive-nudge-times.ts`. Vercel crons are
// UTC-only, so each slot has two cron lines (one per DST offset) and this
// route sends only on the run whose local hour — read off the server clock,
// which instrumentation.ts pins to the owner's timezone — matches the target.
// `?slot=morning|evening` forces a slot for manual end-to-end checks.
//
// Content lives in src/lib/nudge-resolver.ts: the evening nudge asks for
// tomorrow's blocks (plan-ahead beats a plain reminder), and the morning nudge
// names those blocks and asks only for confirmation. Volume is deliberately
// capped at these two sends per day — the habit cue rides along inside the
// morning nudge rather than becoming a third notification.
//
// This route is only fan-out and delivery; keep the decisions in the resolver
// so they stay testable without sending to real devices.

import { NextResponse } from "next/server";
import { slotDueAt, type NudgeSlot } from "@/lib/nudge-timing";
import { resolveNudge } from "@/lib/nudge-resolver";
import { listSubscribedUserIds, sendPushToUser } from "@/lib/services/push";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  const authorization = request.headers.get("authorization");
  if (!secret || authorization !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const now = new Date();
  const forced = new URL(request.url).searchParams.get("slot");
  const slot: NudgeSlot | null =
    forced === "morning" || forced === "evening" ? forced : slotDueAt(now.getHours());
  if (!slot) {
    // The other DST state's cron line — its twin sends this slot.
    return NextResponse.json({ ok: true, slot: null, hour: now.getHours() });
  }

  const userIds = await listSubscribedUserIds();
  let sent = 0;
  let skipped = 0;

  for (const userId of userIds) {
    try {
      const payload = await resolveNudge(userId, slot, now);
      if (!payload) {
        skipped += 1;
        continue;
      }
      sent += await sendPushToUser(userId, payload);
    } catch (error) {
      // One user's failure must not block the rest of the fan-out.
      console.error("[cron/nudges] nudge failed", { userId, slot }, error);
    }
  }

  return NextResponse.json({ ok: true, slot, users: userIds.length, sent, skipped });
}
