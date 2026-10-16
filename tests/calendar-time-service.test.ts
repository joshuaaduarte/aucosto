import { describe, it, expect, vi, beforeEach } from "vitest";

class FakeKnownError extends Error {
  constructor(
    public code: string,
    public meta?: Record<string, unknown>,
  ) {
    super(`fake prisma error ${code}`);
  }
}

const prismaMock = {
  $executeRawUnsafe: vi.fn().mockResolvedValue(undefined),
  $executeRaw: vi.fn().mockResolvedValue(1),
  $queryRaw: vi.fn().mockResolvedValue([]),
  timeEntry: {
    findFirst: vi.fn().mockResolvedValue({ id: "entry-1" }),
    findMany: vi.fn().mockResolvedValue([]),
  },
};

const listCalendarItems = vi.fn();
const getCalendarItem = vi.fn();

function mockCalendar() {
  vi.doMock("@/lib/services/calendar", () => ({
    listCalendarItems,
    getCalendarItem,
    // Same semantics as the real helper.
    backingCalendarItemId: (id: string) => id.split("::")[0],
  }));
}

function mockPrisma() {
  vi.doMock("@/lib/prisma", () => ({ prisma: prismaMock }));
  vi.doMock("@/generated/prisma/client", () => ({
    Prisma: {
      PrismaClientKnownRequestError: FakeKnownError,
      sql: (strings: TemplateStringsArray, ...values: unknown[]) => ({
        sql: strings.join("?"),
        values,
      }),
      join: (values: unknown[]) => values,
    },
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

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  mockPrisma();
  mockCalendar();
  prismaMock.$executeRawUnsafe.mockResolvedValue(undefined);
  prismaMock.$queryRaw.mockResolvedValue([]);
  prismaMock.timeEntry.findFirst.mockResolvedValue({ id: "entry-1" });
});

// ── resolveCalendarBlockByTitle ─────────────────────────────────────────────

describe("resolveCalendarBlockByTitle", () => {
  it("exact title match wins", async () => {
    listCalendarItems.mockResolvedValue([
      block("b1", "Morning gym session", "2026-10-15T14:00:00.000Z", "2026-10-15T15:00:00.000Z"),
      block("b2", "Gym", "2026-10-15T18:00:00.000Z", "2026-10-15T19:00:00.000Z"),
    ]);
    const { resolveCalendarBlockByTitle } = await import("@/lib/services/time-calendar");
    const result = await resolveCalendarBlockByTitle("user-1", "GYM");
    expect(result.eventId).toBe("b2");
    expect(result.title).toBe("Gym");
    expect(result.warnings).toHaveLength(0);
  });

  it("warns and suggests on a single fuzzy match instead of linking", async () => {
    listCalendarItems.mockResolvedValue([
      block("b1", "Morning gym session", "2026-10-15T14:00:00.000Z", "2026-10-15T15:00:00.000Z"),
      block("b2", "Lunch", "2026-10-15T19:00:00.000Z", "2026-10-15T19:30:00.000Z"),
    ]);
    const { resolveCalendarBlockByTitle } = await import("@/lib/services/time-calendar");
    const result = await resolveCalendarBlockByTitle("user-1", "gym");
    expect(result.eventId).toBeNull();
    expect(
      result.warnings.some((w) =>
        w.includes('"gym" is close to "Morning gym session" but not an exact match'),
      ),
    ).toBe(true);
  });

  it("warns and skips unknown titles", async () => {
    listCalendarItems.mockResolvedValue([
      block("b1", "Lunch", "2026-10-15T19:00:00.000Z", "2026-10-15T19:30:00.000Z"),
    ]);
    const { resolveCalendarBlockByTitle } = await import("@/lib/services/time-calendar");
    const result = await resolveCalendarBlockByTitle("user-1", "Zumba");
    expect(result.eventId).toBeNull();
    expect(result.warnings.some((w) => w.includes('No calendar block matched "Zumba"'))).toBe(true);
  });

  it("warns and skips ambiguous titles", async () => {
    listCalendarItems.mockResolvedValue([
      block("b1", "Gym", "2026-10-15T14:00:00.000Z", "2026-10-15T15:00:00.000Z"),
      block("b2", "Gym with Cecil", "2026-10-15T18:00:00.000Z", "2026-10-15T19:00:00.000Z"),
    ]);
    const { resolveCalendarBlockByTitle } = await import("@/lib/services/time-calendar");
    const result = await resolveCalendarBlockByTitle("user-1", "ym");
    expect(result.eventId).toBeNull();
    expect(
      result.warnings.some((w) => w.includes("Multiple calendar blocks matched")),
    ).toBe(true);
  });

  it("resolves recurring occurrences to their parent id", async () => {
    listCalendarItems.mockResolvedValue([
      block(
        "parent-1::2026-10-15T14:00:00.000Z",
        "Standup",
        "2026-10-15T14:00:00.000Z",
        "2026-10-15T14:15:00.000Z",
      ),
    ]);
    const { resolveCalendarBlockByTitle } = await import("@/lib/services/time-calendar");
    const result = await resolveCalendarBlockByTitle("user-1", "standup");
    expect(result.eventId).toBe("parent-1");
  });
});

// ── suggestCalendarLinkForStart ─────────────────────────────────────────────

describe("suggestCalendarLinkForStart", () => {
  it("suggests the nearest block within 15 min of its start", async () => {
    const now = new Date("2026-10-15T14:05:00.000Z");
    listCalendarItems.mockResolvedValue([
      block("far", "Far", "2026-10-15T15:00:00.000Z", "2026-10-15T16:00:00.000Z"),
      block("near", "Gym", "2026-10-15T14:00:00.000Z", "2026-10-15T15:00:00.000Z"),
    ]);
    const { suggestCalendarLinkForStart } = await import("@/lib/services/time-calendar");
    const result = await suggestCalendarLinkForStart("user-1", now);
    expect(result).toEqual({ eventId: "near", title: "Gym" });
  });

  it("suggests a block starting within 15 min in the future", async () => {
    const now = new Date("2026-10-15T13:50:00.000Z");
    listCalendarItems.mockResolvedValue([
      block("soon", "Lunch", "2026-10-15T14:00:00.000Z", "2026-10-15T14:30:00.000Z"),
    ]);
    const { suggestCalendarLinkForStart } = await import("@/lib/services/time-calendar");
    const result = await suggestCalendarLinkForStart("user-1", now);
    expect(result).toEqual({ eventId: "soon", title: "Lunch" });
  });

  it("returns null when no block starts within 15 min", async () => {
    const now = new Date("2026-10-15T12:00:00.000Z");
    listCalendarItems.mockResolvedValue([
      block("far", "Gym", "2026-10-15T14:00:00.000Z", "2026-10-15T15:00:00.000Z"),
    ]);
    const { suggestCalendarLinkForStart } = await import("@/lib/services/time-calendar");
    expect(await suggestCalendarLinkForStart("user-1", now)).toBeNull();
  });
});

// ── suggestCalendarLinkForRange ─────────────────────────────────────────────

describe("suggestCalendarLinkForRange", () => {
  it("suggests the block with the largest overlap", async () => {
    listCalendarItems.mockResolvedValue([
      block("small", "Call", "2026-10-15T09:00:00.000Z", "2026-10-15T09:15:00.000Z"),
      block("big", "Deep work", "2026-10-15T09:00:00.000Z", "2026-10-15T11:00:00.000Z"),
    ]);
    const { suggestCalendarLinkForRange } = await import("@/lib/services/time-calendar");
    const result = await suggestCalendarLinkForRange(
      "user-1",
      new Date("2026-10-15T09:30:00.000Z"),
      new Date("2026-10-15T10:30:00.000Z"),
    );
    expect(result).toEqual({ eventId: "big", title: "Deep work" });
  });

  it("returns null when nothing overlaps", async () => {
    listCalendarItems.mockResolvedValue([
      block("b", "Lunch", "2026-10-15T12:00:00.000Z", "2026-10-15T12:30:00.000Z"),
    ]);
    const { suggestCalendarLinkForRange } = await import("@/lib/services/time-calendar");
    const result = await suggestCalendarLinkForRange(
      "user-1",
      new Date("2026-10-15T09:00:00.000Z"),
      new Date("2026-10-15T10:00:00.000Z"),
    );
    expect(result).toBeNull();
  });
});

// ── setEntryCalendarLink ────────────────────────────────────────────────────

describe("setEntryCalendarLink", () => {
  it("writes the backing id for a plain event id", async () => {
    getCalendarItem.mockResolvedValue({ id: "event-1", title: "Gym" });
    const { setEntryCalendarLink } = await import("@/lib/services/time-calendar");
    await setEntryCalendarLink("user-1", "entry-1", "event-1");
    expect(prismaMock.$executeRaw).toHaveBeenCalledOnce();
    const sql = prismaMock.$executeRaw.mock.calls[0]![0] as { values: unknown[] };
    expect(sql.values).toContain("event-1");
    expect(sql.values).toContain("entry-1");
  });

  it("resolves virtual occurrence ids to the parent row", async () => {
    getCalendarItem.mockResolvedValue({ id: "parent-1", title: "Standup" });
    const { setEntryCalendarLink } = await import("@/lib/services/time-calendar");
    await setEntryCalendarLink("user-1", "entry-1", "parent-1::2026-10-15T14:00:00.000Z");
    const sql = prismaMock.$executeRaw.mock.calls[0]![0] as { values: unknown[] };
    expect(sql.values).toContain("parent-1");
  });

  it("throws when the entry is missing or belongs to another user", async () => {
    prismaMock.timeEntry.findFirst.mockResolvedValue(null);
    const { setEntryCalendarLink } = await import("@/lib/services/time-calendar");
    await expect(setEntryCalendarLink("user-1", "missing", "event-1")).rejects.toThrow(
      'Time entry "missing" not found',
    );
    expect(prismaMock.$executeRaw).not.toHaveBeenCalled();
  });

  it("throws when the calendar event does not exist", async () => {
    getCalendarItem.mockResolvedValue(null);
    const { setEntryCalendarLink } = await import("@/lib/services/time-calendar");
    await expect(setEntryCalendarLink("user-1", "entry-1", "nope")).rejects.toThrow(
      'Calendar event "nope" not found',
    );
    expect(prismaMock.$executeRaw).not.toHaveBeenCalled();
  });
});

// ── listEntriesForCalendarEvents ────────────────────────────────────────────

describe("listEntriesForCalendarEvents", () => {
  it("returns linked rows", async () => {
    const rows = [
      {
        id: "e1",
        label: "Gym",
        startedAt: new Date("2026-10-15T14:00:00.000Z"),
        endedAt: new Date("2026-10-15T15:00:00.000Z"),
        calendarEventId: "event-1",
      },
    ];
    prismaMock.$queryRaw.mockResolvedValue(rows);
    const { listEntriesForCalendarEvents } = await import("@/lib/services/time-calendar");
    const result = await listEntriesForCalendarEvents("user-1", ["event-1"]);
    expect(result).toEqual(rows);
  });

  it("degrades to [] when the column does not exist yet", async () => {
    prismaMock.$queryRaw.mockRejectedValue(new FakeKnownError("P2010", { message: "42703" }));
    const { listEntriesForCalendarEvents } = await import("@/lib/services/time-calendar");
    const result = await listEntriesForCalendarEvents("user-1", ["event-1"]);
    expect(result).toEqual([]);
  });
});
