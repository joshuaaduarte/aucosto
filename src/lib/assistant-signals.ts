// Pure signal and briefing computation for the assistant snapshot.
// No DB access, no server-only — fully testable.

export type SignalFacts = {
  today: {
    wokeUpAt: string | null; // "HH:MM" 24h
    calendar: {
      items: { done: boolean; durationMinutes: number; startTime: string }[];
      totalScheduledMinutes: number;
    };
    time: {
      // NOTE: computeSignals receives nowMinutes that was derived from
      // new Date().getHours(). This is correct only because
      // src/instrumentation.ts pins process.env.TZ to America/Los_Angeles
      // before any request is handled.
      runningTimer: { title: string } | null;
      totalTrackedMinutes: number;
    };
    tasks: {
      open: { title: string; lane: string }[];
    };
    habits: {
      items: { name: string; done: boolean; streak: number; scheduledToday: boolean }[];
    };
    projects: { name: string; momentum: string; openTaskCount: number }[];
  };
  yesterday: {
    habitsCompleted: number;
    habitsTotal: number;
  };
  finance: {
    visible: boolean;
  };
};

export type Signals = {
  hasRunningTimer: boolean;
  lateStart: boolean;
  openDay: boolean;
  crowdedDay: boolean;
  needsPlan: boolean;
  momentum: "low" | "medium" | "good";
  driftRisk: "low" | "medium" | "high";
  habitRecovery: boolean;
  stalledProjects: string[];
  financeNeedsAttention: boolean;
  unfinishedPriority: boolean;
};

export type PrioritySeed = {
  label: string;
  reason:
    | "stalled project"
    | "habit recovery"
    | "habit not completed"
    | "task in today lane"
    | "open task";
  source:
    | "signals.stalledProjects"
    | "facts.today.habits"
    | "facts.today.tasks";
};

export type Briefing = {
  currentState: string;
  topSignals: string[];
  suggestedFocus: string[];
  watchouts: string[];
  contextNotes: string[];
  morningMessageInputs: {
    tone: "direct_accountability" | "gentle_nudge" | "momentum_build" | "recovery_mode";
    prioritySeeds: PrioritySeed[];
    prioritySeedLabels: string[];
    reminderSeeds: string[];
    journalPromptSeed: string;
  };
};

// BriefingFacts extends SignalFacts with the timer category and calendar/wake
// context needed for compound state label and contextNotes.
type BriefingFacts = {
  today: {
    wokeUpAt: string | null;
    calendar: {
      nextEvent: { title: string } | null;
    };
    time: {
      runningTimer: { category: string | null } | null;
    };
    tasks: {
      open: { title: string; lane: string }[];
    };
    habits: {
      items: { name: string; done: boolean; streak: number; scheduledToday: boolean }[];
    };
  };
};

function timeToMinutes(hhmm: string): number {
  const parts = hhmm.split(":");
  return Number(parts[0] ?? 0) * 60 + Number(parts[1] ?? 0);
}

export function computeSignals(facts: SignalFacts, nowMinutes: number): Signals {
  const localHour = Math.floor(nowMinutes / 60);

  const hasRunningTimer = facts.today.time.runningTimer !== null;

  let lateStart = false;
  if (facts.today.wokeUpAt !== null) {
    const wokeUpMinutes = timeToMinutes(facts.today.wokeUpAt);
    lateStart = wokeUpMinutes > 6 * 60 + 45;
  }

  const openDay =
    facts.today.calendar.items.filter(
      (i) =>
        !i.done &&
        i.durationMinutes > 30 &&
        timeToMinutes(i.startTime) - nowMinutes > 0,
    ).length === 0;

  const crowdedDay = facts.today.calendar.totalScheduledMinutes > 300;

  const todayLaneTasks = facts.today.tasks.open.filter((t) => t.lane === "today");
  const needsPlan =
    openDay && (facts.today.tasks.open.length === 0 || todayLaneTasks.length === 0);

  const targetByHour = localHour * 30;
  const tracked = facts.today.time.totalTrackedMinutes;
  const momentum: "low" | "medium" | "good" =
    targetByHour > 0 && tracked >= targetByHour * 1.2
      ? "good"
      : targetByHour > 0 && tracked >= targetByHour * 0.6
        ? "medium"
        : "low";

  const yesterdayPct =
    facts.yesterday.habitsTotal > 0
      ? facts.yesterday.habitsCompleted / facts.yesterday.habitsTotal
      : 1;
  const streakJustBroke = facts.today.habits.items.some(
    (h) => h.streak === 0 && h.scheduledToday,
  );
  const habitRecovery = yesterdayPct < 0.5 || streakJustBroke;

  const stalledProjects = facts.today.projects
    .filter((p) => p.momentum === "stalled" && p.openTaskCount > 0)
    .map((p) => p.name);

  // TODO: check last import date when finance data is available
  const financeNeedsAttention = false;

  const unfinishedPriority = todayLaneTasks.length > 0;

  let driftScore = 0;
  if (openDay) driftScore += 1;
  if (needsPlan) driftScore += 1;
  if (momentum === "low" && localHour >= 10) driftScore += 1;
  if (habitRecovery) driftScore += 1;
  if (
    facts.today.time.runningTimer === null &&
    localHour >= 9 &&
    localHour <= 18
  )
    driftScore += 1;
  const driftRisk: "low" | "medium" | "high" =
    driftScore <= 1 ? "low" : driftScore <= 3 ? "medium" : "high";

  return {
    hasRunningTimer,
    lateStart,
    openDay,
    crowdedDay,
    needsPlan,
    momentum,
    driftRisk,
    habitRecovery,
    stalledProjects,
    financeNeedsAttention,
    unfinishedPriority,
  };
}

