// The app-wide streak: weeks in a row with at least 5 "showed-up" days.
//
// Why weekly and not daily: a daily streak breaks on the first sick day or
// busy Saturday, and research on streaks (Silverman & Barasch, 2023) finds a
// broken streak lowers engagement more than having no streak at all. Counting
// weeks of 5-out-of-7 lets any two days slip without costing anything, which
// is the main protection against streak anxiety. It is also the roadmap's own
// "is the app being used" test (see USAGE_GOAL_DAYS).
//
// A showed-up day is a day the person wrote something themselves. Agent
// writes (assistant API with a bearer key) and device/bank syncs never count:
// an app an agent fills in every morning looks busy while nobody opens it.
//
// Rest days (chosen on the day or in advance) are taken out of the week: each
// one lowers the week's goal by one, and a week with 5+ rest days is paused —
// it neither breaks nor extends the run. A rest day that ends up with activity
// counts as a normal showed-up day instead.
//
// Pure and tested in tests/app-streak.test.ts. No DB access here.

import { usageAreaKey, USAGE_GOAL_DAYS } from "./insights/usage";
import { weekStartOf } from "./insights/shared";

export const STREAK_GOAL_DAYS = USAGE_GOAL_DAYS;

/** How many weeks of history the hub loads; a longer run shows as "12+". */
export const STREAK_WINDOW_WEEKS = 12;

/** Writes nobody chose to make (mirrors the usage page's list). */
const AUTOMATIC_TYPES = new Set([
  "habit.health_synced",
  "finance.connection_synced",
  "finance.webhook_transactions_processed",
]);

/** Areas a household partner can use (Finance + Home only). */
export const PARTNER_STREAK_AREAS: ReadonlySet<string> = new Set(["finance", "home"]);

export type StreakEvent = {
  userId: string;
  type: string;
  at: Date;
  meta: unknown;
};

function metaField(meta: unknown, field: string): unknown {
  if (meta && typeof meta === "object" && !Array.isArray(meta)) {
    return (meta as Record<string, unknown>)[field];
  }
  return undefined;
}

/**
 * True when `event` is something `personId` did themselves. Their own rows
 * count unless someone else (a partner, an agent) wrote them; rows on shared
 * household data count only when stamped with this person as the actor.
 */
export function isShowUpEvent(
  event: StreakEvent,
  personId: string,
  areas: ReadonlySet<string> | null = null,
): boolean {
  const area = usageAreaKey(event.type);
  if (!area) return false;
  if (areas && !areas.has(area)) return false;
  if (AUTOMATIC_TYPES.has(event.type)) return false;
  if (metaField(event.meta, "via") === "agent") return false;
  const actor = metaField(event.meta, "actorUserId");
  if (event.userId === personId) {
    return !(typeof actor === "string" && actor && actor !== personId);
  }
  return actor === personId;
}

export function streakDayKey(date: Date): string {
  return date.toLocaleDateString("en-CA");
}

function addDays(date: Date, days: number): Date {
  const value = new Date(date);
  value.setDate(value.getDate() + days);
  return value;
}

/** Local day keys on which `personId` showed up. */
export function showUpDayKeys(
  events: StreakEvent[],
  personId: string,
  areas: ReadonlySet<string> | null = null,
): Set<string> {
  const keys = new Set<string>();
  for (const event of events) {
    if (isShowUpEvent(event, personId, areas)) keys.add(streakDayKey(event.at));
  }
  return keys;
}

export type StreakDayState = "done" | "rest" | "missed" | "today" | "future";

export type StreakDay = {
  key: string;
  date: Date;
  state: StreakDayState;
};

export type StreakWeek = {
  /** Monday's day key. */
  key: string;
  days: StreakDay[];
  activeDays: number;
  restDays: number;
  /** Days needed this week (5 minus rest days); 0 means the week is paused. */
  goal: number;
  met: boolean;
  paused: boolean;
};

export type AppStreak = {
  thisWeek: StreakWeek & {
    /** Days left after today that could still count. */
    daysLeft: number;
    /** The goal can still be met this week. */
    reachable: boolean;
  };
  /** Weeks in a row the goal was met, including this week once it's met. */
  weeksRunning: number;
  /** The run reached the start of the loaded window (show "12+"). */
  capped: boolean;
  /** Today already counts. */
  showedUpToday: boolean;
  todayKey: string;
};

function buildWeek(
  start: Date,
  active: Set<string>,
  rest: Set<string>,
  todayKey: string,
): StreakWeek {
  const days: StreakDay[] = [];
  let activeDays = 0;
  let restDays = 0;
  for (let i = 0; i < 7; i += 1) {
    const date = addDays(start, i);
    const key = streakDayKey(date);
    let state: StreakDayState;
    if (active.has(key)) {
      state = "done";
      activeDays += 1;
    } else if (rest.has(key)) {
      state = "rest";
      restDays += 1;
    } else if (key === todayKey) state = "today";
    else if (key > todayKey) state = "future";
    else state = "missed";
    days.push({ key, date, state });
  }
  const goal = Math.max(0, STREAK_GOAL_DAYS - restDays);
  const paused = goal === 0;
  return {
    key: streakDayKey(start),
    days,
    activeDays,
    restDays,
    goal,
    met: !paused && activeDays >= goal,
    paused,
  };
}

/**
 * Build the streak from the days someone showed up and the days they rested.
 * Paused weeks are skipped over; the first unmet past week ends the run. The
 * current week adds one once its goal is met and never ends the run early.
 */
