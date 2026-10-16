import { describe, it, expect, vi, beforeEach } from "vitest";

const listCalendarItems = vi.fn();
const backingCalendarItemId = vi.fn((id: string) => id.split("::")[0]);
const listEntriesForCalendarEvents = vi.fn();

function mockServices() {
  vi.doMock("@/lib/services/calendar", () => ({
    listCalendarItems,
    backingCalendarItemId,
  }));
  vi.doMock("@/lib/services/time-calendar", () => ({
    listEntriesForCalendarEvents,
    localDayBounds: (_day: Date) => ({
      from: new Date(2026, 9, 15, 0, 0, 0),
      to: new Date(2026, 9, 16, 0, 0, 0),
    }),
  }));
}

const block = (id: string, title: string, startIso: string, endIso: string) => ({
  id,
  title,
  startsAt: new Date(startIso),
  endsAt: new Date(endIso),
  status: "confirmed",
  userId: "user-1",
});

const entry = (
  id: string,
  label: string,
  eventId: string,
  startIso: string,
  endIso: string | null,
) => ({
  id,
  label,
  startedAt: new Date(startIso),
  endedAt: endIso ? new Date(endIso) : null,
  calendarEventId: eventId,
});

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  mockServices();
});

describe("fetchAssistantPlannedVsActual", () => {
  it("returns per-block planned and actuals with delta and drift", async () => {
    listCalendarItems.mockResolvedValue([
      block("b1", "Gym", "2026-10-15T14:00:00.000Z", "2026-10-15T15:00:00.000Z"),
      block("b2", "Lunch", "2026-10-15T19:00:00.000Z", "2026-10-15T19:30:00.000Z"),
    ]);
    listEntriesForCalendarEvents.mockResolvedValue([
      entry("e1", "Gym", "b1", "2026-10-15T14:05:00.000Z", "2026-10-15T14:50:00.000Z"),
    ]);
    const { fetchAssistantPlannedVsActual } = await import("@/lib/assistant-lists");
    const result = await fetchAssistantPlannedVsActual("user-1", { date: "2026-10-15" });

    expect(result.date).toBe("2026-10-15");
    expect(result.count).toBe(2);

    const gym = result.blocks[0]!;
    expect(gym.eventId).toBe("b1");
    expect(gym.title).toBe("Gym");
    expect(gym.plannedStart).toBe("2026-10-15T14:00:00.000Z");
    expect(gym.plannedEnd).toBe("2026-10-15T15:00:00.000Z");
    expect(gym.plannedMinutes).toBe(60);
    expect(gym.actualEntries).toEqual([
      {
        entryId: "e1",
        title: "Gym",
        actualStart: "2026-10-15T14:05:00.000Z",
        actualEnd: "2026-10-15T14:50:00.000Z",
      },
    ]);
    expect(gym.actualMinutes).toBe(45);
    expect(gym.deltaMinutes).toBe(-15);
    expect(gym.startDriftMinutes).toBe(5);

    // Unlinked blocks still appear with empty actuals so gaps are visible.
    const lunch = result.blocks[1]!;
    expect(lunch.title).toBe("Lunch");
    expect(lunch.actualEntries).toEqual([]);
    expect(lunch.actualMinutes).toBe(0);
    expect(lunch.deltaMinutes).toBe(-30);
    expect(lunch.startDriftMinutes).toBeNull();
  });

  it("matches recurring occurrences to their parent-row links", async () => {
    listCalendarItems.mockResolvedValue([
      block(
        "parent-1::2026-10-15T14:00:00.000Z",
        "Standup",
        "2026-10-15T14:00:00.000Z",
        "2026-10-15T14:15:00.000Z",
      ),
    ]);
    listEntriesForCalendarEvents.mockResolvedValue([
      entry("e1", "Standup notes", "parent-1", "2026-10-15T14:00:00.000Z", "2026-10-15T14:20:00.000Z"),
    ]);
    const { fetchAssistantPlannedVsActual } = await import("@/lib/assistant-lists");
    const result = await fetchAssistantPlannedVsActual("user-1", { date: "2026-10-15" });
    expect(result.blocks).toHaveLength(1);
    expect(result.blocks[0]!.eventId).toBe("parent-1::2026-10-15T14:00:00.000Z");
    expect(result.blocks[0]!.actualEntries).toHaveLength(1);
    expect(result.blocks[0]!.deltaMinutes).toBe(5);
  });

  it("lists running entries but excludes them from actualMinutes", async () => {
    listCalendarItems.mockResolvedValue([
      block("b1", "Gym", "2026-10-15T14:00:00.000Z", "2026-10-15T15:00:00.000Z"),
    ]);
    listEntriesForCalendarEvents.mockResolvedValue([
      entry("e1", "Gym", "b1", "2026-10-15T14:00:00.000Z", null),
    ]);
    const { fetchAssistantPlannedVsActual } = await import("@/lib/assistant-lists");
    const result = await fetchAssistantPlannedVsActual("user-1", { date: "2026-10-15" });
    const gym = result.blocks[0]!;
    expect(gym.actualEntries).toEqual([
      {
        entryId: "e1",
        title: "Gym",
        actualStart: "2026-10-15T14:00:00.000Z",
        actualEnd: null,
      },
    ]);
    expect(gym.actualMinutes).toBe(0);
    expect(gym.startDriftMinutes).toBe(0);
  });

  it("defaults to today when no date is given and returns no blocks when none exist", async () => {
    listCalendarItems.mockResolvedValue([]);
    listEntriesForCalendarEvents.mockResolvedValue([]);
    const { fetchAssistantPlannedVsActual } = await import("@/lib/assistant-lists");
    const result = await fetchAssistantPlannedVsActual("user-1", {});
    expect(result.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(result.blocks).toEqual([]);
    expect(result.count).toBe(0);
  });

  it("rejects a malformed date via the query schema", async () => {
    const { plannedVsActualQuerySchema } = await import("@/lib/assistant-lists");
    expect(plannedVsActualQuerySchema.safeParse({ date: "15-10-2026" }).success).toBe(false);
    expect(plannedVsActualQuerySchema.safeParse({ date: "2026-10-15" }).success).toBe(true);
  });
});
