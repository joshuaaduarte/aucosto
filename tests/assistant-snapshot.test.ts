import { describe, expect, it } from "vitest";
import {
  computeSignals,
  computeBriefing,
  FOCUS_TEMPLATES,
  WATCHOUT_TEMPLATES,
  JOURNAL_PROMPTS,
  type SignalFacts,
} from "@/lib/assistant-signals";

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
    // openDay: no future events > 30min
    // needsPlan: openDay and no today tasks
    // no running timer at 11am
    const s = computeSignals(facts, 11 * 60);
    expect(s.driftRisk).toBe("high");
  });

  it("is medium with 2-3 risk factors", () => {
    // openDay (+1), no timer at 10am (+1) => 2 = medium
    const facts = makeFacts();
    const s = computeSignals(facts, 10 * 60);
    // openDay=true, needsPlan may be true too, let's check score
    // openDay(+1), needsPlan(+1 since openDay+no today tasks), momentum=low at 10am (+1), habitRecovery=false, no timer at 10am(+1)
    // score = 4 = high? No: openDay(1)+needsPlan(1)+momentum_low_at_10am(1)+no_timer_at_10am(1) = 4 → high
    // Let me use 8am instead (no momentum flag since localHour < 10)
    const s2 = computeSignals(facts, 8 * 60);
    // openDay(1), needsPlan(1), momentum=low but hour<10 so no(0), habitRecovery=false(0), no timer at 8am(1) = 3 = medium
    expect(s2.driftRisk).toBe("medium");
  });
});

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
      financeNeedsAttention: false,
      unfinishedPriority: false,
      ...overrides,
    };
  }

  const emptyFacts = {
    today: {
      tasks: { open: [] },
      habits: { items: [] },
    },
  };

  it("returns timer_running when hasRunningTimer", () => {
    const b = computeBriefing(emptyFacts, makeSignals({ hasRunningTimer: true }), 10, 1);
    expect(b.currentState).toBe("timer currently running");
  });

  it("returns morning_not_started early with no tasks", () => {
    const b = computeBriefing(emptyFacts, makeSignals(), 7, 1);
    expect(b.currentState).toBe("morning not yet started");
  });

  it("returns active_morning_open at 9am with open day", () => {
    const b = computeBriefing(emptyFacts, makeSignals({ openDay: true }), 9, 1);
    expect(b.currentState).toBe("active morning with open calendar");
  });

  it("returns active_morning_planned at 9am without open day", () => {
    const b = computeBriefing(emptyFacts, makeSignals({ openDay: false }), 9, 1);
    expect(b.currentState).toBe("active morning with scheduled blocks");
  });

  it("returns evening after 18:00", () => {
    const b = computeBriefing(emptyFacts, makeSignals(), 19, 1);
    expect(b.currentState).toBe("evening");
  });

  it("returns mid_day_drifting when driftRisk is medium or high", () => {
    const b = computeBriefing(emptyFacts, makeSignals({ driftRisk: "medium" }), 14, 1);
    expect(b.currentState).toBe("mid-day with drift risk");
  });

  it("returns mid_day_on_track otherwise", () => {
    const b = computeBriefing(emptyFacts, makeSignals({ driftRisk: "low", openDay: false }), 14, 1);
    expect(b.currentState).toBe("mid-day on track");
  });
});

describe("computeBriefing — topSignals ordering and cap", () => {
  it("includes unfinishedPriority first if active", () => {
    const facts = {
      today: { tasks: { open: [{ title: "T1", lane: "today" }] }, habits: { items: [] } },
    };
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
      financeNeedsAttention: false,
      unfinishedPriority: true,
    };
    const b = computeBriefing({ today: { tasks: { open: [] }, habits: { items: [] } } }, s, 12, 1);
    expect(b.topSignals.length).toBeLessThanOrEqual(4);
  });
});

describe("computeBriefing — suggestedFocus", () => {
  it("always has at least 2 items", () => {
    const b = computeBriefing(
      { today: { tasks: { open: [] }, habits: { items: [] } } },
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
        financeNeedsAttention: false,
        unfinishedPriority: false,
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
      financeNeedsAttention: false,
      unfinishedPriority: false,
    };
    const b = computeBriefing({ today: { tasks: { open: [] }, habits: { items: [] } } }, s, 12, 1);
    const hasFilled = b.suggestedFocus.some((f) => f.includes("MyProject"));
    expect(hasFilled).toBe(true);
  });
});

describe("computeBriefing — journalPrompt", () => {
  const emptyFacts = { today: { tasks: { open: [] }, habits: { items: [] } } };

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
      financeNeedsAttention: false,
      unfinishedPriority: false,
    };
    const b = computeBriefing(emptyFacts, s, 12, 3);
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
      financeNeedsAttention: false,
      unfinishedPriority: false,
    };
    const b = computeBriefing(emptyFacts, s, 12, 3);
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
      financeNeedsAttention: false,
      unfinishedPriority: false,
    };
    const b = computeBriefing(emptyFacts, s, 12, 2);
    expect(b.morningMessageInputs.journalPromptSeed).toBe(
      JOURNAL_PROMPTS[2 % JOURNAL_PROMPTS.length],
    );
  });
});
