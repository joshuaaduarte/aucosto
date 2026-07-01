import { describe, expect, it } from "vitest";
import {
  computeSignals,
  computeBriefing,
  resolveTimezone,
  JOURNAL_PROMPTS,
  type SignalFacts,
} from "@/lib/assistant-signals";

// ── base fixtures ──────────────────────────────────────────────────────────

function makeFacts(overrides: Partial<SignalFacts> = {}): SignalFacts {
  return {
    today: {
      wokeUpAt: null,
      calendar: {
        items: [],
        totalScheduledMinutes: 0,
      },
      time: {
        runningTimer: null,
        totalTrackedMinutes: 0,
      },
      tasks: {
        open: [],
      },
      habits: {
        items: [],
      },
      projects: [],
      ...overrides.today,
    },
    yesterday: {
      habitsCompleted: 3,
      habitsTotal: 3,
      ...overrides.yesterday,
    },
    finance: {
      visible: false,
      ...overrides.finance,
    },
  };
}

// makeBriefingFacts builds a minimal facts object that satisfies the extended
// BriefingFacts type (which requires wokeUpAt, calendar.nextEvent, time.runningTimer).
function makeBriefingFacts(
  overrides: {
    wokeUpAt?: string | null;
    nextEvent?: { title: string } | null;
    runningTimer?: { category: string | null; elapsedMinutes?: number } | null;
    tasks?: { open: { title: string; lane: string }[] };
    habits?: { items: { name: string; done: boolean; streak: number; scheduledToday: boolean }[] };
  } = {},
) {
  return {
    today: {
      wokeUpAt: overrides.wokeUpAt ?? null,
      calendar: { nextEvent: overrides.nextEvent ?? null },
      time: { runningTimer: overrides.runningTimer ?? null },
      tasks: overrides.tasks ?? { open: [] },
      habits: overrides.habits ?? { items: [] },
    },
  };
}

// ── computeSignals — hasRunningTimer ───────────────────────────────────────

describe("computeSignals — hasRunningTimer", () => {
  it("is false when no timer", () => {
    const s = computeSignals(makeFacts(), 9 * 60);
    expect(s.hasRunningTimer).toBe(false);
  });

  it("is true when a timer is present", () => {
    const facts = makeFacts();
    facts.today.time.runningTimer = { title: "Focus" };
    const s = computeSignals(facts, 10 * 60);
    expect(s.hasRunningTimer).toBe(true);
  });
});

// ── computeSignals — lateStart ─────────────────────────────────────────────

describe("computeSignals — lateStart", () => {
  it("is false when wokeUpAt is null", () => {
    const s = computeSignals(makeFacts(), 10 * 60);
    expect(s.lateStart).toBe(false);
  });

  it("is false when woke at 6:00 (exactly on target)", () => {
    const facts = makeFacts();
    facts.today.wokeUpAt = "06:00";
    const s = computeSignals(facts, 10 * 60);
    expect(s.lateStart).toBe(false);
  });

  it("is false when woke at 6:45 (45 min after target, boundary)", () => {
    const facts = makeFacts();
    facts.today.wokeUpAt = "06:45";
    const s = computeSignals(facts, 10 * 60);
    expect(s.lateStart).toBe(false);
  });

  it("is true when woke after 6:45 AM (e.g. 7:00)", () => {
    const facts = makeFacts();
    facts.today.wokeUpAt = "07:00";
    const s = computeSignals(facts, 10 * 60);
    expect(s.lateStart).toBe(true);
  });

  it("is true when woke at 8:30", () => {
    const facts = makeFacts();
    facts.today.wokeUpAt = "08:30";
    const s = computeSignals(facts, 11 * 60);
    expect(s.lateStart).toBe(true);
  });
});

// ── computeSignals — openDay ───────────────────────────────────────────────

