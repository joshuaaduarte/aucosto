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
import { bearerMatches } from "@/lib/bearer";
import { slotDueAt, type NudgeSlot } from "@/lib/nudge-timing";
import { resolveNudge } from "@/lib/nudge-resolver";
import { listSubscribedUserIds, sendPushToUser } from "@/lib/services/push";
import { listActiveHouseholds, listPartnerUserIds } from "@/lib/household";
import { billsDueWithin } from "@/lib/finance-planning";
import { homeDaysUntil, householdNudgeText } from "@/lib/home";
import { countEntriesSince, listBills } from "@/lib/services/finance";
import { resolveFinanceScopeUserId } from "@/lib/household";
import { LOG_NUDGE, shouldNudgeToLog, thirtyDaysBefore } from "@/lib/finance-entries";
import { listHomeTasks } from "@/lib/services/home";
import { syncAllStaleCalendarFeeds } from "@/lib/services/calendar-feeds";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret || !bearerMatches(request.headers.get("authorization"), secret)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const now = new Date();
  // Every cron line also refreshes linked calendar feeds (hourly staleness),
  // so events stay current on days the app isn't opened.
  const feedsSynced = await syncAllStaleCalendarFeeds(now);
  const forced = new URL(request.url).searchParams.get("slot");
  const slot: NudgeSlot | null =
    forced === "morning" || forced === "evening" ? forced : slotDueAt(now.getHours());
  if (!slot) {
    // The other DST state's cron line — its twin sends this slot.
    return NextResponse.json({ ok: true, slot: null, hour: now.getHours(), feedsSynced });
  }

  const subscribed = await listSubscribedUserIds();
  // Personal nudges (morning check-in, reflection) are about the owner's own
  // tools; household partners only get the household nudge below.
  const partners = new Set(await listPartnerUserIds());
  const userIds = subscribed.filter((id) => !partners.has(id));
  let sent = 0;
  let skipped = 0;

  if (slot === "morning") {
    sent += await sendHouseholdNudges(new Set(subscribed), now);
  }

  // Evening "anything to log today?" for people who log spending by hand.
  // Rides inside the owner's evening nudge when there is one (volume cap);
  // household partners get it on its own.
  const logNudge = slot === "evening" ? await findLogNudgeUsers(subscribed, now) : new Set<string>();
  for (const partnerId of subscribed.filter((id) => partners.has(id) && logNudge.has(id))) {
    try {
      sent += await sendPushToUser(partnerId, { title: LOG_NUDGE.title, body: LOG_NUDGE.body, url: LOG_NUDGE.url });
    } catch (error) {
      console.error("[cron/nudges] log nudge failed", { userId: partnerId }, error);
    }
  }

  for (const userId of userIds) {
    try {
      const resolved = await resolveNudge(userId, slot, now);
      const payload = logNudge.has(userId)
        ? resolved
          ? { ...resolved, body: `${resolved.body} ${LOG_NUDGE.line}` }
          : { title: LOG_NUDGE.title, body: LOG_NUDGE.body, url: LOG_NUDGE.url }
        : resolved;
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

/** Morning "Home today": due chores/maintenance + non-autopay bills due within 3 days. */
async function sendHouseholdNudges(subscribed: Set<string>, now: Date): Promise<number> {
  let sent = 0;
  for (const household of await listActiveHouseholds()) {
    const recipients = household.memberUserIds.filter((id) => subscribed.has(id));
    if (recipients.length === 0) continue;
    try {
      const [tasks, bills] = await Promise.all([
        listHomeTasks(household.dataUserId),
        listBills(household.dataUserId),
      ]);
      const text = householdNudgeText({
        dueTaskTitles: tasks
          .filter((task) => homeDaysUntil(task.nextDueAt, now) <= 0)
          .map((task) => task.title),
        bills: billsDueWithin(
          bills.filter((bill) => !bill.autopay),
          now,
          3,
        ),
      });
      if (!text) continue;
      for (const userId of recipients) {
        sent += await sendPushToUser(userId, { ...text, url: "/app/home" });
      }
    } catch (error) {
      console.error("[cron/nudges] household nudge failed", household.householdId, error);
    }
  }
  return sent;
}

/** Subscribed people whose finance space has hand-logged entries recently but none today. */
async function findLogNudgeUsers(subscribed: string[], now: Date): Promise<Set<string>> {
  const out = new Set<string>();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const byScope = new Map<string, boolean>();
  for (const userId of subscribed) {
    try {
      const scope = await resolveFinanceScopeUserId(userId);
      let nudge = byScope.get(scope);
      if (nudge === undefined) {
        const [loggedLast30Days, loggedToday] = await Promise.all([
          countEntriesSince(scope, thirtyDaysBefore(now)),
          countEntriesSince(scope, startOfToday),
        ]);
        nudge = shouldNudgeToLog({ loggedLast30Days, loggedToday });
        byScope.set(scope, nudge);
      }
      if (nudge) out.add(userId);
    } catch (error) {
      console.error("[cron/nudges] log nudge check failed", { userId }, error);
    }
  }
  return out;
}