// Derives a URL-safe slug from a category string: lowercase, spaces removed,
// max 12 chars. Falls back to "active" when category is null/empty.
function categorySlug(category: string | null): string {
  if (!category) return "active";
  const slug = category.toLowerCase().replace(/\s+/g, "").slice(0, 12);
  return slug || "active";
}

export const FOCUS_TEMPLATES: Record<string, string> = {
  unfinishedPriority: "Complete at least one task from today's priority list",
  needsPlan: "Set one concrete intention before the day becomes reactive",
  habitRecovery: "Recover at least two core habits today",
  momentum_low: "Start a focused block to build momentum",
  stalledProject: "Spend 30 min on {project} to break the stall",
  crowdedDay: "Protect 30 min of buffer between scheduled blocks",
  driftRisk_high: "Pick one task and start a timer now",
  default: "Review today's calendar and pick your most important action",
};

export const WATCHOUT_TEMPLATES: Record<string, string> = {
  openDay_noTasks: "An open calendar with no tasks tends to become an unstructured day",
  habitRecovery: "Avoid treating missed habits as failure — recovery is the goal",
  crowdedDay: "Back-to-back schedule leaves no buffer for overruns",
  lateStart: "Late start reduces available focus time — consider what to cut",
  driftRisk_high: "High drift risk — a plan now is better than a correction later",
};

export const JOURNAL_PROMPTS: readonly string[] = [
  "What would make today feel intentionally used?",
  "What is one thing that would make today a success?",
  "What has your attention right now, and is it the right thing?",
  "What are you avoiding, and why?",
  "What is the most important thing to finish before tonight?",
];

// resolveTimezone reads the server timezone that src/instrumentation.ts has
// already set unconditionally before any request is handled. Returns the
// resolved value for embedding in snapshots and for testing.
export function resolveTimezone(): string {
  return process.env.TZ ?? process.env.APP_TIMEZONE ?? "America/Los_Angeles";
}