describe("computeSignals — openDay", () => {
  it("is true when calendar is empty", () => {
    const s = computeSignals(makeFacts(), 10 * 60);
    expect(s.openDay).toBe(true);
  });

  it("is true when all events are done", () => {
    const facts = makeFacts();
    facts.today.calendar.items = [
      { done: true, durationMinutes: 60, startTime: "14:00" },
    ];
    const s = computeSignals(facts, 10 * 60);
    expect(s.openDay).toBe(true);
  });

  it("is true when future events are <=30min", () => {
    const facts = makeFacts();
    facts.today.calendar.items = [
      { done: false, durationMinutes: 30, startTime: "14:00" },
    ];
    const s = computeSignals(facts, 10 * 60);
    expect(s.openDay).toBe(true);
  });

  it("is false when there is a future undone event >30min", () => {
    const facts = makeFacts();
    facts.today.calendar.items = [
      { done: false, durationMinutes: 60, startTime: "14:00" },
    ];
    const s = computeSignals(facts, 10 * 60); // 10am, event at 14:00
    expect(s.openDay).toBe(false);
  });

  it("is true when a long event is in the past (starts before now)", () => {
    const facts = makeFacts();
    facts.today.calendar.items = [
      { done: false, durationMinutes: 60, startTime: "08:00" },
    ];
    const s = computeSignals(facts, 10 * 60); // 10am, event started at 8am
    expect(s.openDay).toBe(true);
  });
});

// ── computeSignals — needsPlan ─────────────────────────────────────────────

describe("computeSignals — needsPlan", () => {
  it("is true when openDay and no tasks at all", () => {
    const s = computeSignals(makeFacts(), 10 * 60);
    expect(s.openDay).toBe(true);
    expect(s.needsPlan).toBe(true);
  });

  it("is true when openDay and tasks exist but none in today lane", () => {
    const facts = makeFacts();
    facts.today.tasks.open = [{ title: "Something", lane: "later" }];
    const s = computeSignals(facts, 10 * 60);
    expect(s.needsPlan).toBe(true);
  });

  it("is false when openDay but has today-lane task", () => {
    const facts = makeFacts();
    facts.today.tasks.open = [{ title: "Important task", lane: "today" }];
    const s = computeSignals(facts, 10 * 60);
    expect(s.needsPlan).toBe(false);
  });

  it("is false when not openDay even with no today tasks", () => {
    const facts = makeFacts();
    facts.today.calendar.items = [
      { done: false, durationMinutes: 90, startTime: "14:00" },
    ];
    facts.today.calendar.totalScheduledMinutes = 90;
    const s = computeSignals(facts, 10 * 60);
    expect(s.openDay).toBe(false);
    expect(s.needsPlan).toBe(false);
  });
});

// ── computeSignals — momentum ──────────────────────────────────────────────

describe("computeSignals — momentum", () => {
  it("is low when nothing tracked and past 10am", () => {
    const s = computeSignals(makeFacts(), 10 * 60);
    expect(s.momentum).toBe("low");
  });

  it("is good when tracked time exceeds 1.2x target", () => {
    const facts = makeFacts();
    facts.today.time.totalTrackedMinutes = 400; // very high for 10am
    const s = computeSignals(facts, 10 * 60); // target = 300, 1.2x = 360
    expect(s.momentum).toBe("good");
  });

  it("is medium when tracked is between 0.6x and 1.2x target", () => {
    const facts = makeFacts();
    facts.today.time.totalTrackedMinutes = 200; // 10am target=300, 0.6x=180, 1.2x=360
    const s = computeSignals(facts, 10 * 60);
    expect(s.momentum).toBe("medium");
  });

  it("is low before 8am regardless (targetByHour <= 0 for early hours)", () => {
    // At 0am, targetByHour=0, guard prevents false "good"
    const s = computeSignals(makeFacts(), 0);
    expect(s.momentum).toBe("low");
  });
});

// ── computeSignals — habitRecovery ─────────────────────────────────────────

