import { describe, expect, it, vi, beforeEach } from "vitest";

import {
  reflectionsQuerySchema,
  serializeReflection,
  type ReflectionsQuery,
} from "@/lib/assistant-lists";
import type { DailyReflectionRecord } from "@/lib/services/reflect";
import { dayKey } from "@/lib/reflect";

function shiftKey(key: string, days: number): string {
  const dt = new Date(`${key}T00:00:00.000Z`);
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

function record(overrides: Partial<DailyReflectionRecord>): DailyReflectionRecord {
  return {
    id: "r1",
    dateKey: "2026-10-10",
    mood: 4,
    energyLevel: 3,
    productivityRating: 4,
    dayRating: 4,
    wentWell: null,
    carryForward: null,
    freeNotes: null,
    contextSnapshot: null,
    ...overrides,
  };
}

// ── reflectionsQuerySchema ──────────────────────────────────────────────────

describe("reflectionsQuerySchema", () => {
  it("defaults to the last 30 days ending today", () => {
    const parsed = reflectionsQuerySchema.parse({});
    const todayKey = dayKey(new Date());
    expect(parsed.to).toBe(todayKey);
    expect(parsed.from).toBe(shiftKey(todayKey, -30));
  });

  it("accepts an explicit from/to range", () => {
    const parsed = reflectionsQuerySchema.parse({
      from: "2026-09-01",
      to: "2026-10-01",
    });
    expect(parsed).toEqual({ from: "2026-09-01", to: "2026-10-01" });
  });

  it("defaults from to 30 days before an explicit to", () => {
    const parsed = reflectionsQuerySchema.parse({ to: "2026-10-15" });
    expect(parsed).toEqual({
      from: shiftKey("2026-10-15", -30),
      to: "2026-10-15",
    });
  });

  it("allows a single-day range", () => {
    const parsed = reflectionsQuerySchema.parse({
      from: "2026-10-15",
      to: "2026-10-15",
    });
    expect(parsed).toEqual({ from: "2026-10-15", to: "2026-10-15" });
  });

  it("rejects malformed date strings", () => {
    for (const bad of ["2026/10/01", "10-01-2026", "tomorrow", "2026-10-1", ""]) {
      expect(reflectionsQuerySchema.safeParse({ from: bad })).toMatchObject({
        success: false,
      });
    }
  });

  it("rejects impossible calendar dates", () => {
    expect(
      reflectionsQuerySchema.safeParse({ from: "2026-13-01" }).success,
    ).toBe(false);
    expect(
      reflectionsQuerySchema.safeParse({ from: "2026-02-30" }).success,
    ).toBe(false);
    // 2024 is a leap year — Feb 29 is real there
    expect(
      reflectionsQuerySchema.safeParse({
        from: "2024-02-29",
        to: "2024-03-01",
      }).success,
    ).toBe(true);
  });

  it('rejects "to" before "from"', () => {
    const result = reflectionsQuerySchema.safeParse({
      from: "2026-10-15",
      to: "2026-10-01",
    });
    expect(result.success).toBe(false);
  });

  it("rejects ranges longer than 90 days", () => {
    expect(
      reflectionsQuerySchema.safeParse({
        from: "2026-07-01",
        to: "2026-10-15",
      }).success,
    ).toBe(false);
    // Exactly 90 days is allowed
    expect(
      reflectionsQuerySchema.safeParse({
        from: shiftKey("2026-10-15", -90),
        to: "2026-10-15",
      }).success,
    ).toBe(true);
  });
});

// ── serializeReflection ─────────────────────────────────────────────────────

describe("serializeReflection", () => {
  it("composes the note from the prose fields", () => {
    const row = serializeReflection(
      record({
        dateKey: "2026-10-10",
        mood: 4,
        wentWell: "Shipped the PR",
        carryForward: "Review feedback",
        freeNotes: "Tired by evening",
      }),
    );
    expect(row.date).toBe("2026-10-10");
    expect(row.mood).toBe(4);
    expect(row.note).toBe(
      "Went well: Shipped the PR\nCarry forward: Review feedback\nTired by evening",
    );
  });

  it("returns null note when all prose fields are empty", () => {
    const row = serializeReflection(record({ mood: 3 }));
    expect(row.note).toBeNull();
    expect(row.mood).toBe(3);
  });

  it("skips blank prose fields", () => {
    const row = serializeReflection(
      record({ wentWell: "  ", freeNotes: "Rest day" }),
    );
    expect(row.note).toBe("Rest day");
  });
});

// ── fetchAssistantReflections ───────────────────────────────────────────────

describe("fetchAssistantReflections", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  async function loadFetcher(rows: DailyReflectionRecord[]) {
    const listReflectionsBetween = vi
      .fn()
      .mockResolvedValue(rows);
    vi.doMock("@/lib/services/reflect", () => ({
      listReflectionsBetween,
    }));
    const mod = await import("@/lib/assistant-lists");
    return { mod, listReflectionsBetween };
  }

  it("returns one row per day with a reflection, oldest first", async () => {
    const { mod, listReflectionsBetween } = await loadFetcher([
      record({ id: "r1", dateKey: "2026-10-08", mood: 2, freeNotes: "rough" }),
      record({ id: "r2", dateKey: "2026-10-10", mood: 5 }),
    ]);
    const query = mod.reflectionsQuerySchema.parse({
      from: "2026-10-01",
      to: "2026-10-15",
    }) as ReflectionsQuery;
    const result = await mod.fetchAssistantReflections("user-1", query);
    expect(result.items).toEqual([
      { date: "2026-10-08", mood: 2, note: "rough" },
      { date: "2026-10-10", mood: 5, note: null },
    ]);
    expect(result.count).toBe(2);
    // Days without a reflection are omitted — the fetcher passes the range
    // straight to the service and only serializes what comes back.
    expect(listReflectionsBetween).toHaveBeenCalledWith("user-1", {
      fromKey: "2026-10-01",
      toKey: "2026-10-15",
    });
  });

  it("returns an empty series for a range with no reflections", async () => {
    const { mod } = await loadFetcher([]);
    const query = mod.reflectionsQuerySchema.parse({
      from: "2026-10-01",
      to: "2026-10-15",
    }) as ReflectionsQuery;
    const result = await mod.fetchAssistantReflections("user-1", query);
    expect(result).toEqual({ items: [], count: 0 });
  });
});