export function computeBriefing(
  facts: BriefingFacts,
  signals: Signals,
  localHour: number,
  dayOfWeek: number,
): Briefing {
  // ── compound currentState ────────────────────────────────────────────────
  // Build a snake_case slug from up to 4 parts: day-shape · time-of-day ·
  // timer (optional) · plan-needed (optional). Max 60 chars.
  const parts: string[] = [];

  // Part 1 — day shape
  if (signals.crowdedDay) parts.push("crowded");
  else if (signals.openDay) parts.push("open");
  else parts.push("normal");

  // Part 2 — time of day
  if (localHour < 6) parts.push("early");
  else if (localHour < 12) parts.push("morning");
  else if (localHour < 17) parts.push("midday");
  else parts.push("evening");

  // Part 3 — timer (uses facts directly for category access)
  const runningTimer = facts.today.time.runningTimer;
  if (runningTimer !== null) {
    parts.push("timer_" + categorySlug(runningTimer.category));
  }

  // Part 4 — plan needed
  if (signals.needsPlan) parts.push("needs_plan");

  const currentState = parts.join("_").slice(0, 60);

  // ── topSignals ───────────────────────────────────────────────────────────
  const topSignals: string[] = [];
  if (signals.unfinishedPriority) topSignals.push("unfinishedPriority");
  if (signals.driftRisk === "high") topSignals.push("driftRisk=high");
  if (signals.habitRecovery) topSignals.push("habitRecovery");
  if (signals.needsPlan) topSignals.push("needsPlan");
  if (signals.lateStart) topSignals.push("lateStart");
  if (signals.momentum === "low") topSignals.push("momentum=low");
  if (signals.stalledProjects.length > 0) topSignals.push("stalledProjects");
  if (signals.crowdedDay) topSignals.push("crowdedDay");

  // ── suggestedFocus ───────────────────────────────────────────────────────
  const focus: string[] = [];
  if (signals.unfinishedPriority) focus.push(FOCUS_TEMPLATES["unfinishedPriority"]!);
  if (focus.length < 3 && signals.needsPlan) focus.push(FOCUS_TEMPLATES["needsPlan"]!);
  if (focus.length < 3 && signals.habitRecovery) focus.push(FOCUS_TEMPLATES["habitRecovery"]!);
  if (focus.length < 3 && signals.momentum === "low") focus.push(FOCUS_TEMPLATES["momentum_low"]!);
  if (focus.length < 3 && signals.stalledProjects.length > 0) {
    const projectName = signals.stalledProjects[0]!;
    focus.push(FOCUS_TEMPLATES["stalledProject"]!.replace("{project}", projectName));
  }
  if (focus.length < 3 && signals.crowdedDay) focus.push(FOCUS_TEMPLATES["crowdedDay"]!);
  if (focus.length < 3 && signals.driftRisk === "high")
    focus.push(FOCUS_TEMPLATES["driftRisk_high"]!);
  while (focus.length < 2) focus.push(FOCUS_TEMPLATES["default"]!);

  // ── watchouts ────────────────────────────────────────────────────────────
  const watchouts: string[] = [];
  if (signals.openDay && signals.needsPlan)
    watchouts.push(WATCHOUT_TEMPLATES["openDay_noTasks"]!);
  if (watchouts.length < 2 && signals.habitRecovery)
    watchouts.push(WATCHOUT_TEMPLATES["habitRecovery"]!);
  if (watchouts.length < 2 && signals.crowdedDay)
    watchouts.push(WATCHOUT_TEMPLATES["crowdedDay"]!);
  if (watchouts.length < 2 && signals.lateStart)
    watchouts.push(WATCHOUT_TEMPLATES["lateStart"]!);
  if (watchouts.length < 2 && signals.driftRisk === "high")
    watchouts.push(WATCHOUT_TEMPLATES["driftRisk_high"]!);

  // ── contextNotes ─────────────────────────────────────────────────────────
  const contextNotes: string[] = [];
  if (signals.needsPlan && facts.today.tasks.open.length === 0) {
    contextNotes.push("0 open tasks — day needs an explicit intention");
  } else if (signals.needsPlan) {
    contextNotes.push("no tasks in today lane — nothing prioritized yet");
  }
  if (signals.openDay && facts.today.calendar.nextEvent === null) {
    contextNotes.push("no upcoming calendar events");
  }
  if (signals.lateStart && facts.today.wokeUpAt !== null) {
    contextNotes.push(`late start — ${facts.today.wokeUpAt} vs 6:00 AM target`);
  }
  if (signals.momentum === "low" && localHour >= 10) {
    contextNotes.push("low tracked time for this time of day");
  }

  // ── tone ─────────────────────────────────────────────────────────────────
  let tone: "direct_accountability" | "gentle_nudge" | "momentum_build" | "recovery_mode";
  if (signals.driftRisk === "high" || signals.unfinishedPriority) {
    tone = "direct_accountability";
  } else if (signals.habitRecovery && signals.momentum !== "good") {
    tone = "recovery_mode";
  } else if (signals.momentum === "good") {
    tone = "momentum_build";
  } else {
    tone = "gentle_nudge";
  }

  // ── structured prioritySeeds ─────────────────────────────────────────────
  const prioritySeeds: PrioritySeed[] = [];

  for (const task of facts.today.tasks.open) {
    if (task.lane === "today" && prioritySeeds.length < 3) {
      prioritySeeds.push({
        label: task.title,
        reason: "task in today lane",
        source: "facts.today.tasks",
      });
    }
  }
  for (const name of signals.stalledProjects) {
    if (prioritySeeds.length < 3) {
      prioritySeeds.push({
        label: name,
        reason: "stalled project",
        source: "signals.stalledProjects",
      });
    }
  }
  for (const habit of facts.today.habits.items) {
    if (!habit.done && habit.scheduledToday && prioritySeeds.length < 3) {
      prioritySeeds.push({
        label: habit.name,
        reason: habit.streak === 0 ? "habit recovery" : "habit not completed",
        source: "facts.today.habits",
      });
    }
  }

  const prioritySeedLabels = prioritySeeds.map((s) => s.label);

  // ── reminderSeeds ─────────────────────────────────────────────────────────
  const reminderSeeds: string[] = [];
  for (const task of facts.today.tasks.open) {
    if (task.lane === "today" && reminderSeeds.length < 2) reminderSeeds.push(task.title);
  }
  for (const habit of facts.today.habits.items) {
    if (!habit.done && habit.scheduledToday && habit.streak > 3 && reminderSeeds.length < 2) {
      reminderSeeds.push(`${habit.name} (streak ${habit.streak} at risk)`);
    }
  }

  // ── journalPromptSeed ─────────────────────────────────────────────────────
  const journalPromptSeed =
    signals.driftRisk === "high"
      ? JOURNAL_PROMPTS[3]!
      : signals.needsPlan
        ? JOURNAL_PROMPTS[0]!
        : JOURNAL_PROMPTS[dayOfWeek % JOURNAL_PROMPTS.length]!;

  return {
    currentState,
    topSignals: topSignals.slice(0, 4),
    suggestedFocus: focus,
    watchouts,
    contextNotes,
    morningMessageInputs: {
      tone,
      prioritySeeds,
      prioritySeedLabels,
      reminderSeeds,
      journalPromptSeed,
    },
  };
}
