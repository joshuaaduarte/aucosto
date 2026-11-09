import { describe, expect, it } from "vitest";
import {
  AGENT_AUDIT_WINDOW_MS,
  buildUsageReport,
  classifyUsageEvent,
  hasTimeNear,
  usageAreaKey,
  usageHeadline,
  usageWindowStart,
  type UsageEvent,
} from "@/lib/insights/usage";

// Monday 9 Nov 2026, 1:40 pm local.
const NOW = new Date(2026, 10, 9, 13, 40);
const ME = "me";
const HOUSE = "household";

function at(daysAgo: number, hour = 10, minute = 0): Date {
  return new Date(2026, 10, 9 - daysAgo, hour, minute);
}

function event(type: string, when: Date, meta: unknown = null, userId = ME): UsageEvent {
  return { userId, type, at: when, meta };
}

const context = { viewerUserId: ME, agentActionTimes: [] as number[], now: NOW };

describe("usageAreaKey", () => {
  it("groups by the event type's prefix", () => {
    expect(usageAreaKey("finance.entry_added")).toBe("finance");
    expect(usageAreaKey("plan.saved")).toBe("plan");
    expect(usageAreaKey("project.task_created")).toBe("project");
  });

  it("ignores events that are not use of a tool", () => {
    for (const type of ["user.login_failed", "push.subscribed", "location.arrived", "whoop.connected", "household.joined"]) {
      expect(usageAreaKey(type)).toBeNull();
    }
  });
});

describe("hasTimeNear", () => {
  it("finds a time inside the window on either side", () => {
    const times = [1_000, 50_000, 90_000];
    expect(hasTimeNear(times, 49_000, 2_000)).toBe(true);
    expect(hasTimeNear(times, 51_500, 2_000)).toBe(true);
    expect(hasTimeNear(times, 60_000, 2_000)).toBe(false);
    expect(hasTimeNear([], 60_000, 2_000)).toBe(false);
  });
});

describe("classifyUsageEvent", () => {
  it("counts an ordinary entry as yours", () => {
    expect(classifyUsageEvent(event("time.started", at(0)), context)).toBe("you");
  });

  it("recognises an agent by the stamp on the event", () => {
    expect(classifyUsageEvent(event("reflect.saved", at(0), { via: "agent" }), context)).toBe("agent");
  });

  it("recognises older agent entries by an audited action at the same moment", () => {
    const when = at(1, 7, 38);
    const near = { ...context, agentActionTimes: [when.getTime() + 2_000] };
    expect(classifyUsageEvent(event("reflect.saved", when), near)).toBe("agent");
    const far = { ...context, agentActionTimes: [when.getTime() + AGENT_AUDIT_WINDOW_MS + 1] };
    expect(classifyUsageEvent(event("reflect.saved", when), far)).toBe("you");
  });

  it("does not let an agent's audit claim a partner's household entry", () => {
    const when = at(1);
    const near = { ...context, agentActionTimes: [when.getTime()] };
    const ana = event("finance.entry_added", when, { actorUserId: "ana" }, HOUSE);
    expect(classifyUsageEvent(ana, near)).toBe("partner");
  });

  it("counts your own entry on household data as yours", () => {
    const mine = event("home.items_added", at(0), { actorUserId: ME }, HOUSE);
    expect(classifyUsageEvent(mine, context)).toBe("you");
  });

  it("sets automatic syncs apart from use", () => {
    expect(classifyUsageEvent(event("habit.health_synced", at(0)), context)).toBe("auto");
  });
});

