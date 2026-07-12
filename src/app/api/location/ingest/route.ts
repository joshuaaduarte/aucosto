// Location signal ingestion — POSTed by iOS Shortcuts geofence automations
// (see docs/location-signals.md). No session: authenticated with a bearer
// token (LOCATION_WEBHOOK_SECRET) and constant-time comparison, resolving to
// the owner user. Returns 503 until the secret is configured.
//
//   curl -X POST https://<host>/api/location/ingest \
//     -H "Authorization: Bearer $LOCATION_WEBHOOK_SECRET" \
//     -H "Content-Type: application/json" \
//     -d '{"place":"Gym","kind":"arrive"}'

import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { resolveOwnerUserId } from "@/lib/owner";
import { recordLocationEvent } from "@/lib/services/location";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  place: z.string().trim().min(1).max(80),
  kind: z.enum(["arrive", "leave"]),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  occurredAt: z.string().datetime({ offset: true }).optional(),
});

function bearerMatches(header: string | null, secret: string): boolean {
  const token = header?.startsWith("Bearer ") ? header.slice(7) : "";
  const a = Buffer.from(token);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(request: Request) {
  const secret = process.env.LOCATION_WEBHOOK_SECRET?.trim();
  if (!secret) {
    return NextResponse.json(
      { error: "Location ingestion isn't configured (LOCATION_WEBHOOK_SECRET)." },
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

  await recordLocationEvent(userId, {
    place: parsed.data.place,
    kind: parsed.data.kind,
    latitude: parsed.data.latitude ?? null,
    longitude: parsed.data.longitude ?? null,
    occurredAt: parsed.data.occurredAt
      ? new Date(parsed.data.occurredAt)
      : undefined,
  });
  return NextResponse.json({ ok: true }, { status: 201 });
}
