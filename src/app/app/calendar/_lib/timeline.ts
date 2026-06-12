// Pure derive logic for the planned-vs-actual day timeline.
// Positions calendar items (planned lane) and time entries (actual lane)
// as percentage offsets inside a shared hour window. Tested in
// tests/calendar-timeline.test.ts.

import type { CalendarItem, TimeEntry } from "@/generated/prisma/client";
import { categoryColor } from "@/lib/time-categories";

export type TimelineBlock = {
  id: string;
  title: string;
  detail: string;
  color: string;
  topPct: number;
  heightPct: number;
  running: boolean;
  muted: boolean;
};

export type TimelineHourMark = {
  hour: number;
  label: string;
  topPct: number;
};

export type DayTimelineModel = {
  windowStart: Date;
  windowEnd: Date;
  hourMarks: TimelineHourMark[];
  planned: TimelineBlock[];
  actual: TimelineBlock[];
  nowPct: number | null;
};

const MIN_START_HOUR = 7;
const MIN_END_HOUR = 22;

type PlannedInput = Pick<
  CalendarItem,
  "id" | "title" | "startsAt" | "endsAt" | "allDay" | "status" | "kind"
> & { sourceTool?: string | null };

type ActualInput = Pick<
  TimeEntry,
  "id" | "label" | "category" | "startedAt" | "endedAt"
>;

function formatShort(date: Date): string {
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function clampPct(value: number): number {
  return Math.min(100, Math.max(0, value));
}

export function buildDayTimeline(input: {
  items: PlannedInput[];
  entries: ActualInput[];
  day: Date;
  now: Date;
}): DayTimelineModel {
  const dayStart = new Date(input.day);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(dayStart);
  dayEnd.setDate(dayEnd.getDate() + 1);

  const timed = input.items.filter((item) => !item.allDay);

  // Expand the visible window to fit everything, default 07:00–22:00.
  let startHour = MIN_START_HOUR;
  let endHour = MIN_END_HOUR;
  const consider = (start: Date, end: Date) => {
    const from = Math.max(start.getTime(), dayStart.getTime());
    const to = Math.min(end.getTime(), dayEnd.getTime());
    if (to <= from) return;
    startHour = Math.min(
      startHour,
      Math.floor((from - dayStart.getTime()) / 3_600_000),
    );
    endHour = Math.max(
      endHour,
      Math.ceil((to - dayStart.getTime()) / 3_600_000),
    );
  };
  for (const item of timed) consider(item.startsAt, item.endsAt);
  for (const entry of input.entries) {
    consider(entry.startedAt, entry.endedAt ?? input.now);
  }
  startHour = Math.max(0, startHour);
  endHour = Math.min(24, Math.max(endHour, startHour + 1));

  const windowStart = new Date(dayStart);
  windowStart.setHours(startHour, 0, 0, 0);
  const windowEnd = new Date(dayStart);
  windowEnd.setHours(0, 0, 0, 0);
  windowEnd.setTime(dayStart.getTime() + endHour * 3_600_000);
  const windowMs = windowEnd.getTime() - windowStart.getTime();

  const position = (start: Date, end: Date) => {
    const from = Math.max(start.getTime(), windowStart.getTime());
    const to = Math.min(end.getTime(), windowEnd.getTime());
    const topPct = clampPct(((from - windowStart.getTime()) / windowMs) * 100);
    const bottomPct = clampPct(((to - windowStart.getTime()) / windowMs) * 100);
    return { topPct, heightPct: Math.max(bottomPct - topPct, 1.5) };
  };

  const planned: TimelineBlock[] = timed
    .filter((item) => item.endsAt > windowStart && item.startsAt < windowEnd)
    .map((item) => {
      const { topPct, heightPct } = position(item.startsAt, item.endsAt);
      return {
        id: item.id,
        title: item.title,
        detail: `${formatShort(item.startsAt)}–${formatShort(item.endsAt)}`,
        // One color language with the rest of the app: task-sourced blocks
        // use the "do" color, habit blocks "habit", native blocks "calendar".
        color:
          item.kind === "external"
            ? categoryColor(null)
            : item.sourceTool === "do"
              ? categoryColor("do")
              : item.sourceTool === "habit"
                ? categoryColor("habit")
                : categoryColor("calendar"),
        topPct,
        heightPct,
        running: false,
        muted: item.status === "done",
      };
    });

  const actual: TimelineBlock[] = input.entries
    .filter((entry) => {
      const end = entry.endedAt ?? input.now;
      return end > windowStart && entry.startedAt < windowEnd;
    })
    .map((entry) => {
      const end = entry.endedAt ?? input.now;
      const { topPct, heightPct } = position(entry.startedAt, end);
      return {
        id: entry.id,
        title: entry.label,
        detail: entry.endedAt
          ? `${formatShort(entry.startedAt)}–${formatShort(entry.endedAt)}`
          : `${formatShort(entry.startedAt)} – now`,
        color: categoryColor(entry.category),
        topPct,
        heightPct,
        running: !entry.endedAt,
        muted: false,
      };
    });

  const hourCount = endHour - startHour;
  const step = hourCount > 12 ? 2 : 1;
  const hourMarks: TimelineHourMark[] = [];
  for (let hour = startHour; hour <= endHour; hour += step) {
    const at = new Date(dayStart.getTime() + hour * 3_600_000);
    hourMarks.push({
      hour,
      label: at.toLocaleTimeString([], { hour: "numeric" }),
      topPct: clampPct(((hour - startHour) / hourCount) * 100),
    });
  }

  const nowPct =
    input.now >= windowStart && input.now <= windowEnd
      ? clampPct(
          ((input.now.getTime() - windowStart.getTime()) / windowMs) * 100,
        )
      : null;

  return { windowStart, windowEnd, hourMarks, planned, actual, nowPct };
}