describe("buildUsageReport", () => {
  it("covers eight Monday-start weeks ending with the current one", () => {
    const report = buildUsageReport([], context);
    expect(report.weeks).toHaveLength(8);
    expect(report.weeks.at(-1)!.key).toBe("2026-11-09");
    expect(report.weeks[0]!.key).toBe("2026-09-21");
    expect(usageWindowStart(NOW).getDay()).toBe(1);
    // Today is Monday: the other six days of this week have not happened.
    expect(report.weeks.at(-1)!.days.filter((day) => day.future)).toHaveLength(6);
  });

  it("reports an agent-only week as zero days of your own use", () => {
    const events = [0, 1, 2, 3, 4, 5, 6].map((d) => event("reflect.saved", at(d, 7, 38), { via: "agent" }));
    const report = buildUsageReport(events, context);
    expect(report.goal.last7).toBe(0);
    expect(report.last7).toEqual({ you: 0, partner: 0, agent: 7 });
    expect(report.streak).toBe(0);
    expect(usageHeadline(report)).toMatch(/nothing yourself/);
  });

  it("counts active days, not entries", () => {
    const events = [
      event("time.started", at(0, 9)),
      event("time.stopped", at(0, 10)),
      event("do.completed", at(0, 11)),
      event("habit.logged", at(2)),
    ];
    const report = buildUsageReport(events, context);
    expect(report.goal.last7).toBe(2);
    expect(report.last7.you).toBe(4);
  });

  it("meets the goal only with five active days in each of the last two weeks", () => {
    const oneWeek = [0, 1, 2, 3, 4].map((d) => event("habit.logged", at(d)));
    expect(buildUsageReport(oneWeek, context).goal).toMatchObject({ last7: 5, prior7: 0, met: false });

    const twoWeeks = [...oneWeek, ...[7, 8, 9, 10, 11].map((d) => event("habit.logged", at(d)))];
    const report = buildUsageReport(twoWeeks, context);
    expect(report.goal).toMatchObject({ last7: 5, prior7: 5, met: true });
    expect(usageHeadline(report)).toMatch(/habit/);
  });

  it("keeps a streak alive until the end of today", () => {
    const events = [1, 2, 3].map((d) => event("do.completed", at(d)));
    expect(buildUsageReport(events, context).streak).toBe(3);
    expect(buildUsageReport([...events, event("do.completed", at(0))], context).streak).toBe(4);
    expect(buildUsageReport([event("do.completed", at(2))], context).streak).toBe(0);
  });

  it("splits each part of the app by week and by who made the entry", () => {
    const events = [
      event("finance.entry_added", at(0)),
      event("finance.entry_added", at(0), { actorUserId: "ana" }, HOUSE),
      event("finance.entry_added", at(7)),
      event("reflect.saved", at(0), { via: "agent" }),
    ];
    const report = buildUsageReport(events, { ...context, hasPartner: true });
    const money = report.areas.find((area) => area.key === "finance")!;
    expect(money.weeks.at(-1)).toEqual({ you: 1, partner: 1, agent: 0 });
    expect(money.weeks.at(-2)).toEqual({ you: 1, partner: 0, agent: 0 });
    expect(money.totals).toEqual({ you: 2, partner: 1, agent: 0 });
    const reflect = report.areas.find((area) => area.key === "reflect")!;
    expect(reflect.totals).toEqual({ you: 0, partner: 0, agent: 1 });
    expect(report.hasPartner).toBe(true);
  });

  it("calls a tool quiet when no person has used it for 30 days, whatever agents did", () => {
    const events = [
      event("reflect.saved", at(0), { via: "agent" }),
      event("time.started", at(40)),
      event("habit.logged", at(3)),
      event("home.items_added", at(2), { actorUserId: "ana" }, HOUSE),
    ];
    const report = buildUsageReport(events, context);
    const quiet = (key: string) => report.areas.find((area) => area.key === key)!.quiet;
    expect(quiet("reflect")).toBe(true);
    expect(quiet("time")).toBe(true);
    expect(quiet("habit")).toBe(false);
    expect(quiet("home")).toBe(false);
    expect(quiet("work")).toBe(true);
  });

  it("leaves automatic syncs and non-tool events out of every count", () => {
    const events = [
      event("habit.health_synced", at(0)),
      event("user.login_failed", at(0)),
      event("location.arrived", at(0)),
    ];
    const report = buildUsageReport(events, context);
    expect(report.last7).toEqual({ you: 0, partner: 0, agent: 0 });
    expect(report.autoLast7).toBe(1);
    expect(report.goal.last7).toBe(0);
  });

  it("ignores events outside the eight-week window", () => {
    const report = buildUsageReport([event("time.started", at(90))], context);
    expect(report.areas.find((area) => area.key === "time")!.totals.you).toBe(0);
    expect(report.lastYouAt).toBeNull();
  });
});
