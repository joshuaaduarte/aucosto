// Location signals service. Writes come from /api/location/ingest (iOS
// Shortcuts geofence automations with a bearer token); reads power the hub's
// "at the gym" chip. Reads degrade to null/empty (hub must render without
// this table). Raw coordinates stay in this tool — they are deliberately NOT
// exposed through the assistant snapshot.

import "server-only";
import { prisma } from "@/lib/prisma";
import { requireCan } from "@/lib/auth/can";
import { recordEvent } from "@/lib/services/events";
import {
  deriveCurrentPlace,
  type CurrentPlace,
  type LocationKind,
} from "@/lib/location";

export type LocationEventInput = {
  place: string;
  kind: LocationKind;
  latitude?: number | null;
  longitude?: number | null;
  occurredAt?: Date;
};

export async function recordLocationEvent(
  userId: string,
  input: LocationEventInput,
): Promise<void> {
  requireCan(userId, "location", "write");
  await prisma.locationEvent.create({
    data: {
      userId,
      place: input.place.trim(),
      kind: input.kind,
      latitude: input.latitude ?? null,
      longitude: input.longitude ?? null,
      occurredAt: input.occurredAt ?? new Date(),
    },
  });
  await recordEvent({
    userId,
    tool: "location",
    type: input.kind === "arrive" ? "location.arrived" : "location.left",
    meta: { place: input.place.trim() },
  });
}

/** Where the user is right now, or null (unknown / on the move). */
export async function getCurrentPlace(
  userId: string,
): Promise<CurrentPlace | null> {
  requireCan(userId, "location", "read");
  try {
    const events = await prisma.locationEvent.findMany({
      where: { userId },
      orderBy: { occurredAt: "desc" },
      take: 1,
      select: { place: true, kind: true, occurredAt: true },
    });
    return deriveCurrentPlace(
      events.map((event) => ({
        place: event.place,
        kind: event.kind as LocationKind,
        occurredAt: event.occurredAt,
      })),
      new Date(),
    );
  } catch (error) {
    console.error("[location] getCurrentPlace failed", error);
    return null;
  }
}