describe("computeSignals — habitRecovery", () => {
  it("is false when yesterday habits were all done", () => {
    const facts = makeFacts({
      yesterday: { habitsCompleted: 3, habitsTotal: 3 },
    });
    const s = computeSignals(facts, 10 * 60);
    expect(s.habitRecovery).toBe(false);
  });

  it("is true when yesterday completion < 50%", () => {
    const facts = makeFacts({
      yesterday: { habitsCompleted: 1, habitsTotal: 4 },
    });
    const s = computeSignals(facts, 10 * 60);
    expect(s.habitRecovery).toBe(true);
  });

  it("is false when yesterday was exactly 50%", () => {
    const facts = makeFacts({
      yesterday: { habitsCompleted: 2, habitsTotal: 4 },
    });
    const s = computeSignals(facts, 10 * 60);
    expect(s.habitRecovery).toBe(false);
  });

  it("is true when a habit has streak=0 and is scheduled today (just broke)", () => {
    const facts = makeFacts({
      yesterday: { habitsCompleted: 3, habitsTotal: 3 },
    });
    facts.today.habits.items = [
      { name: "Run", done: false, streak: 0, scheduledToday: true },
    ];
    const s = computeSignals(facts, 10 * 60);
    expect(s.habitRecovery).toBe(true);
  });

  it("is false when streak=0 but habit not scheduled today", () => {
    const facts = makeFacts({
      yesterday: { habitsCompleted: 3, habitsTotal: 3 },
    });
    facts.today.habits.items = [
      { name: "Run", done: false, streak: 0, scheduledToday: false },
    ];
    const s = computeSignals(facts, 10 * 60);
    expect(s.habitRecovery).toBe(false);
  });
});

// ── computeSignals — stalledProjects ───────────────────────────────────────

describe("computeSignals — stalledProjects", () => {
  it("returns empty when no projects", () => {
    const s = computeSignals(makeFacts(), 10 * 60);
    expect(s.stalledProjects).toEqual([]);
  });

  it("includes stalled projects with open tasks", () => {
    const facts = makeFacts();
    facts.today.projects = [
      { name: "Alpha", momentum: "stalled", openTaskCount: 2 },
      { name: "Beta", momentum: "strong", openTaskCount: 1 },
    ];
    const s = computeSignals(facts, 10 * 60);
    expect(s.stalledProjects).toEqual(["Alpha"]);
  });

  it("excludes stalled projects with no open tasks", () => {
    const facts = makeFacts();
    facts.today.projects = [
      { name: "Done", momentum: "stalled", openTaskCount: 0 },
    ];
    const s = computeSignals(facts, 10 * 60);
    expect(s.stalledProjects).toEqual([]);
  });
});

// ── computeSignals — financeNeedsAttention ─────────────────────────────────

describe("computeSignals — financeNeedsAttention", () => {
  it("is always false (deferred)", () => {
    const facts = makeFacts({ finance: { visible: false } });
    const s = computeSignals(facts, 10 * 60);
    expect(s.financeNeedsAttention).toBe(false);
  });

  it("is false even when finance is visible (TODO deferred)", () => {
    const facts = makeFacts({ finance: { visible: true } });
    const s = computeSignals(facts, 10 * 60);
    expect(s.financeNeedsAttention).toBe(false);
  });
});

// ── computeSignals — driftRisk ─────────────────────────────────────────────

describe("computeSignals — driftRisk", () => {
  it("is low when no risk factors", () => {
    // Has a future event (not openDay), has today task, no recovery needed, timer
    const facts = makeFacts();
    facts.today.calendar.items = [
      { done: false, durationMinutes: 90, startTime: "14:00" },
    ];
    facts.today.calendar.totalScheduledMinutes = 90;
    facts.today.tasks.open = [{ title: "Task", lane: "today" }];
    facts.today.time.runningTimer = { title: "Focus" };
    facts.today.time.totalTrackedMinutes = 300;
    const s = computeSignals(facts, 10 * 60);
    expect(s.driftRisk).toBe("low");
  });

  it("is high when multiple risk factors active", () => {
    // openDay (+1), needsPlan (+1), momentum=low at 11am (+1), habitRecovery (+1), no timer at 11am (+1) => 5
    const facts = makeFacts({
      yesterday: { habitsCompleted: 0, habitsTotal: 4 },
    });
    const s = computeSignals(facts, 11 * 60);
    expect(s.driftRisk).toBe("high");
  });

  it("is medium with 2-3 risk factors", () => {
    const facts = makeFacts();
    // At 8am: openDay(1), needsPlan(1), momentum=low but hour<10 so no(0),
    // habitRecovery=false(0), no timer at 8am(1) = 3 = medium
    const s2 = computeSignals(facts, 8 * 60);
    expect(s2.driftRisk).toBe("medium");
  });
});

