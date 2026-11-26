import { describe, expect, it } from "vitest";
import {
  appStreakLine,
  buildAppStreak,
  isShowUpEvent,
  PARTNER_STREAK_AREAS,
  restDayRange,
  restDaysFromEvents,
  upcomingRestDays,
  showUpDayKeys,
  streakDayKey,
  streakWindowStart,
  type StreakEvent,
} from "@/lib/app-streak";

// Thursday 26 Nov 2026, 10:30 am local. This week runs Mon 23 – Sun 29.
const NOW = new Date(2026, 10, 26, 10, 30);
const ME = "me";
const ANA = "ana";
const HOUSE = "household";

function day(offsetFromNow: number): Date {
  return new Date(2026, 10, 26 + offsetFromNow, 12);
}
function key(offsetFromNow: number): string {
  return streakDayKey(day(offsetFromNow));
}
/** Day keys for the given weekdays (0 = Monday) of the week `weeksBack` ago. */
function weekDays(weeksBack: number, weekdays: number[]): string[] {
  // Monday 23 Nov is offset -3 from Thursday 26 Nov.
  return weekdays.map((weekday) => key(-3 - 7 * weeksBack + weekday));
}
function ev(partial: Partial<StreakEvent> & { type: string }): StreakEvent {
  return { userId: ME, at: day(0), meta: null, ...partial };
}

describe("isShowUpEvent", () => {
  it("counts the person's own entries", () => {
    expect(isShowUpEvent(ev({ type: "habit.logged" }), ME)).toBe(true);
    expect(isShowUpEvent(ev({ type: "finance.entry_added" }), ME)).toBe(true);
  });

  it("skips agent writes, syncs and non-tool events", () => {
    expect(isShowUpEvent(ev({ type: "reflect.saved", meta: { via: "agent" } }), ME)).toBe(false);
    expect(isShowUpEvent(ev({ type: "habit.health_synced" }), ME)).toBe(false);
    expect(isShowUpEvent(ev({ type: "user.login_failed" }), ME)).toBe(false);
    expect(isShowUpEvent(ev({ type: "streak.rest_day" }), ME)).toBe(false);
  });

  it("credits shared household entries to whoever made them", () => {
    const mine = ev({ userId: HOUSE, type: "home.task_done", meta: { actorUserId: ME } });
    const hers = ev({ userId: HOUSE, type: "home.task_done", meta: { actorUserId: ANA } });
    const unknown = ev({ userId: HOUSE, type: "home.task_done" });
    expect(isShowUpEvent(mine, ME)).toBe(true);
    expect(isShowUpEvent(hers, ME)).toBe(false);
    expect(isShowUpEvent(hers, ANA)).toBe(true);
    expect(isShowUpEvent(unknown, ME)).toBe(false);
  });

  it("does not count a partner's write on the person's own rows", () => {
    expect(isShowUpEvent(ev({ type: "finance.entry_added", meta: { actorUserId: ANA } }), ME)).toBe(
      false,
    );
  });

  it("limits a partner to Money and Home", () => {
    expect(isShowUpEvent(ev({ userId: ANA, type: "habit.logged" }), ANA, PARTNER_STREAK_AREAS)).toBe(
      false,
    );
    expect(
      isShowUpEvent(ev({ userId: ANA, type: "finance.entry_added" }), ANA, PARTNER_STREAK_AREAS),
    ).toBe(true);
  });
});

describe("showUpDayKeys", () => {
  it("collapses many entries into local days", () => {
    const keys = showUpDayKeys(
      [
        ev({ type: "habit.logged", at: new Date(2026, 10, 26, 7) }),
        ev({ type: "do.completed", at: new Date(2026, 10, 26, 22) }),
        ev({ type: "do.completed", at: new Date(2026, 10, 25, 9) }),
      ],
      ME,
    );
    expect([...keys].sort()).toEqual([key(-1), key(0)]);
  });
});