// ── GET /api/assistant/reflections ──────────────────────────────────────────

describe("GET /api/assistant/reflections", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  async function loadRoute(
    authed: { userId: string; via: "bearer" } | null,
    rows: DailyReflectionRecord[] = [],
  ) {
    vi.doMock("@/lib/assistant-auth", () => ({
      resolveAssistantAuth: vi.fn().mockResolvedValue(authed),
    }));
    vi.doMock("@/lib/services/reflect", () => ({
      listReflectionsBetween: vi.fn().mockResolvedValue(rows),
    }));
    return import("@/app/api/assistant/reflections/route");
  }

  it("returns 401 without auth", async () => {
    const { GET } = await loadRoute(null);
    const res = await GET(
      new Request("http://localhost/api/assistant/reflections"),
    );
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "Unauthorized" });
  });

  it("returns 400 on invalid query params", async () => {
    const { GET } = await loadRoute({ userId: "user-1", via: "bearer" });
    const res = await GET(
      new Request(
        "http://localhost/api/assistant/reflections?from=not-a-date",
      ),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Invalid query params");
  });

  it("returns 400 when to is before from", async () => {
    const { GET } = await loadRoute({ userId: "user-1", via: "bearer" });
    const res = await GET(
      new Request(
        "http://localhost/api/assistant/reflections?from=2026-10-15&to=2026-10-01",
      ),
    );
    expect(res.status).toBe(400);
  });

  it("returns the reflection series when authed", async () => {
    const { GET } = await loadRoute(
      { userId: "user-1", via: "bearer" },
      [record({ dateKey: "2026-10-10", mood: 4, freeNotes: "Good day" })],
    );
    const res = await GET(
      new Request(
        "http://localhost/api/assistant/reflections?from=2026-10-01&to=2026-10-15",
      ),
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      items: [{ date: "2026-10-10", mood: 4, note: "Good day" }],
      count: 1,
    });
  });

  it("applies the 30-day default when no params are given", async () => {
    const listReflectionsBetween = vi.fn().mockResolvedValue([]);
    vi.doMock("@/lib/assistant-auth", () => ({
      resolveAssistantAuth: vi
        .fn()
        .mockResolvedValue({ userId: "user-1", via: "bearer" }),
    }));
    vi.doMock("@/lib/services/reflect", () => ({ listReflectionsBetween }));
    const { GET } = await import("@/app/api/assistant/reflections/route");
    const res = await GET(
      new Request("http://localhost/api/assistant/reflections"),
    );
    expect(res.status).toBe(200);
    const todayKey = dayKey(new Date());
    expect(listReflectionsBetween).toHaveBeenCalledWith("user-1", {
      fromKey: shiftKey(todayKey, -30),
      toKey: todayKey,
    });
  });
});
