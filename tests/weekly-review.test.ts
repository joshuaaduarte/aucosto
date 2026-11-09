import { describe, expect, it } from "vitest";
import {
  cleanPriorityIds,
  elapsedDayCount,
  findWeeklyReviewHabit,
  hubReviewState,
  latestReviewFor,
  parseSavedReview,
  priorityOutcomes,
  weekKey,
  type SavedReview,
  isHabitDueOn,
  nextWeekLabel,
  reviewCompletedTasks,
  reviewHabits,
  reviewHeadline,
  reviewMoney,
  reviewTime,
  reviewWeekFor,
  topShares,
  type ReviewHabit,
} from "@/lib/weekly-review";

// Nov 2026: Mon 2, Sat 7, Sun 8, Mon 9.
const d = (day: number, hour = 12, minute = 0) => new Date(2026, 10, day, hour, minute);

describe("reviewWeekFor", () => {
  it("reviews the week now ending on Saturday and Sunday", () => {
    for (const now of [d(7), d(8, 20)]) {
      const week = reviewWeekFor(now);
      expect(week.isCurrent).toBe(true);
      expect(week.start).toEqual(new Date(2026, 10, 2));
      expect(week.end).toEqual(new Date(2026, 10, 9));
      expect(week.through).toEqual(now);
      expect(week.label).toBe("Nov 2 to Nov 8");
    }
  });

  it("reviews the finished week from Monday to Friday", () => {
    const week = reviewWeekFor(d(9, 13));
    expect(week.isCurrent).toBe(false);
    expect(week.start).toEqual(new Date(2026, 10, 2));
    expect(week.through).toEqual(week.end);
    expect(reviewWeekFor(d(13)).label).toBe("Nov 2 to Nov 8");
  });

  it("labels next week and counts the days that have happened", () => {
    expect(nextWeekLabel(reviewWeekFor(d(8)))).toBe("Nov 9 to Nov 15");
    expect(elapsedDayCount(reviewWeekFor(d(8, 9)))).toBe(7);
    expect(elapsedDayCount(reviewWeekFor(d(7, 9)))).toBe(6);
    expect(elapsedDayCount(reviewWeekFor(d(10)))).toBe(7);
  });
});

describe("topShares", () => {
  it("keeps the largest and folds the rest into Other", () => {
    const totals = new Map([["a", 5], ["b", 9], ["c", 1], ["d", 3], ["e", 2], ["zero", 0]]);
    expect(topShares(totals, 3)).toEqual([
      { name: "b", amount: 9 },
      { name: "a", amount: 5 },
      { name: "d", amount: 3 },
      { name: "Other", amount: 3 },
    ]);
  });
});

describe("reviewTime", () => {
  const week = reviewWeekFor(d(10));

  it("sums finished sessions by category and counts tracked days", () => {
    const review = reviewTime(
      [
        { label: "Deep work", category: "work", startedAt: d(3, 9), endedAt: d(3, 11) },
        { label: "Run", category: "exercise", startedAt: d(4, 7), endedAt: d(4, 7, 45) },
        { label: "Mail", category: null, startedAt: d(4, 12), endedAt: d(4, 12, 30) },
        { label: "Running now", category: "work", startedAt: d(5, 9), endedAt: null },
      ],
      week,
    );
    expect(review.totalMinutes).toBe(195);
    expect(review.daysTracked).toBe(2);
    expect(review.byCategory).toEqual([
      { name: "work", amount: 120 },
      { name: "exercise", amount: 45 },
      { name: "Uncategorized", amount: 30 },
    ]);
  });

  it("only counts the part of a session inside the week", () => {
    const review = reviewTime(
      [{ label: "Late", category: "work", startedAt: d(1, 23), endedAt: new Date(2026, 10, 2, 1) }],
      week,
    );
    expect(review.totalMinutes).toBe(60);
  });
});

