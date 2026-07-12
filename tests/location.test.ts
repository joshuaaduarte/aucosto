import { describe, expect, it } from "vitest";
import {
  CURRENT_PLACE_MAX_AGE_HOURS,
  deriveCurrentPlace,
  type LocationEventLike,
} from "@/lib/location";

const now = new Date("2026-07-12T18:00:00Z");

function event(
  kind: "arrive" | "leave",
  place: string,
  hoursAgo: number,
): LocationEventLike {
  return {
    kind,
    place,
    occurredAt: new Date(now.getTime() - hoursAgo * 3_600_000),
  };
}

describe("deriveCurrentPlace", () => {
  it("returns the place of a fresh arrive event", () => {
    const result = deriveCurrentPlace([event("arrive", "Gym", 1)], now);
    expect(result?.place).toBe("Gym");
    expect(result?.since.getTime()).toBe(now.getTime() - 3_600_000);
  });

  it("returns null when the latest event is a leave", () => {
    expect(
      deriveCurrentPlace(
        [event("leave", "Gym", 0.5), event("arrive", "Gym", 2)],
        now,
      ),
    ).toBeNull();
  });

  it("ignores stale arrivals (missed geofence exits)", () => {
    expect(
      deriveCurrentPlace(
        [event("arrive", "Office", CURRENT_PLACE_MAX_AGE_HOURS + 1)],
        now,
      ),
    ).toBeNull();
  });

  it("still counts an arrival just inside the freshness window", () => {
    expect(
      deriveCurrentPlace(
        [event("arrive", "Office", CURRENT_PLACE_MAX_AGE_HOURS - 1)],
        now,
      )?.place,
    ).toBe("Office");
  });

  it("returns null for empty history and future-dated events", () => {
    expect(deriveCurrentPlace([], now)).toBeNull();
    expect(deriveCurrentPlace([event("arrive", "Home", -1)], now)).toBeNull();
  });
});
