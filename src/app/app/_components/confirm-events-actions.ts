"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { withViewer } from "@/lib/server-action";
import { confirmCalendarEvent, skipCalendarEvent } from "@/lib/event-confirmations";

const Ids = z.array(z.string().min(1).max(200)).min(1).max(30);

function revalidate() {
  revalidatePath("/app");
  revalidatePath("/app/time");
  revalidatePath("/app/calendar");
}

/** Log each ended event as a linked time entry. Partial success is reported. */
export async function confirmEventsAction(
  ids: string[],
): Promise<{ ok: true; logged: number; failed: number } | { ok: false; error: string }> {
  const parsed = Ids.safeParse(ids);
  if (!parsed.success) return { ok: false, error: "Nothing to log." };
  return withViewer(async (userId) => {
    let logged = 0;
    let failed = 0;
    for (const id of parsed.data) {
      try {
        await confirmCalendarEvent(userId, id);
        logged += 1;
      } catch (error) {
        failed += 1;
        console.error("[confirm-events] confirm failed", { id }, error);
      }
    }
    revalidate();
    return { ok: true as const, logged, failed };
  }, "Could not log those events.");
}

export async function skipEventAction(id: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsed = z.string().min(1).max(200).safeParse(id);
  if (!parsed.success) return { ok: false, error: "Unknown event." };
  return withViewer(async (userId) => {
    await skipCalendarEvent(userId, parsed.data);
    revalidate();
    return { ok: true as const };
  }, "Could not skip that event.");
}
