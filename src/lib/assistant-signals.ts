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

export type Briefing = {
  currentState: string;
  topSignals: string[];
  suggestedFocus: string[];
  watchouts: string[];
  morningMessageInputs: {
    tone: "direct_accountability" | "gentle_nudge" | "momentum_build" | "recovery_mode";
    prioritySeeds: string[];
    reminderSeeds: string[];
    journalPromptSeed: string;
  };
};

type BriefingFacts = {
  today: {
    tasks: { open: { title: string; lane: string }[] };
    habits: { items: { name: string; done: boolean; streak: number; scheduledToday: boolean }[] };
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

const STATE_LABELS = {
  active_morning_planned: "active morning with scheduled blocks",
  active_morning_open: "active morning with open calendar",
  mid_day_on_track: "mid-day on track",
  mid_day_drifting: "mid-day with drift risk",
  evening_winding_down: "evening",
  morning_not_started: "morning not yet started",
  timer_running: "timer currently running",
} as const;

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

export function computeBriefing(
  facts: BriefingFacts,
  signals: Signals,
  localHour: number,
  dayOfWeek: number,
): Briefing {
  let currentState: string;
  if (signals.hasRunningTimer) {
    currentState = STATE_LABELS.timer_running;
  } else if (localHour < 8 && facts.today.tasks.open.length === 0) {
    currentState = STATE_LABELS.morning_not_started;
  } else if (localHour < 12 && signals.openDay) {
    currentState = STATE_LABELS.active_morning_open;
  } else if (localHour < 12) {
    currentState = STATE_LABELS.active_morning_planned;
  } else if (localHour >= 18) {
    currentState = STATE_LABELS.evening_winding_down;
  } else if (signals.driftRisk !== "low") {
    currentState = STATE_LABELS.mid_day_drifting;
  } else {
    currentState = STATE_LABELS.mid_day_on_track;
  }

  const topSignals: string[] = [];
  if (signals.unfinishedPriority) topSignals.push("unfinishedPriority");
  if (signals.driftRisk === "high") topSignals.push("driftRisk=high");
  if (signals.habitRecovery) topSignals.push("habitRecovery");
  if (signals.needsPlan) topSignals.push("needsPlan");
  if (signals.lateStart) topSignals.push("lateStart");
  if (signals.momentum === "low") topSignals.push("momentum=low");
  if (signals.stalledProjects.length > 0) topSignals.push("stalledProjects");
  if (signals.crowdedDay) topSignals.push("crowdedDay");

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

  const prioritySeeds: string[] = [];
  for (const task of facts.today.tasks.open) {
    if (task.lane === "today" && prioritySeeds.length < 3) prioritySeeds.push(task.title);
  }
  for (const name of signals.stalledProjects) {
    if (prioritySeeds.length < 3) prioritySeeds.push(name);
  }
  for (const habit of facts.today.habits.items) {
    if (!habit.done && habit.scheduledToday && prioritySeeds.length < 3)
      prioritySeeds.push(habit.name);
  }

  const reminderSeeds: string[] = [];
  for (const task of facts.today.tasks.open) {
    if (task.lane === "today" && reminderSeeds.length < 2) reminderSeeds.push(task.title);
  }
  for (const habit of facts.today.habits.items) {
    if (!habit.done && habit.scheduledToday && habit.streak > 3 && reminderSeeds.length < 2) {
      reminderSeeds.push(`${habit.name} (streak ${habit.streak} at risk)`);
    }
  }

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
    morningMessageInputs: {
      tone,
      prioritySeeds,
      reminderSeeds,
      journalPromptSeed,
    },
  };
}