// ── computeBriefing — currentState (compound slug) ─────────────────────────

describe("computeBriefing — currentState", () => {
  function makeSignals(overrides: Partial<ReturnType<typeof computeSignals>> = {}) {
    return {
      hasRunningTimer: false,
      lateStart: false,
      openDay: true,
      crowdedDay: false,
      needsPlan: false,
      momentum: "low" as const,
      driftRisk: "low" as const,
      habitRecovery: false,
      stalledProjects: [],
      projectsMissingNextAction: [],
      financeNeedsAttention: false,
      unfinishedPriority: false,
      longRunningTimer: false,
      possiblyStaleTimer: false,
      ...overrides,
    };
  }

  it("contains 'timer_active' when hasRunningTimer with no category", () => {
    const facts = makeBriefingFacts({ runningTimer: { category: null } });
    const b = computeBriefing(facts, makeSignals({ hasRunningTimer: true }), 10, 1);
    expect(b.currentState).toContain("timer_active");
  });

  it("contains 'timer_work' when running timer has category 'work'", () => {
    const facts = makeBriefingFacts({ runningTimer: { category: "work" } });
    const b = computeBriefing(facts, makeSignals({ hasRunningTimer: true }), 10, 1);
    expect(b.currentState).toContain("timer_work");
  });

  it("contains timer category slug (lowercase, no spaces)", () => {
    const facts = makeBriefingFacts({ runningTimer: { category: "Deep Work" } });
    const b = computeBriefing(facts, makeSignals({ hasRunningTimer: true }), 10, 1);
    expect(b.currentState).toContain("timer_deepwork");
  });

  it("contains 'morning' before noon", () => {
    const b = computeBriefing(makeBriefingFacts(), makeSignals(), 9, 1);
    expect(b.currentState).toContain("morning");
  });

  it("contains 'midday' for hours 12–16", () => {
    const b = computeBriefing(makeBriefingFacts(), makeSignals({ openDay: false }), 14, 1);
    expect(b.currentState).toContain("midday");
  });

  it("contains 'evening' at or after 17:00", () => {
    const b = computeBriefing(makeBriefingFacts(), makeSignals(), 19, 1);
    expect(b.currentState).toContain("evening");
  });

  it("contains 'early' before 6am", () => {
    const b = computeBriefing(makeBriefingFacts(), makeSignals(), 5, 1);
    expect(b.currentState).toContain("early");
  });

  it("contains 'open' when openDay and not crowded", () => {
    const b = computeBriefing(makeBriefingFacts(), makeSignals({ openDay: true }), 10, 1);
    expect(b.currentState).toContain("open");
  });

  it("contains 'crowded' when crowdedDay", () => {
    const b = computeBriefing(makeBriefingFacts(), makeSignals({ crowdedDay: true, openDay: false }), 14, 1);
    expect(b.currentState).toContain("crowded");
  });

  it("contains 'normal' when not open and not crowded", () => {
    const b = computeBriefing(makeBriefingFacts(), makeSignals({ openDay: false }), 14, 1);
    expect(b.currentState).toContain("normal");
  });

  it("contains 'needs_plan' when needsPlan", () => {
    const b = computeBriefing(makeBriefingFacts(), makeSignals({ needsPlan: true }), 9, 1);
    expect(b.currentState).toContain("needs_plan");
  });

  it("stays within 60 chars", () => {
    const facts = makeBriefingFacts({ runningTimer: { category: "verylongcategorynamethatshouldbetruncated" } });
    const b = computeBriefing(facts, makeSignals({ hasRunningTimer: true, needsPlan: true }), 10, 1);
    expect(b.currentState.length).toBeLessThanOrEqual(60);
  });
});

// ── computeBriefing — topSignals ordering and cap ─────────────────────────

