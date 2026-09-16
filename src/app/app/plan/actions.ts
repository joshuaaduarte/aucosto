"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { slotWindow, startOfDay } from "@/lib/day-plan";
import { confirmPlan, savePlan } from "@/lib/services/day-plan";
import { startEntry } from "@/lib/services/time";
import { withViewer } from "@/lib/server-action";

const blockSchema = z.object({
  title: z.string().trim().min(1).max(120),
  startHour: z.number().int().min(0).max(23),
  durationMinutes: z.number().int().min(5).max(12 * 60),
});

/** Which day the plan targets. Evening planning writes tomorrow; the morning
 *  confirm reads today. */
const targetSchema = z.enum(["today", "tomorrow"]);

function resolveDay(target: "today" | "tomorrow"): Date {
  return startOfDay(new Date(), target === "tomorrow" ? 1 : 0);
}

function revalidatePlanPaths() {
  revalidatePath("/app");
  revalidatePath("/app/plan");
  revalidatePath("/app/calendar");
}

export async function savePlanAction(formData: FormData) {
  return withViewer(async (userId) => {
    const target = targetSchema.parse(formData.get("target") ?? "tomorrow");

    // Rows arrive as parallel title/hour/duration fields, one per slot.
    const titles = formData.getAll("title").map(String);
    const hours = formData.getAll("startHour").map(String);
    const durations = formData.getAll("durationMinutes").map(String);

    const blocks = titles
      .map((title, index) => ({
        title,
        startHour: Number(hours[index]),
        durationMinutes: Number(durations[index]),
      }))
      .filter((row) => row.title.trim().length > 0)
      .map((row) => blockSchema.parse(row));

    if (blocks.length === 0) {
      return { ok: false as const, error: "Add at least one block." };
    }

    const day = resolveDay(target);
    const saved = await savePlan(
      userId,
      day,
      blocks.map((block) => ({
        title: block.title,
        ...slotWindow(block, day),
      })),
    );

    revalidatePlanPaths();
    return { ok: true as const, blocks: saved.length };
  }, "Could not save the plan.");
}

export async function confirmPlanAction() {
  return withViewer(async (userId) => {
    const confirmed = await confirmPlan(userId, resolveDay("today"));
    revalidatePlanPaths();
    return { ok: true as const, confirmed };
  }, "Could not confirm the plan.");
}

/** One-tap "start this block now" straight from the confirm screen — the
 *  whole point of the deep link is that the notification produces a recorded
 *  datum without a detour through the hub. */
export async function startPlannedBlockAction(formData: FormData) {
  return withViewer(async (userId) => {
    const title = z.string().trim().min(1).max(120).parse(formData.get("title"));
    await startEntry(userId, { label: title, category: null });
    revalidatePlanPaths();
    revalidatePath("/app/time");
    return { ok: true as const };
  }, "Could not start the timer.");
}