describe("buildAppStreak", () => {
  it("counts consecutive weeks of 5+ days and lays out this week", () => {
    const active = new Set([
      ...weekDays(1, [0, 1, 2, 3, 4]),
      ...weekDays(2, [0, 2, 4, 5, 6]),
      ...weekDays(0, [0, 1]),
    ]);
    const streak = buildAppStreak({ activeDays: active, now: NOW });
    expect(streak.weeksRunning).toBe(2);
    expect(streak.thisWeek.activeDays).toBe(2);
    expect(streak.thisWeek.goal).toBe(5);
    expect(streak.thisWeek.days.map((d) => d.state)).toEqual([
      "done",
      "done",
      "missed",
      "today",
      "future",
      "future",
      "future",
    ]);
    expect(streak.thisWeek.reachable).toBe(true);
    expect(streak.showedUpToday).toBe(false);
    expect(appStreakLine(streak)).toBe("2 of 5 days this week · 2 weeks running");
  });

  it("adds this week once its goal is met", () => {
    const active = new Set([...weekDays(1, [0, 1, 2, 3, 4]), ...weekDays(0, [0, 1, 2, 3])]);
    const thursdayNight = new Date(2026, 10, 26, 21);
    const partial = buildAppStreak({ activeDays: active, now: thursdayNight });
    expect(partial.weeksRunning).toBe(1);

    active.add(weekDays(0, [4])[0]!);
    const friday = buildAppStreak({ activeDays: active, now: new Date(2026, 10, 27, 9) });
    expect(friday.thisWeek.met).toBe(true);
    expect(friday.weeksRunning).toBe(2);
    expect(appStreakLine(friday)).toBe("Week done, 5 days · 2 weeks running");
  });

  it("one short week ends the run, but two quiet days never do", () => {
    const active = new Set([
      ...weekDays(1, [0, 1, 2, 3, 4]), // 5: met
      ...weekDays(2, [0, 1, 2, 3]), // 4: not met
      ...weekDays(3, [0, 1, 2, 3, 4, 5, 6]),
    ]);
    expect(buildAppStreak({ activeDays: active, now: NOW }).weeksRunning).toBe(1);
  });

  it("never mentions a lost run once the week is out of reach", () => {
    const active = new Set([...weekDays(1, [0, 1, 2, 3, 4]), ...weekDays(0, [0])]);
    // Saturday with 1 day logged: at most 3 possible.
    const saturday = buildAppStreak({ activeDays: active, now: new Date(2026, 10, 28, 9) });
    expect(saturday.thisWeek.reachable).toBe(false);
    expect(appStreakLine(saturday)).toBe("1 day this week · fresh week Monday");
  });

  it("rest days lower the goal and a mostly-resting week is paused", () => {
    const rest = new Set([...weekDays(1, [5, 6]), ...weekDays(2, [0, 1, 2, 3, 4, 5, 6])]);
    const active = new Set([
      ...weekDays(1, [0, 1, 2]), // 3 of 3 with two rest days
      ...weekDays(3, [0, 1, 2, 3, 4]),
    ]);
    const streak = buildAppStreak({ activeDays: active, restDays: rest, now: NOW });
    // Last week met at 3, the week before is paused (skipped), the one before met.
    expect(streak.weeksRunning).toBe(2);
  });

  it("a rest day with activity counts as a normal day", () => {
    const today = key(0);
    const streak = buildAppStreak({
      activeDays: new Set([today]),
      restDays: new Set([today]),
      now: NOW,
    });
    expect(streak.thisWeek.restDays).toBe(0);
    expect(streak.thisWeek.days[3]!.state).toBe("done");
  });

  it("caps a run that fills the whole window", () => {
    const active = new Set<string>();
    for (let w = 1; w < 4; w += 1) for (const k of weekDays(w, [0, 1, 2, 3, 4])) active.add(k);
    const monday = new Date(2026, 10, 23, 8);
    const streak = buildAppStreak({ activeDays: active, now: monday, windowWeeks: 4 });
    expect(streak.weeksRunning).toBe(3);
    expect(streak.capped).toBe(true);
    expect(appStreakLine(streak)).toBe("0 of 5 days this week · 3+ weeks running");
  });

  it("has no run line for someone just starting", () => {
    const tuesday = new Date(2026, 10, 24, 20);
    const streak = buildAppStreak({ activeDays: new Set([key(-2)]), now: tuesday });
    expect(streak.weeksRunning).toBe(0);
    expect(appStreakLine(streak)).toBe("1 of 5 days this week");
  });
});

describe("streakWindowStart", () => {
  it("starts on the Monday eleven weeks before this one", () => {
    const start = streakWindowStart(NOW);
    expect(start.getDay()).toBe(1);
    expect(streakDayKey(start)).toBe("2026-09-07");
  });
});

describe("rest days", () => {
  it("replays on/off events in time order", () => {
    const rest = restDaysFromEvents([
      { at: new Date(2026, 10, 20), meta: { days: ["2026-11-27", "2026-11-28"], rest: true } },
      { at: new Date(2026, 10, 22), meta: { days: ["2026-11-28"], rest: false } },
      { at: new Date(2026, 10, 21), meta: { days: ["bad", 3], rest: true } },
    ]);
    expect([...rest]).toEqual(["2026-11-27"]);
  });

  it("builds a range from today on, never backdated or too far ahead", () => {
    expect(restDayRange("2026-11-26", "2026-11-28", NOW)).toEqual({
      ok: true,
      days: ["2026-11-26", "2026-11-27", "2026-11-28"],
    });
    expect(restDayRange("2026-11-25", "2026-11-26", NOW).ok).toBe(false);
    expect(restDayRange("2026-11-28", "2026-11-27", NOW).ok).toBe(false);
    expect(restDayRange("2026-11-26", "2027-01-30", NOW).ok).toBe(false);
    expect(restDayRange("2026-12-30", "2027-01-02", new Date(2026, 11, 29)).ok).toBe(true);
  });

  it("lists upcoming rest days only", () => {
    expect(upcomingRestDays(new Set(["2026-11-30", "2026-11-20", "2026-11-26"]), NOW)).toEqual([
      "2026-11-26",
      "2026-11-30",
    ]);
  });
});