describe("computeBriefing — topSignals ordering and cap", () => {
  it("includes unfinishedPriority first if active", () => {
    const facts = makeBriefingFacts({
      tasks: { open: [{ title: "T1", lane: "today" }] },
    });
    const signals = computeSignals(
      {
        ...makeFacts(),
        today: { ...makeFacts().today, tasks: { open: [{ title: "T1", lane: "today" }] } },
      },
      10 * 60,
    );
    const b = computeBriefing(facts, signals, 10, 1);
    expect(b.topSignals[0]).toBe("unfinishedPriority");
  });

  it("caps at 4 signals", () => {
    const s = {
      hasRunningTimer: false,
      lateStart: true,
      openDay: true,
      crowdedDay: true,
      needsPlan: true,
      momentum: "low" as const,
      driftRisk: "high" as const,
      habitRecovery: true,
      stalledProjects: ["Alpha"],
      projectsMissingNextAction: [],
      financeNeedsAttention: false,
      unfinishedPriority: true,
      longRunningTimer: false,
      possiblyStaleTimer: false,
    };
    const b = computeBriefing(makeBriefingFacts(), s, 12, 1);
    expect(b.topSignals.length).toBeLessThanOrEqual(4);
  });
});

// ── computeBriefing — suggestedFocus ──────────────────────────────────────

describe("computeBriefing — suggestedFocus", () => {
  it("always has at least 2 items", () => {
    const b = computeBriefing(
      makeBriefingFacts(),
      {
        hasRunningTimer: false,
        lateStart: false,
        openDay: false,
        crowdedDay: false,
        needsPlan: false,
        momentum: "medium" as const,
        driftRisk: "low" as const,
        habitRecovery: false,
        stalledProjects: [],
        projectsMissingNextAction: [],
        financeNeedsAttention: false,
        unfinishedPriority: false,
        longRunningTimer: false,
        possiblyStaleTimer: false,
      },
      12,
      1,
    );
    expect(b.suggestedFocus.length).toBeGreaterThanOrEqual(2);
  });

  it("fills stalled project name into template", () => {
    const s = {
      hasRunningTimer: false,
      lateStart: false,
      openDay: false,
      crowdedDay: false,
      needsPlan: false,
      momentum: "low" as const,
      driftRisk: "low" as const,
      habitRecovery: false,
      stalledProjects: ["MyProject"],
      projectsMissingNextAction: [],
      financeNeedsAttention: false,
      unfinishedPriority: false,
      longRunningTimer: false,
      possiblyStaleTimer: false,
    };
    const b = computeBriefing(makeBriefingFacts(), s, 12, 1);
    const hasFilled = b.suggestedFocus.some((f) => f.includes("MyProject"));
    expect(hasFilled).toBe(true);
  });
});

// ── computeBriefing — journalPrompt ───────────────────────────────────────

describe("computeBriefing — journalPrompt", () => {
  it("picks avoidance prompt on high drift risk", () => {
    const s = {
      hasRunningTimer: false,
      lateStart: false,
      openDay: true,
      crowdedDay: false,
      needsPlan: false,
      momentum: "low" as const,
      driftRisk: "high" as const,
      habitRecovery: false,
      stalledProjects: [],
      projectsMissingNextAction: [],
      financeNeedsAttention: false,
      unfinishedPriority: false,
      longRunningTimer: false,
      possiblyStaleTimer: false,
    };
    const b = computeBriefing(makeBriefingFacts(), s, 12, 3);
    expect(b.morningMessageInputs.journalPromptSeed).toBe(JOURNAL_PROMPTS[3]);
  });

  it("picks intentional-use prompt on needsPlan", () => {
    const s = {
      hasRunningTimer: false,
      lateStart: false,
      openDay: true,
      crowdedDay: false,
      needsPlan: true,
      momentum: "low" as const,
      driftRisk: "low" as const,
      habitRecovery: false,
      stalledProjects: [],
      projectsMissingNextAction: [],
      financeNeedsAttention: false,
      unfinishedPriority: false,
      longRunningTimer: false,
      possiblyStaleTimer: false,
    };
    const b = computeBriefing(makeBriefingFacts(), s, 12, 3);
    expect(b.morningMessageInputs.journalPromptSeed).toBe(JOURNAL_PROMPTS[0]);
  });

  it("cycles by day-of-week otherwise", () => {
    const s = {
      hasRunningTimer: false,
      lateStart: false,
      openDay: false,
      crowdedDay: false,
      needsPlan: false,
      momentum: "medium" as const,
      driftRisk: "low" as const,
      habitRecovery: false,
      stalledProjects: [],
      projectsMissingNextAction: [],
      financeNeedsAttention: false,
      unfinishedPriority: false,
      longRunningTimer: false,
      possiblyStaleTimer: false,
    };
    const b = computeBriefing(makeBriefingFacts(), s, 12, 2);
    expect(b.morningMessageInputs.journalPromptSeed).toBe(
      JOURNAL_PROMPTS[2 % JOURNAL_PROMPTS.length],
    );
  });
});

