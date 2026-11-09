// "Has the data stopped arriving?" — pure checks over the sources that feed
// the app from outside it: linked calendars, Apple Health, and money entries.
//
// The failure this exists for: a source goes quiet, nothing says so, and the
// pages that depend on it keep looking normal while being wrong. Each check
// returns a notice only when a source the owner set up has gone quiet for
// longer than it reasonably should — a source that was never set up is not
// "stale", it is just not used, and gets no notice.
//
// Pure and tested in tests/data-freshness.test.ts.

export type FreshnessFeed = {
  name: string;
  lastSyncedAt: Date | null;
  lastError: string | null;
};

export type FreshnessInput = {
  now: Date;
  /** Linked calendars; null when feeds are not set up on this database. */
  calendarFeeds: FreshnessFeed[] | null;
  health: {
    /** Habits the owner tied to an Apple Health measure. */
    linkedHabitCount: number;
    lastSyncedAt: Date | null;
  };
  money: {
    visible: boolean;
    accountCount: number;
    /** Newest Money activity (an entry, import or balance update); null when none. */
    lastEntryAt: Date | null;
  };
};

export type StaleNotice = {
  key: string;
  /** What stopped, in plain words. */
  title: string;
  /** Since when, and what that affects. */
  detail: string;
  href: string;
  action: string;
};

/** Feeds refresh on page view and by a daily cron, so two days means broken. */
export const CALENDAR_STALE_HOURS = 48;
/** The Health Shortcut runs daily. */
export const HEALTH_STALE_DAYS = 2;
/** Spending is logged as it happens; a working week of silence is a gap. */
export const MONEY_STALE_DAYS = 5;

function startOfDay(date: Date): number {
  const value = new Date(date);
  value.setHours(0, 0, 0, 0);
  return value.getTime();
}

/** Whole calendar days between two moments (local), never negative. */
export function daysSince(at: Date, now: Date): number {
  return Math.max(0, Math.round((startOfDay(now) - startOfDay(at)) / 86_400_000));
}

function since(at: Date, now: Date): string {
  const days = daysSince(at, now);
  const date = at.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  return `${date}, ${days} days ago`;
}

export function deriveStaleData(input: FreshnessInput): StaleNotice[] {
  const { now } = input;
  const notices: StaleNotice[] = [];

  for (const feed of input.calendarFeeds ?? []) {
    if (feed.lastError) {
      notices.push({
        key: `calendar:${feed.name}`,
        title: `${feed.name} calendar stopped updating`,
        detail: "The link could not be read, so new events are not showing.",
        href: "/app/settings",
        action: "Check the link",
      });
      continue;
    }
    if (
      feed.lastSyncedAt &&
      now.getTime() - feed.lastSyncedAt.getTime() > CALENDAR_STALE_HOURS * 3_600_000
    ) {
      notices.push({
        key: `calendar:${feed.name}`,
        title: `${feed.name} calendar has not refreshed`,
        detail: `Last updated ${since(feed.lastSyncedAt, now)}.`,
        href: "/app/calendar",
        action: "Open Calendar to refresh",
      });
    }
  }

  if (input.health.linkedHabitCount > 0) {
    const last = input.health.lastSyncedAt;
    const count = input.health.linkedHabitCount;
    const habits = `${count} ${count === 1 ? "habit depends" : "habits depend"} on it`;
    if (!last) {
      notices.push({
        key: "health",
        title: "No Apple Health data has arrived yet",
        detail: `${habits}. The iPhone Shortcut has not run.`,
        href: "/app/habits",
        action: "Open Habits",
      });
    } else if (daysSince(last, now) >= HEALTH_STALE_DAYS) {
      notices.push({
        key: "health",
        title: "Apple Health data stopped arriving",
        detail: `Last sync ${since(last, now)}. ${habits}.`,
        href: "/app/habits",
        action: "Open Habits",
      });
    }
  }

  if (input.money.visible && input.money.accountCount > 0) {
    const last = input.money.lastEntryAt;
    if (!last) {
      notices.push({
        key: "money",
        title: "Nothing logged in Money yet",
        detail: "Accounts are set up but no spending has been logged.",
        href: "/app/finance/catch-up",
        action: "Catch up",
      });
    } else if (daysSince(last, now) >= MONEY_STALE_DAYS) {
      notices.push({
        key: "money",
        title: "Nothing logged in Money lately",
        detail: `Last entry ${since(last, now)}. This week's number is out of date.`,
        href: "/app/finance/catch-up",
        action: "Catch up",
      });
    }
  }

  return notices;
}