export function buildAppStreak(input: {
  activeDays: Set<string>;
  restDays?: Set<string>;
  now: Date;
  windowWeeks?: number;
}): AppStreak {
  const rest = input.restDays ?? new Set<string>();
  const windowWeeks = input.windowWeeks ?? STREAK_WINDOW_WEEKS;
  const todayKey = streakDayKey(input.now);
  const thisMonday = weekStartOf(input.now);

  const current = buildWeek(thisMonday, input.activeDays, rest, todayKey);
  const daysLeft = current.days.filter((day) => day.state === "future").length;
  const todayOpen = current.days.some((day) => day.state === "today") ? 1 : 0;
  const reachable =
    current.met || current.paused || current.activeDays + daysLeft + todayOpen >= current.goal;

  let weeksRunning = current.met ? 1 : 0;
  let broke = false;
  for (let back = 1; back < windowWeeks; back += 1) {
    const week = buildWeek(addDays(thisMonday, -7 * back), input.activeDays, rest, todayKey);
    if (week.paused) continue;
    if (!week.met) {
      broke = true;
      break;
    }
    weeksRunning += 1;
  }
  const capped = !broke && weeksRunning > 0;

  return {
    thisWeek: { ...current, daysLeft, reachable },
    weeksRunning,
    capped,
    showedUpToday: input.activeDays.has(todayKey),
    todayKey,
  };
}

/** First instant the hub needs events from. */
export function streakWindowStart(now: Date, windowWeeks = STREAK_WINDOW_WEEKS): Date {
  return addDays(weekStartOf(now), -7 * (windowWeeks - 1));
}

export function weeksRunningLabel(streak: AppStreak): string | null {
  if (streak.weeksRunning === 0) return null;
  const count = `${streak.weeksRunning}${streak.capped ? "+" : ""}`;
  return `${count} ${streak.weeksRunning === 1 && !streak.capped ? "week" : "weeks"} running`;
}

/**
 * The one line under the hub greeting. Never mentions a lost streak: once the
 * week can't be met, it just counts this week's days and points at Monday.
 */
export function appStreakLine(streak: AppStreak): string {
  const week = streak.thisWeek;
  const running = weeksRunningLabel(streak);
  if (week.paused) {
    return running ? `Resting this week · ${running}` : "Resting this week";
  }
  if (week.met) {
    return `Week done, ${week.activeDays} days · ${running ?? "1 week running"}`;
  }
  if (!week.reachable) {
    const days = `${week.activeDays} ${week.activeDays === 1 ? "day" : "days"} this week`;
    return `${days} · fresh week Monday`;
  }
  const progress = `${week.activeDays} of ${week.goal} days this week`;
  return running ? `${progress} · ${running}` : progress;
}

/** Event that turns rest days on or off: meta = { days: string[], rest: boolean }. */
export const REST_DAYS_EVENT = "streak.rest_days_set";

/** Rest days can be set from today up to this many days ahead (a trip). */
export const REST_DAYS_MAX_AHEAD = 30;

const DAY_KEY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Replay rest-day events (any order) into the set of rest days. Later events
 * win, so "undo" is just another event with rest = false.
 */
export function restDaysFromEvents(events: Array<{ at: Date; meta: unknown }>): Set<string> {
  const rest = new Set<string>();
  const ordered = [...events].sort((a, b) => a.at.getTime() - b.at.getTime());
  for (const event of ordered) {
    const days = metaField(event.meta, "days");
    const on = metaField(event.meta, "rest") !== false;
    if (!Array.isArray(days)) continue;
    for (const day of days) {
      if (typeof day !== "string" || !DAY_KEY.test(day)) continue;
      if (on) rest.add(day);
      else rest.delete(day);
    }
  }
  return rest;
}

/**
 * Day keys from `from` to `to` inclusive, or an error. Rest days are chosen
 * on the day or ahead of time — never backdated, which would turn them into
 * a way to repair a missed day after the fact.
 */
export function restDayRange(
  from: string,
  to: string,
  now: Date,
): { ok: true; days: string[] } | { ok: false; error: string } {
  if (!DAY_KEY.test(from) || !DAY_KEY.test(to)) return { ok: false, error: "Pick the days." };
  const todayKey = streakDayKey(now);
  if (from < todayKey) return { ok: false, error: "Rest days start today or later." };
  if (to < from) return { ok: false, error: "The last day is before the first." };
  const limit = streakDayKey(addDays(now, REST_DAYS_MAX_AHEAD));
  if (to > limit) {
    return { ok: false, error: `Rest days can be set up to ${REST_DAYS_MAX_AHEAD} days ahead.` };
  }
  const [y, m, d] = from.split("-").map(Number) as [number, number, number];
  const days: string[] = [];
  for (let cursor = new Date(y, m - 1, d, 12); streakDayKey(cursor) <= to; cursor = addDays(cursor, 1)) {
    days.push(streakDayKey(cursor));
  }
  return { ok: true, days };
}

/** Upcoming rest days (today on), sorted — for the settings list. */
export function upcomingRestDays(rest: Set<string>, now: Date): string[] {
  const todayKey = streakDayKey(now);
  return [...rest].filter((day) => day >= todayKey).sort();
}

/**
 * The streak as it is, plus how it would look with today's rest day flipped,
 * so the "Taking today off" button can update the line immediately (the
 * hub's server refresh lands later, or on the next visit).
 */
export type StreakView = { current: AppStreak; ifTodayToggled: AppStreak };

export function buildStreakView(input: {
  activeDays: Set<string>;
  restDays?: Set<string>;
  now: Date;
  windowWeeks?: number;
}): StreakView {
  const rest = new Set(input.restDays ?? []);
  const current = buildAppStreak({ ...input, restDays: rest });
  const toggled = new Set(rest);
  if (toggled.has(current.todayKey)) toggled.delete(current.todayKey);
  else toggled.add(current.todayKey);
  return { current, ifTodayToggled: buildAppStreak({ ...input, restDays: toggled }) };
}