// ── computeBriefing — contextNotes ────────────────────────────────────────

describe("computeBriefing — contextNotes", () => {
  function makeSignals(overrides: Partial<ReturnType<typeof computeSignals>> = {}) {
    return {
      hasRunningTimer: false,
      lateStart: false,
      openDay: false,
      crowdedDay: false,
      needsPlan: false,
      momentum: "medium" as const,
      driftRisk: "low" as const,
      habitRecovery: false,
      stalledProjects: [],
      projectsMissingNextAction: [],
      financeNeedsAttention: false,
      unfinishedPriority: false,
      longRunningTimer: false,
      possiblyStaleTimer: false,
      ...overrides,
    };
  }

  it("is empty when no notable conditions", () => {
    const b = computeBriefing(makeBriefingFacts(), makeSignals(), 12, 1);
    expect(b.contextNotes).toEqual([]);
  });

  it("adds 0-tasks note when needsPlan and openCount === 0", () => {
    const facts = makeBriefingFacts({ tasks: { open: [] } });
    const b = computeBriefing(facts, makeSignals({ needsPlan: true }), 12, 1);
    expect(b.contextNotes).toContain("0 open tasks — day needs an explicit intention");
  });

  it("adds today-lane note when needsPlan but tasks exist outside today lane", () => {
    const facts = makeBriefingFacts({
      tasks: { open: [{ title: "Something", lane: "later" }] },
    });
    const b = computeBriefing(facts, makeSignals({ needsPlan: true }), 12, 1);
    expect(b.contextNotes).toContain(
      "no tasks in today lane — nothing prioritized yet",
    );
  });

  it("adds no-events note when openDay and nextEvent is null", () => {
    const facts = makeBriefingFacts({ nextEvent: null });
    const b = computeBriefing(facts, makeSignals({ openDay: true }), 12, 1);
    expect(b.contextNotes).toContain("no upcoming calendar events");
  });

  it("does not add no-events note when nextEvent is present", () => {
    const facts = makeBriefingFacts({ nextEvent: { title: "Meeting" } });
    const b = computeBriefing(facts, makeSignals({ openDay: true }), 12, 1);
    expect(b.contextNotes).not.toContain("no upcoming calendar events");
  });

  it("adds late-start note including wake time", () => {
    const facts = makeBriefingFacts({ wokeUpAt: "07:30" });
    const b = computeBriefing(facts, makeSignals({ lateStart: true }), 12, 1);
    const note = b.contextNotes.find((n) => n.startsWith("late start"));
    expect(note).toBeDefined();
    expect(note).toContain("07:30");
  });

  it("adds low-momentum note at or after 10am", () => {
    const b = computeBriefing(makeBriefingFacts(), makeSignals({ momentum: "low" }), 10, 1);
    expect(b.contextNotes).toContain("low tracked time for this time of day");
  });

  it("does not add low-momentum note before 10am", () => {
    const b = computeBriefing(makeBriefingFacts(), makeSignals({ momentum: "low" }), 9, 1);
    expect(b.contextNotes).not.toContain("low tracked time for this time of day");
  });
});

// ── computeBriefing — structured prioritySeeds ────────────────────────────

