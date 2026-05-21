import { describe, expect, it } from "vitest";
import { deriveCalendarSignals, formatCalendarTimeRange, startOfCalendarWeek } from "@/app/app/calendar/_lib/derive";
import type { CalendarItem, FinanceAccount, TimeEntry } from "@/generated/prisma/client";

function calendarItem(overrides: Partial<CalendarItem> = {}): CalendarItem {
  const now = new Date("2026-05-21T09:00:00.000Z");
  return {
    id: "cal-1",
    userId: "user-1",
    title: "Deep work",
    kind: "block",
    status: "confirmed",
    startsAt: now,
    endsAt: new Date("2026-05-21T10:00:00.000Z"),
    allDay: false,
    sourceTool: null,
    sourceRefId: null,
    notes: null,
    location: null,
    externalId: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function account(overrides: Partial<FinanceAccount> = {}): FinanceAccount {
  const now = new Date();
  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + 2);
  return {
    id: "acc-1",
    userId: "user-1",
    connectionId: null,
    externalId: null,
    syncSource: "manual",
    name: "Visa",
    kind: "credit_card",
    currency: "USD",
    includeInNetWorth: true,
    includeInCashPosition: false,
    currentBalanceCents: -32000,
    balanceUpdatedAt: now,
    statementBalanceCents: -32000,
    dueDate,
    creditLimitCents: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function runningEntry(overrides: Partial<TimeEntry> = {}): Pick<TimeEntry, "label" | "startedAt"> {
  return {
    label: "Planning block",
    startedAt: new Date(Date.now() - 30 * 60 * 1000),
    ...overrides,
  } as Pick<TimeEntry, "label" | "startedAt">;
}

describe("calendar derive helpers", () => {
  it("surfaces empty-day pressure when nothing is planned", () => {
    const signals = deriveCalendarSignals({
      todayItems: [],
      runningEntry: null,
      weekTotalMs: 0,
      accounts: [],
    });

    expect(signals.some((signal) => signal.title.includes("No intentional blocks yet"))).toBe(true);
  });

  it("includes finance pressure when a card is due soon", () => {
    const signals = deriveCalendarSignals({
      todayItems: [calendarItem()],
      runningEntry: null,
      weekTotalMs: 4 * 60 * 60 * 1000,
      accounts: [account()],
    });

    expect(signals.some((signal) => signal.title.includes("due in"))).toBe(true);
  });

  it("formats all-day entries cleanly", () => {
    expect(formatCalendarTimeRange(calendarItem({ allDay: true }))).toBe("All day");
  });

  it("starts calendar weeks on monday", () => {
    const start = startOfCalendarWeek(new Date("2026-05-24T20:00:00.000Z"));
    expect(start.getUTCDay()).toBe(1);
  });

  it("mentions a live timer when one is running", () => {
    const signals = deriveCalendarSignals({
      todayItems: [calendarItem()],
      runningEntry: runningEntry(),
      weekTotalMs: 4 * 60 * 60 * 1000,
      accounts: [],
    });

    expect(signals[0]?.title).toContain("Timer is already live");
  });
});
