"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { restDayRange, streakDayKey } from "@/lib/app-streak";
import { withViewer } from "@/lib/server-action";
import { setRestDays } from "@/lib/services/streaks";

export type RestDaysResult = { ok: true } | { ok: false; error: string };

const Input = z.object({
  from: z.string().max(10),
  to: z.string().max(10),
  rest: z.boolean(),
});

function revalidateStreaks() {
  revalidatePath("/app");
  revalidatePath("/app/home");
  revalidatePath("/app/habits");
  revalidatePath("/app/settings");
  revalidatePath("/app/insights/usage");
}

/**
 * Mark days from `from` to `to` as rest days (or clear them). Rest days start
 * today or later; clearing works on any day from today on as well.
 */
export async function setRestDaysAction(input: {
  from: string;
  to: string;
  rest: boolean;
}): Promise<RestDaysResult> {
  const parsed = Input.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Pick the days." };
  const range = restDayRange(parsed.data.from, parsed.data.to, new Date());
  if (!range.ok) return range;
  const result = await withViewer(async (userId) => {
    await setRestDays(userId, range.days, parsed.data.rest);
    revalidateStreaks();
    return { ok: true as const };
  }, "Could not save rest days.");
  return result;
}

/** One tap from the streak line: rest today, or undo it. */
export async function setRestTodayAction(rest: boolean): Promise<RestDaysResult> {
  const today = streakDayKey(new Date());
  return setRestDaysAction({ from: today, to: today, rest: z.boolean().parse(rest) });
}