describe("computeBriefing — structured prioritySeeds", () => {
  it("produces seeds with label, reason, and source fields", () => {
    const facts = makeBriefingFacts({
      tasks: { open: [{ title: "Ship feature", lane: "today" }] },
    });
    const signals = {
      hasRunningTimer: false,
      lateStart: false,
      openDay: false,
      crowdedDay: false,
      needsPlan: false,
      momentum: "medium" as const,
      driftRisk: "low" as const,
      habitRecovery: false,
      stalledProjects: [],
      projectsMissingNextAction: [],
      financeNeedsAttention: false,
      unfinishedPriority: true,
      longRunningTimer: false,
      possiblyStaleTimer: false,
    };
    const b = computeBriefing(facts, signals, 10, 1);
    expect(b.morningMessageInputs.prioritySeeds.length).toBeGreaterThan(0);
    const seed = b.morningMessageInputs.prioritySeeds[0]!;
    expect(seed).toHaveProperty("label");
    expect(seed).toHaveProperty("reason");
    expect(seed).toHaveProperty("source");
    expect(seed.label).toBe("Ship feature");
    expect(seed.reason).toBe("task in today lane");
    expect(seed.source).toBe("facts.today.tasks");
  });

  it("assigns 'stalled project' reason for stalled projects", () => {
    const signals = {
      hasRunningTimer: false,
      lateStart: false,
      openDay: false,
      crowdedDay: false,
      needsPlan: false,
      momentum: "medium" as const,
      driftRisk: "low" as const,
      habitRecovery: false,
      stalledProjects: ["My Project"],
      projectsMissingNextAction: [],
      financeNeedsAttention: false,
      unfinishedPriority: false,
      longRunningTimer: false,
      possiblyStaleTimer: false,
    };
    const b = computeBriefing(makeBriefingFacts(), signals, 10, 1);
    const seed = b.morningMessageInputs.prioritySeeds[0];
    expect(seed?.reason).toBe("stalled project");
    expect(seed?.source).toBe("signals.stalledProjects");
  });

  it("prioritySeedLabels matches labels from prioritySeeds", () => {
    const facts = makeBriefingFacts({
      tasks: { open: [{ title: "Task A", lane: "today" }] },
    });
    const signals = {
      hasRunningTimer: false,
      lateStart: false,
      openDay: false,
      crowdedDay: false,
      needsPlan: false,
      momentum: "medium" as const,
      driftRisk: "low" as const,
      habitRecovery: false,
      stalledProjects: [],
      projectsMissingNextAction: [],
      financeNeedsAttention: false,
      unfinishedPriority: true,
      longRunningTimer: false,
      possiblyStaleTimer: false,
    };
    const b = computeBriefing(facts, signals, 10, 1);
    const expected = b.morningMessageInputs.prioritySeeds.map((s) => s.label);
    expect(b.morningMessageInputs.prioritySeedLabels).toEqual(expected);
  });

  it("assigns 'habit recovery' reason when streak is 0", () => {
    const facts = makeBriefingFacts({
      habits: {
        items: [{ name: "Meditate", done: false, streak: 0, scheduledToday: true }],
      },
    });
    const signals = {
      hasRunningTimer: false,
      lateStart: false,
      openDay: false,
      crowdedDay: false,
      needsPlan: false,
      momentum: "medium" as const,
      driftRisk: "low" as const,
      habitRecovery: false,
      stalledProjects: [],
      projectsMissingNextAction: [],
      financeNeedsAttention: false,
      unfinishedPriority: false,
      longRunningTimer: false,
      possiblyStaleTimer: false,
    };
    const b = computeBriefing(facts, signals, 10, 1);
    const habitSeed = b.morningMessageInputs.prioritySeeds.find(
      (s) => s.label === "Meditate",
    );
    expect(habitSeed?.reason).toBe("habit recovery");
  });
});

// ── resolveTimezone ────────────────────────────────────────────────────────

describe("resolveTimezone", () => {
  it("returns America/Los_Angeles when process.env.TZ is set to it", () => {
    const orig = process.env.TZ;
    process.env.TZ = "America/Los_Angeles";
    expect(resolveTimezone()).toBe("America/Los_Angeles");
    process.env.TZ = orig;
  });

  it("falls back to America/Los_Angeles when env vars are absent", () => {
    const origTZ = process.env.TZ;
    const origAPP = process.env.APP_TIMEZONE;
    delete process.env.TZ;
    delete process.env.APP_TIMEZONE;
    expect(resolveTimezone()).toBe("America/Los_Angeles");
    process.env.TZ = origTZ;
    if (origAPP !== undefined) process.env.APP_TIMEZONE = origAPP;
  });

  it("prefers APP_TIMEZONE as override when TZ is absent", () => {
    const origTZ = process.env.TZ;
    const origAPP = process.env.APP_TIMEZONE;
    delete process.env.TZ;
    process.env.APP_TIMEZONE = "America/New_York";
    expect(resolveTimezone()).toBe("America/New_York");
    process.env.TZ = origTZ;
    if (origAPP !== undefined) process.env.APP_TIMEZONE = origAPP;
    else delete process.env.APP_TIMEZONE;
  });
});