describe("reviewHabits", () => {
  const habit = (patch: Partial<ReviewHabit> & { id: string }): ReviewHabit => ({
    title: patch.id,
    cadence: "daily",
    daysOfWeek: null,
    focus: null,
    ...patch,
  });

  it("counts done days against due days for a finished week", () => {
    const review = reviewHabits(
      [habit({ id: "read" }), habit({ id: "review", cadence: "weekly" })],
      [
        { habitId: "read", loggedAt: d(2, 8) },
        { habitId: "read", loggedAt: d(2, 21) },
        { habitId: "read", loggedAt: d(5) },
        { habitId: "read", loggedAt: d(9) },
      ],
      reviewWeekFor(d(10)),
    );
    expect(review.rows).toEqual([
      { id: "read", title: "read", done: 2, due: 7 },
      { id: "review", title: "review", done: 0, due: 1 },
    ]);
    expect(review).toMatchObject({ done: 2, due: 8, focusOnly: false });
  });

  it("uses focus habits when any are marked, and skips 'later' ones otherwise", () => {
    const week = reviewWeekFor(d(10));
    const withFocus = reviewHabits(
      [habit({ id: "a", focus: "focus" }), habit({ id: "b" }), habit({ id: "c", focus: "later" })],
      [],
      week,
    );
    expect(withFocus.rows.map((row) => row.id)).toEqual(["a"]);
    expect(withFocus.focusOnly).toBe(true);
    const noFocus = reviewHabits([habit({ id: "b" }), habit({ id: "c", focus: "later" })], [], week);
    expect(noFocus.rows.map((row) => row.id)).toEqual(["b"]);
  });

  it("only counts days that have happened in the current week", () => {
    const review = reviewHabits([habit({ id: "a" })], [{ habitId: "a", loggedAt: d(7, 8) }], reviewWeekFor(d(7, 9)));
    expect(review.rows[0]).toMatchObject({ done: 1, due: 6 });
  });

  it("follows weekday and custom schedules", () => {
    expect(isHabitDueOn({ cadence: "weekdays", daysOfWeek: null }, d(7))).toBe(false);
    expect(isHabitDueOn({ cadence: "weekdays", daysOfWeek: null }, d(6))).toBe(true);
    const review = reviewHabits([habit({ id: "w", cadence: "weekdays" })], [], reviewWeekFor(d(10)));
    expect(review.rows[0]!.due).toBe(5);
  });
});

describe("reviewCompletedTasks", () => {
  it("lists tasks finished inside the week, newest first", () => {
    const review = reviewCompletedTasks(
      [
        { id: "1", title: "Old", completedAt: d(1) },
        { id: "2", title: "Monday", completedAt: d(2) },
        { id: "3", title: "Friday", completedAt: d(6) },
        { id: "4", title: "Open", completedAt: null },
      ],
      reviewWeekFor(d(10)),
    );
    expect(review).toEqual({ count: 2, titles: ["Friday", "Monday"] });
  });
});

describe("reviewMoney", () => {
  it("counts real spending only, by category", () => {
    const review = reviewMoney(
      [
        { amount: -4500, description: "Trader Joe's", category: "Groceries", date: d(3) },
        { amount: -1200, description: "Lunch", category: "Dining", date: d(4) },
        { amount: -800, description: "Coffee", category: "Dining", date: d(5) },
        { amount: 250000, description: "Payroll", category: "Income", date: d(6) },
        { amount: -9000, description: "Outside the week", category: "Groceries", date: d(9) },
      ],
      reviewWeekFor(d(10)),
    );
    expect(review.spentCents).toBe(6500);
    expect(review.entryCount).toBe(3);
    expect(review.byCategory).toEqual([
      { name: "Groceries", amount: 4500 },
      { name: "Dining", amount: 2000 },
    ]);
  });
});

describe("reviewHeadline", () => {
  const week = reviewWeekFor(d(10));
  const empty = { totalMinutes: 0, byCategory: [], daysTracked: 0 };
  const noHabits = { rows: [], done: 0, due: 0, focusOnly: false };

  it("is gentle about an empty week", () => {
    expect(reviewHeadline({ week, daysUsed: 0, time: empty, habits: noHabits, tasks: { count: 0 } })).toMatch(
      /quiet week/,
    );
  });

  it("joins what happened into one sentence", () => {
    expect(
      reviewHeadline({
        week,
        daysUsed: 4,
        time: empty,
        habits: { ...noHabits, done: 9, due: 21 },
        tasks: { count: 1 },
      }),
    ).toBe("You used Aucosto on 4 of 7 days, finished 1 task and kept 9 of 21 habit check-ins.");
  });
});

describe("findWeeklyReviewHabit", () => {
  it("finds the review habit by name, emoji or not, skipping archived ones", () => {
    const habits = [
      { id: "1", title: "Read", archivedAt: null },
      { id: "2", title: "🗺️ Weekly review", archivedAt: null },
    ];
    expect(findWeeklyReviewHabit(habits)?.id).toBe("2");
    expect(findWeeklyReviewHabit([{ id: "3", title: "Weekly Review", archivedAt: new Date() }])).toBeNull();
  });
});

