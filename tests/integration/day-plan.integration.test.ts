// Integration coverage for the day plan: planned blocks are stored as
// CalendarItems, so the round trip (save → list → confirm) crosses a real
// service boundary and is worth exercising against the DB.
//
// Run with: npm run test:integration
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { PLAN_SOURCE_TOOL, slotWindow, startOfDay } from "@/lib/day-plan";
import {
  confirmPlan,
  getLastActivityBefore,
  listPlannedBlocks,
  savePlan,
} from "@/lib/services/day-plan";
import { listCalendarItems } from "@/lib/services/calendar";
import { resolveNudge } from "@/lib/nudge-resolver";

const TEST_EMAIL = `integration-day-plan-${Date.now()}@test.local`;

let userId: string;
const tomorrow = startOfDay(new Date(), 1);

function block(title: string, startHour: number, durationMinutes: number) {
  return { title, ...slotWindow({ startHour, durationMinutes }, tomorrow) };
}

beforeAll(async () => {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL not set — integration tests need .env.");
  }
  const user = await prisma.user.create({
    data: { email: TEST_EMAIL, name: "Integration Test" },
  });
  userId = user.id;
});

afterAll(async () => {
  if (userId) await prisma.user.delete({ where: { id: userId } }).catch(() => {});
});

describe("day plan round trip", () => {
  it("starts empty", async () => {
    expect(await listPlannedBlocks(userId, tomorrow)).toEqual([]);
  });

  it("saves blocks as tentative calendar items tagged as the plan", async () => {
    const saved = await savePlan(userId, tomorrow, [
      block("Deep work", 9, 90),
      block("Gym", 18, 45),
    ]);
    expect(saved).toHaveLength(2);

    const blocks = await listPlannedBlocks(userId, tomorrow);
    expect(blocks.map((b) => b.title).sort()).toEqual(["Deep work", "Gym"]);
    // Tentative until the morning confirm — that distinction is what the
    // morning nudge asks about.
    expect(blocks.every((b) => b.confirmed)).toBe(false);

    const items = await listCalendarItems(userId, {
      from: tomorrow,
      to: startOfDay(tomorrow, 1),
    });
    expect(items.every((i) => i.sourceTool === PLAN_SOURCE_TOOL)).toBe(true);
  });

  it("replaces rather than duplicates when saved again", async () => {
    await savePlan(userId, tomorrow, [block("Rewritten", 10, 60)]);
    const blocks = await listPlannedBlocks(userId, tomorrow);
    expect(blocks).toHaveLength(1);
    expect(blocks[0]!.title).toBe("Rewritten");
  });

  it("drops blank titles instead of creating empty blocks", async () => {
    const saved = await savePlan(userId, tomorrow, [
      block("Real block", 11, 60),
      block("   ", 14, 60),
    ]);
    expect(saved).toHaveLength(1);
  });

  it("confirms every tentative block exactly once", async () => {
    const first = await confirmPlan(userId, tomorrow);
    expect(first).toBe(1);
    expect((await listPlannedBlocks(userId, tomorrow)).every((b) => b.confirmed)).toBe(true);
    // Idempotent — a second confirm is a no-op, so a double tap is harmless.
    expect(await confirmPlan(userId, tomorrow)).toBe(0);
  });

  it("does not leak another day's plan", async () => {
    expect(await listPlannedBlocks(userId, startOfDay(new Date()))).toEqual([]);
  });

  it("reports last activity strictly before the cutoff", async () => {
    // Everything this suite wrote happened today, so a cutoff at today's
    // midnight must see nothing — this is exactly the case that made the
    // welcome-back card fail to appear on the day it matters.
    expect(await getLastActivityBefore(userId, startOfDay(new Date()))).toBeNull();

    // With a cutoff in the future, the events written above are visible.
    const recent = await getLastActivityBefore(userId, startOfDay(new Date(), 2));
    expect(recent).toBeInstanceOf(Date);
    expect(Date.now() - recent!.getTime()).toBeLessThan(5 * 60_000);
  });
});

describe("nudge resolution", () => {
  const now = new Date();

  it("evening: asks for tomorrow's blocks when nothing is planned", async () => {
    // This suite confirmed tomorrow's plan above, so clear it first.
    await savePlan(userId, startOfDay(now, 1), []);
    const payload = await resolveNudge(userId, "evening", now);
    expect(payload?.url).toBe("/app/plan");
    expect(payload?.body).toMatch(/two or three blocks/i);
  });

  it("evening: switches to reflecting once tomorrow is planned", async () => {
    await savePlan(userId, startOfDay(now, 1), [
      { title: "Deep work", ...slotWindow({ startHour: 9, durationMinutes: 90 }, startOfDay(now, 1)) },
    ]);
    const payload = await resolveNudge(userId, "evening", now);
    expect(payload?.url).toBe("/app/reflect");
  });

  it("morning: names today's planned blocks instead of a generic greeting", async () => {
    const today = startOfDay(now);
    await savePlan(userId, today, [
      { title: "Deep work", ...slotWindow({ startHour: 9, durationMinutes: 90 }, today) },
      { title: "Gym", ...slotWindow({ startHour: 18, durationMinutes: 45 }, today) },
    ]);
    const payload = await resolveNudge(userId, "morning", now);
    expect(payload?.title).toMatch(/today's plan/i);
    expect(payload?.body).toContain("Deep work");
    expect(payload?.body).toContain("Gym");
    expect(payload?.url).toBe("/app/plan");
  });

  it("morning: falls back to first-block capture with no plan and no wake", async () => {
    await savePlan(userId, startOfDay(now), []);
    const payload = await resolveNudge(userId, "morning", now);
    expect(payload?.title).toMatch(/good morning/i);
    expect(payload?.url).toBe("/app/plan");
  });
});
