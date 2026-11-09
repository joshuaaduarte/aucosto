"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { withViewer } from "@/lib/server-action";
import {
  addCalendarFeed,
  removeCalendarFeed,
  syncCalendarFeed,
} from "@/lib/services/calendar-feeds";

export type FeedActionResult = { ok: true; message: string } | { ok: false; error: string };

function revalidateCalendar() {
  revalidatePath("/app");
  revalidatePath("/app/calendar");
  revalidatePath("/app/settings");
}

const AddFeedInput = z.object({
  name: z.string().max(60).default(""),
  url: z.string().min(8, "Paste the calendar's private link.").max(2000),
});

export async function addCalendarFeedAction(input: {
  name: string;
  url: string;
}): Promise<FeedActionResult> {
  const parsed = AddFeedInput.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the link." };
  }
  return withViewer(async (userId) => {
    const { feed, sync } = await addCalendarFeed(userId, parsed.data);
    revalidateCalendar();
    return sync.ok
      ? { ok: true as const, message: `Linked ${feed.name}: ${sync.eventCount} events in the next 90 days.` }
      : { ok: true as const, message: `Saved ${feed.name}, but the first sync failed: ${sync.error}` };
  }, "Could not add that calendar.");
}

export async function syncCalendarFeedAction(feedId: string): Promise<FeedActionResult> {
  return withViewer(async (userId) => {
    const result = await syncCalendarFeed(userId, z.string().min(1).parse(feedId));
    revalidateCalendar();
    return result.ok
      ? { ok: true as const, message: `Up to date: ${result.eventCount} events.` }
      : { ok: false as const, error: result.error };
  }, "Could not refresh that calendar.");
}

export async function removeCalendarFeedAction(feedId: string): Promise<FeedActionResult> {
  return withViewer(async (userId) => {
    await removeCalendarFeed(userId, z.string().min(1).parse(feedId));
    revalidateCalendar();
    return { ok: true as const, message: "Removed. Its events are gone from Aucosto." };
  }, "Could not remove that calendar.");
}
