// Scheduled nudges (vercel.json crons hit this twice a day). Authenticated
// with CRON_SECRET — Vercel sends it as `Authorization: Bearer <CRON_SECRET>`
// automatically when the env var is set.
//
// The slot is derived from the server clock, which instrumentation.ts pins to
// the owner's timezone: before noon → morning check-in nudge, after → evening
// reflect nudge. Each nudge is skipped when the thing it prompts for already
// happened (wake captured / reflection saved), so a normal day sends nothing.

import { NextResponse } from "next/server";
import { dayKey } from "@/lib/reflect";
import { getReflection } from "@/lib/services/reflect";
import { getTodayWakeStatus } from "@/lib/services/rhythms";
import { listSubscribedUserIds, sendPushToUser } from "@/lib/services/push";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  const authorization = request.headers.get("authorization");
  if (!secret || authorization !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const slot = new Date().getHours() < 12 ? "morning" : "evening";
  const userIds = await listSubscribedUserIds();
  let sent = 0;

  for (const userId of userIds) {
    try {
      if (slot === "morning") {
        const wake = await getTodayWakeStatus(userId);
        if (wake.captured) continue; // already checked in — no nudge
        sent += await sendPushToUser(userId, {
          title: "Good morning ☀️",
          body: "What time did you wake up? Start your morning check-in.",
          url: "/app",
        });
      } else {
        const reflection = await getReflection(userId, dayKey(new Date()));
        if (reflection) continue; // already reflected — no nudge
        sent += await sendPushToUser(userId, {
          title: "Wind down 🌙",
          body: "Take a minute to reflect on today before bed.",
          url: "/app/reflect",
        });
      }
    } catch (error) {
      // One user's failure must not block the rest of the fan-out.
      console.error("[cron/nudges] nudge failed", { userId, slot }, error);
    }
  }

  return NextResponse.json({ ok: true, slot, users: userIds.length, sent });
}
