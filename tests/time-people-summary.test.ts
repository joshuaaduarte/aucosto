import { describe, it, expect, vi, beforeEach } from "vitest";

const PERSON_ANA = {
  id: "person-ana",
  displayName: "Ana",
  firstName: "Ana",
  lastName: null,
  aliases: [],
  contactKind: "person",
  relationshipType: "spouse",
  organization: null,
  birthday: null,
  createdAt: "2026-01-01",
  lastInteractionAt: null,
};

describe("personTimeSummary", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("aggregates minutes per person with category breakdown", async () => {
    class FakeKnownError extends Error {
      code = "P2021";
    }
    vi.doMock("@/generated/prisma/client", () => ({
      Prisma: { PrismaClientKnownRequestError: FakeKnownError },
    }));
    const links = [
      { timeEntryId: "e1", personId: "person-ana" },
      { timeEntryId: "e2", personId: "person-ana" },
      { timeEntryId: "e2", personId: "person-bob" },
    ];
    const entries = [
      {
        id: "e1",
        startedAt: new Date("2026-10-10T12:00:00.000Z"),
        endedAt: new Date("2026-10-10T13:00:00.000Z"),
        category: "social",
      },
      {
        id: "e2",
        startedAt: new Date("2026-10-11T18:00:00.000Z"),
        endedAt: new Date("2026-10-11T19:30:00.000Z"),
        category: "eating",
      },
    ];
    vi.doMock("@/lib/prisma", () => ({
      prisma: {
        $executeRawUnsafe: vi.fn().mockResolvedValue(undefined),
        $queryRawUnsafe: vi.fn().mockResolvedValue(links),
        timeEntry: {
          findFirst: vi.fn(),
          findMany: vi.fn().mockResolvedValue(entries),
        },
      },
    }));
    vi.doMock("@/lib/services/rolodex", () => ({
      listPersons: vi.fn().mockResolvedValue([
        { ...PERSON_ANA },
        { ...PERSON_ANA, id: "person-bob", displayName: "Bob" },
      ]),
      findPersonByName: vi.fn(),
    }));

    const { personTimeSummary } = await import("@/lib/services/time-people");
    const result = await personTimeSummary("user-1", {
      from: new Date("2026-10-10T00:00:00.000Z"),
      to: new Date("2026-10-17T00:00:00.000Z"),
    });

    expect(result).toHaveLength(2);
    // Ana: 60 + 90 = 150 minutes across 2 entries
    expect(result[0]!.displayName).toBe("Ana");
    expect(result[0]!.totalMinutes).toBe(150);
    expect(result[0]!.entryCount).toBe(2);
    expect(result[0]!.byCategory).toEqual([
      { category: "eating", minutes: 90 },
      { category: "social", minutes: 60 },
    ]);
    // Bob: 90 minutes, 1 entry — full attribution, not split
    expect(result[1]!.displayName).toBe("Bob");
    expect(result[1]!.totalMinutes).toBe(90);
    expect(result[1]!.entryCount).toBe(1);
  });

  it("returns [] when the join table is missing", async () => {
    class FakeKnownError extends Error {
      code = "P2021";
    }
    vi.doMock("@/generated/prisma/client", () => ({
      Prisma: { PrismaClientKnownRequestError: FakeKnownError },
    }));
    vi.doMock("@/lib/prisma", () => ({
      prisma: {
        $executeRawUnsafe: vi.fn().mockRejectedValue(new FakeKnownError("missing")),
        $queryRawUnsafe: vi.fn(),
        timeEntry: { findFirst: vi.fn(), findMany: vi.fn() },
      },
    }));
    vi.doMock("@/lib/services/rolodex", () => ({
      listPersons: vi.fn(),
      findPersonByName: vi.fn(),
    }));

    const { personTimeSummary } = await import("@/lib/services/time-people");
    const result = await personTimeSummary("user-1", {
      from: new Date("2026-10-10T00:00:00.000Z"),
      to: new Date("2026-10-17T00:00:00.000Z"),
    });
    expect(result).toEqual([]);
  });
});