describe("cleanPriorityIds", () => {
  it("keeps open, unique ids and at most three", () => {
    const open = new Set(["a", "b", "c", "d"]);
    expect(cleanPriorityIds(["a", "x", "a", "b", "c", "d"], open)).toEqual(["a", "b", "c"]);
    expect(cleanPriorityIds([], open)).toEqual([]);
  });
});

describe("saved reviews", () => {
  const saved = (at: Date, reviewedWeek: string, forWeek: string, ids = ["a"]): SavedReview => ({
    at,
    reviewedWeek,
    forWeek,
    priorities: ids.map((id) => ({ id, title: `Task ${id}` })),
    note: null,
  });

  it("keys weeks by their Monday", () => {
    expect(weekKey(d(8, 23))).toBe("2026-11-02");
    expect(weekKey(d(9, 0, 5))).toBe("2026-11-09");
  });

  it("parses meta it wrote and rejects anything else", () => {
    const at = d(8);
    expect(
      parseSavedReview(
        {
          reviewedWeek: "2026-11-02",
          forWeek: "2026-11-09",
          priorities: [{ id: "a", title: "A" }, { id: 4 }, "x", { id: "b", title: "B" }],
          note: "  ",
        },
        at,
      ),
    ).toEqual({
      at,
      reviewedWeek: "2026-11-02",
      forWeek: "2026-11-09",
      priorities: [
        { id: "a", title: "A" },
        { id: "b", title: "B" },
      ],
      note: null,
    });
    expect(parseSavedReview(null, at)).toBeNull();
    expect(parseSavedReview({ reviewedWeek: "Nov 2", forWeek: "2026-11-09" }, at)).toBeNull();
  });

  it("takes the newest save for a week", () => {
    const first = saved(d(7), "2026-11-02", "2026-11-09", ["a"]);
    const second = saved(d(8), "2026-11-02", "2026-11-09", ["b"]);
    expect(latestReviewFor([second, first], "reviewedWeek", "2026-11-02")).toBe(second);
    expect(latestReviewFor([first], "forWeek", "2026-11-16")).toBeNull();
  });

  it("scores last week's picks against the tasks as they are now", () => {
    const review = saved(d(1), "2026-10-26", "2026-11-02", ["a", "b", "gone"]);
    expect(
      priorityOutcomes(review, [
        { id: "a", title: "A renamed", status: "done" },
        { id: "b", title: "B", status: "ready" },
      ]),
    ).toEqual([
      { id: "a", title: "A renamed", done: true, missing: false },
      { id: "b", title: "B", done: false, missing: false },
      { id: "gone", title: "Task gone", done: false, missing: true },
    ]);
  });

  it("nudges Saturday to Monday until the week is reviewed", () => {
    expect(hubReviewState(d(7), [])).toEqual({ kind: "nudge", label: "Nov 2 to Nov 8" });
    expect(hubReviewState(d(9), [])).toEqual({ kind: "nudge", label: "Nov 2 to Nov 8" });
    expect(hubReviewState(d(10), [])).toBeNull();
    expect(hubReviewState(d(6), [])).toBeNull();
  });

  it("shows next week's picks after a weekend review, then this week's", () => {
    const review = saved(d(8), "2026-11-02", "2026-11-09");
    expect(hubReviewState(d(8, 21), [review])).toMatchObject({
      kind: "priorities",
      heading: "Next week's three",
    });
    expect(hubReviewState(d(11), [review])).toMatchObject({
      kind: "priorities",
      heading: "This week's three",
    });
    // The next weekend asks for the next review instead.
    expect(hubReviewState(d(14), [review])).toEqual({ kind: "nudge", label: "Nov 9 to Nov 15" });
  });

  it("stays quiet after a review saved with no picks", () => {
    expect(hubReviewState(d(8), [saved(d(8), "2026-11-02", "2026-11-09", [])])).toBeNull();
  });
});

describe("reviewHabits and new habits", () => {
  const week = reviewWeekFor(d(9));
  const base = { cadence: "daily", daysOfWeek: null, focus: null } as const;

  it("skips days before a habit existed, and habits made after the week", () => {
    const review = reviewHabits(
      [
        { ...base, id: "mid", title: "Started Thursday", createdAt: d(5, 9) },
        { ...base, id: "late", title: "Made today", createdAt: d(9, 9) },
      ],
      [{ habitId: "mid", loggedAt: d(6, 8) }],
      week,
    );
    expect(review.rows).toEqual([{ id: "mid", title: "Started Thursday", done: 1, due: 4 }]);
  });
});
