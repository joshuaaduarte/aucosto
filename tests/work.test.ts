import { describe, expect, it } from "vitest";
import {
  dueLabel,
  groupTasksForToday,
  meetingOccursOnDay,
  meetingsOnDay,
  workDayKey,
  workWeekKey,
  type WorkTaskSummary,
} from "@/lib/work";

function task(overrides: Partial<WorkTaskSummary>): Pick<
  WorkTaskSummary,
  "status" | "kind" | "dueDate" | "isImportant" | "createdAt"
> {
  return {
    status: "open",
    kind: "task",
    dueDate: null,
    isImportant: false,
    createdAt: "2026-07-01T10:00:00.000Z",
    ...overrides,
  };
}

describe("workDayKey / workWeekKey", () => {
  it("formats local dates as YYYY-MM-DD", () => {
    expect(workDayKey(new Date(2026, 6, 14))).toBe("2026-07-14");
    expect(workDayKey(new Date(2026, 0, 3))).toBe("2026-01-03");
  });

  it("weekKey is the Monday of the containing week", () => {
    // 2026-07-14 is a Tuesday → Monday 2026-07-13
    expect(workWeekKey(new Date(2026, 6, 14))).toBe("2026-07-13");
    // A Monday maps to itself
    expect(workWeekKey(new Date(2026, 6, 13))).toBe("2026-07-13");
    // A Sunday belongs to the week started the previous Monday
    expect(workWeekKey(new Date(2026, 6, 19))).toBe("2026-07-13");
  });
});

describe("meetingOccursOnDay", () => {
  const tuesday10am = new Date(2026, 6, 14, 10, 0).toISOString();

  it("one-off meetings only occur on their scheduled day", () => {
    const m = { scheduledAt: tuesday10am, recurrence: "none" as const };
    expect(meetingOccursOnDay(m, new Date(2026, 6, 14))).toBe(true);
    expect(meetingOccursOnDay(m, new Date(2026, 6, 15))).toBe(false);
    expect(meetingOccursOnDay(m, new Date(2026, 6, 21))).toBe(false);
  });

  it("weekly meetings recur on the same weekday, never before the start", () => {
    const m = { scheduledAt: tuesday10am, recurrence: "weekly" as const };
    expect(meetingOccursOnDay(m, new Date(2026, 6, 14))).toBe(true);
    expect(meetingOccursOnDay(m, new Date(2026, 6, 21))).toBe(true);
    expect(meetingOccursOnDay(m, new Date(2026, 6, 22))).toBe(false);
    expect(meetingOccursOnDay(m, new Date(2026, 6, 7))).toBe(false); // before start
  });

  it("biweekly meetings skip alternate weeks", () => {
    const m = { scheduledAt: tuesday10am, recurrence: "biweekly" as const };
    expect(meetingOccursOnDay(m, new Date(2026, 6, 21))).toBe(false);
    expect(meetingOccursOnDay(m, new Date(2026, 6, 28))).toBe(true);
  });

  it("daily meetings occur every day from the start", () => {
    const m = { scheduledAt: tuesday10am, recurrence: "daily" as const };
    expect(meetingOccursOnDay(m, new Date(2026, 6, 14))).toBe(true);
    expect(meetingOccursOnDay(m, new Date(2026, 7, 1))).toBe(true);
    expect(meetingOccursOnDay(m, new Date(2026, 6, 13))).toBe(false);
  });

  it("monthly meetings recur on the same day of month", () => {
    const m = { scheduledAt: tuesday10am, recurrence: "monthly" as const };
    expect(meetingOccursOnDay(m, new Date(2026, 7, 14))).toBe(true);
    expect(meetingOccursOnDay(m, new Date(2026, 7, 15))).toBe(false);
  });

  it("unscheduled meetings never occur", () => {
    expect(meetingOccursOnDay({ scheduledAt: null, recurrence: "weekly" }, new Date())).toBe(false);
  });

  it("meetingsOnDay sorts by time of day", () => {
    const early = { scheduledAt: new Date(2026, 6, 14, 9, 0).toISOString(), recurrence: "none" as const };
    const late = { scheduledAt: new Date(2026, 6, 14, 15, 30).toISOString(), recurrence: "weekly" as const };
    const result = meetingsOnDay([late, early], new Date(2026, 6, 14));
    expect(result).toEqual([early, late]);
  });
});

describe("groupTasksForToday", () => {
  const today = new Date(2026, 6, 14);

  it("buckets due/overdue/important into mustDo, prep into prep, waiting separately", () => {
    const dueToday = task({ dueDate: new Date(2026, 6, 14, 12).toISOString() });
    const overdue = task({ dueDate: new Date(2026, 6, 10).toISOString() });
    const important = task({ isImportant: true });
    const future = task({ dueDate: new Date(2026, 6, 30).toISOString() });
    const prep = task({ kind: "prep" });
    const waiting = task({ status: "waiting" });
    const done = task({ status: "done", isImportant: true });

    const grouped = groupTasksForToday(
      [dueToday, overdue, important, future, prep, waiting, done],
      today,
    );
    expect(grouped.mustDo).toEqual([overdue, dueToday, important]);
    expect(grouped.prep).toEqual([prep]);
    expect(grouped.waiting).toEqual([waiting]);
  });

  it("prep tasks that are due today land in mustDo, not prep", () => {
    const duePrep = task({ kind: "prep", dueDate: new Date(2026, 6, 14).toISOString() });
    const grouped = groupTasksForToday([duePrep], today);
    expect(grouped.mustDo).toEqual([duePrep]);
    expect(grouped.prep).toEqual([]);
  });
});

describe("dueLabel", () => {
  const today = new Date(2026, 6, 14);

  it("labels relative days", () => {
    expect(dueLabel(new Date(2026, 6, 14).toISOString(), today)).toBe("Today");
    expect(dueLabel(new Date(2026, 6, 15).toISOString(), today)).toBe("Tomorrow");
    expect(dueLabel(new Date(2026, 6, 13).toISOString(), today)).toBe("Yesterday");
    expect(dueLabel(new Date(2026, 6, 10).toISOString(), today)).toBe("4d overdue");
    expect(dueLabel(new Date(2026, 6, 17).toISOString(), today)).toBe("In 3d");
    expect(dueLabel(null, today)).toBeNull();
  });
});
