// Apple Health → habits. POSTed by an iPhone Shortcut (see
// docs/apple-health-habits.md) with the day's running totals; every habit
// linked to a measure (Habits → edit → "Fill from Apple Health") gets that
// day's progress replaced, so sending the same day again is safe.
//
// No session: bearer token HEALTH_WEBHOOK_SECRET (falls back to
// LOCATION_WEBHOOK_SECRET so the existing Shortcut token works), resolving
// to the owner user.
//
//   curl -X POST https://<host>/api/apple-health \
//     -H "Authorization: Bearer $HEALTH_WEBHOOK_SECRET" \
//     -H "Content-Type: application/json" \
//     -d '{"date":"2026-11-09","steps":8275,"workouts":1,"sleepHours":7.2}'

import { NextResponse } from "next/server";
import { z } from "zod";
import { bearerMatches } from "@/lib/bearer";
import { resolveOwnerUserId } from "@/lib/owner";
import { dayKey } from "@/lib/reflect";
import { applyHealthDay } from "@/lib/services/habits";

export const dynamic = "force-dynamic";

// Shortcuts sends numbers as strings when a value comes from "Get Details";
// coerce, and treat empty strings as "not sent".
const metric = z.preprocess(
  (value) => (value === "" || value === null ? undefined : value),
  z.coerce.number().min(0).max(1_000_000).optional(),
);

const bodySchema = z.object({
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  steps: metric,
  exerciseMinutes: metric,
  workouts: metric,
  weighIn: metric,
  /** Shortcut-friendly alias: any weight value means "weighed in". */
  weight: metric,
  sleepHours: metric,
  mindfulMinutes: metric,
});

export async function POST(request: Request) {
  const secret = (process.env.HEALTH_WEBHOOK_SECRET ?? process.env.LOCATION_WEBHOOK_SECRET)?.trim();
  if (!secret) {
    return NextResponse.json(
      { error: "Apple Health sync isn't configured (HEALTH_WEBHOOK_SECRET)." },
      { status: 503 },
    );
  }
  if (!bearerMatches(request.headers.get("authorization"), secret)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  const userId = await resolveOwnerUserId();
  if (!userId) {
    return NextResponse.json({ error: "No owner user found." }, { status: 500 });
  }

  const today = dayKey(new Date());
  const date = parsed.data.date && parsed.data.date <= today ? parsed.data.date : today;
  const { weight, date: _date, ...rest } = parsed.data;
  void _date;
  const applied = await applyHealthDay(userId, date, {
    ...rest,
    weighIn: rest.weighIn ?? (weight !== undefined ? (weight > 0 ? 1 : 0) : undefined),
  });
  return NextResponse.json({ ok: true, date, applied });
}