// ── computeSignals — stale/long-running timer ──────────────────────────────

describe("computeSignals — possiblyStaleTimer and longRunningTimer", () => {
  it("commute 100 min: possiblyStaleTimer=true, longRunningTimer=true", () => {
    const facts = makeFacts();
    facts.today.time.runningTimer = {
      title: "Commute",
      category: "commute",
      elapsedMinutes: 100,
    };
    const s = computeSignals(facts, 9 * 60);
    expect(s.possiblyStaleTimer).toBe(true); // 100 >= 90 (commute threshold)
    expect(s.longRunningTimer).toBe(true);   // possiblyStale => longRunning
  });

  it("commute 60 min: neither flag", () => {
    const facts = makeFacts();
    facts.today.time.runningTimer = {
      title: "Commute",
      category: "commute",
      elapsedMinutes: 60,
    };
    const s = computeSignals(facts, 9 * 60);
    expect(s.possiblyStaleTimer).toBe(false); // 60 < 90
    expect(s.longRunningTimer).toBe(false);   // 60 < 120
  });

  it("deep work 150 min: longRunningTimer=true, possiblyStaleTimer=false", () => {
    const facts = makeFacts();
    facts.today.time.runningTimer = {
      title: "Deep work",
      category: "deep work",
      elapsedMinutes: 150,
    };
    const s = computeSignals(facts, 10 * 60);
    expect(s.longRunningTimer).toBe(true);    // 150 >= 120
    expect(s.possiblyStaleTimer).toBe(false); // 150 < 240 (default threshold)
  });

  it("no running timer: both false", () => {
    const s = computeSignals(makeFacts(), 10 * 60);
    expect(s.possiblyStaleTimer).toBe(false);
    expect(s.longRunningTimer).toBe(false);
  });
});

// ── computeBriefing — stale timer watchouts and contextNotes ───────────────

describe("computeBriefing — stale timer", () => {
  function makeBaseSignals(overrides: Partial<ReturnType<typeof computeSignals>> = {}) {
    return {
      hasRunningTimer: true,
      lateStart: false,
      openDay: false,
      crowdedDay: false,
      needsPlan: false,
      momentum: "medium" as const,
      driftRisk: "low" as const,
      habitRecovery: false,
      stalledProjects: [],
      projectsMissingNextAction: [],
      financeNeedsAttention: false,
      unfinishedPriority: false,
      longRunningTimer: true,
      possiblyStaleTimer: true,
      ...overrides,
    };
  }

  it("adds stale timer to watchouts when possiblyStaleTimer", () => {
    const facts = makeBriefingFacts({
      runningTimer: { category: "commute", elapsedMinutes: 100 },
    });
    const b = computeBriefing(facts, makeBaseSignals(), 9, 1);
    expect(b.watchouts.some((w) => w.toLowerCase().includes("commute"))).toBe(true);
    expect(b.watchouts.some((w) => w.includes("stale"))).toBe(true);
  });

  it("adds inflated note to contextNotes when possiblyStaleTimer", () => {
    const facts = makeBriefingFacts({
      runningTimer: { category: "commute", elapsedMinutes: 100 },
    });
    const b = computeBriefing(facts, makeBaseSignals(), 9, 1);
    expect(b.contextNotes.some((n) => n.includes("inflated"))).toBe(true);
  });

  it("no stale watchout when possiblyStaleTimer is false", () => {
    const facts = makeBriefingFacts({
      runningTimer: { category: "deep work", elapsedMinutes: 150 },
    });
    const signals = makeBaseSignals({ possiblyStaleTimer: false });
    const b = computeBriefing(facts, signals, 10, 1);
    expect(b.watchouts.some((w) => w.includes("stale"))).toBe(false);
    expect(b.contextNotes.some((n) => n.includes("inflated"))).toBe(false);
  });
});
