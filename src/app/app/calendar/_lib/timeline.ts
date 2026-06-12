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
  /** Horizontal slot within the lane — overlapping blocks split into
      side-by-side sub-columns (Google Calendar style). Full-width blocks
      get leftPct 0 / widthPct 100. */
  leftPct: number;
  widthPct: number;
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
  /** Read-only rhythm context (sleep / morning) behind the tracked lane. */
  context: TimelineBlock[];
  nowPct: number | null;
};

/** Soft, read-only context colors for rhythm sessions on the timeline. */
const RHYTHM_CONTEXT_COLOR: Record<string, string> = {
  sleep: "#94a3b8", // slate — a light gray block
  wakeup: "#f59e0b", // amber — the morning routine
};

const MIN_START_HOUR = 7;
const MIN_END_HOUR = 22;

/**
 * Blocks occupy at least this many minutes of vertical space so short
 * entries stay readable and tappable (~16px at the component's 44px/hour
 * scale). The inflation happens in the TIME domain, before overlap
 * detection — so back-to-back short entries that would visually collide
 * are treated as overlapping and split into sub-columns instead of
 * painting over each other.
 */
const MIN_BLOCK_MINUTES = 22;

type LaneInterval<T> = {
  data: T;
  startMs: number;
  endMs: number;
};

type LanePlacement<T> = {
  data: T;
  topPct: number;
  heightPct: number;
  leftPct: number;
  widthPct: number;
};

/**
 * Assign vertical positions plus side-by-side sub-columns for a lane.
 * Greedy interval-graph coloring: blocks are clustered while their
 * (min-height-inflated) spans chain-overlap; within a cluster each block
 * takes the first free column, and every block in the cluster shares the
 * cluster's column count for its width.
 */
function layoutLane<T>(
  intervals: LaneInterval<T>[],
  windowStartMs: number,
  windowMs: number,
): LanePlacement<T>[] {
  const minMs = MIN_BLOCK_MINUTES * 60_000;
  const sorted = [...intervals].sort(
    (a, b) => a.startMs - b.startMs || a.endMs - b.endMs,
  );

  type Working = {
    interval: LaneInterval<T>;
    effEndMs: number;
    col: number;
    cols: number;
  };
  const placed: Working[] = [];
  let cluster: Working[] = [];
  let columnEnds: number[] = [];

  const closeCluster = () => {
    const cols = Math.max(1, columnEnds.length);
    for (const block of cluster) block.cols = cols;
    cluster = [];
    columnEnds = [];
  };

  for (const interval of sorted) {
    const effEndMs = Math.max(interval.endMs, interval.startMs + minMs);
    if (
      columnEnds.length > 0 &&
      columnEnds.every((end) => end <= interval.startMs)
    ) {
      closeCluster();
    }
    let col = columnEnds.findIndex((end) => end <= interval.startMs);
    if (col === -1) {
      col = columnEnds.length;
      columnEnds.push(effEndMs);
    } else {
      columnEnds[col] = effEndMs;
    }
    const block: Working = { interval, effEndMs, col, cols: 1 };
    placed.push(block);
    cluster.push(block);
  }
  closeCluster();

  return placed.map((block) => {
    const topPct = clampPct(
      ((block.interval.startMs - windowStartMs) / windowMs) * 100,
    );
    const bottomPct = clampPct(
      ((Math.min(block.effEndMs, windowStartMs + windowMs) - windowStartMs) /
        windowMs) *
        100,
    );
    const widthPct = 100 / block.cols;
    return {
      data: block.interval.data,
      topPct,
      heightPct: Math.max(bottomPct - topPct, 1.5),
      leftPct: block.col * widthPct,
      widthPct,
    };
  });
}

type PlannedInput = Pick<
  CalendarItem,
  "id" | "title" | "startsAt" | "endsAt" | "allDay" | "status" | "kind"
> & { sourceTool?: string | null };

type ActualInput = Pick<
  TimeEntry,
  "id" | "label" | "category" | "startedAt" | "endedAt"
>;

type RhythmInput = {
  id: string;
  type: string;
  startedAt: Date;
  endedAt: Date | null;
};

function formatShort(date: Date): string {
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function clampPct(value: number): number {
  return Math.min(100, Math.max(0, value));
}

export function buildDayTimeline(input: {
  items: PlannedInput[];
  entries: ActualInput[];
  rhythms?: RhythmInput[];
  day: Date;
  now: Date;
}): DayTimelineModel {
  const dayStart = new Date(input.day);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(dayStart);
  dayEnd.setDate(dayEnd.getDate() + 1);

  const timed = input.items.filter((item) => !item.allDay);
  const rhythms = input.rhythms ?? [];

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
  for (const rhythm of rhythms) {
    consider(rhythm.startedAt, rhythm.endedAt ?? input.now);
  }
  startHour = Math.max(0, startHour);
  endHour = Math.min(24, Math.max(endHour, startHour + 1));

  const windowStart = new Date(dayStart);
  windowStart.setHours(startHour, 0, 0, 0);
  const windowEnd = new Date(dayStart);
  windowEnd.setHours(0, 0, 0, 0);
  windowEnd.setTime(dayStart.getTime() + endHour * 3_600_000);
  const windowMs = windowEnd.getTime() - windowStart.getTime();

  const windowStartMs = windowStart.getTime();
  const clip = (start: Date, end: Date) => ({
    startMs: Math.max(start.getTime(), windowStartMs),
    endMs: Math.min(end.getTime(), windowEnd.getTime()),
  });

  const planned: TimelineBlock[] = layoutLane(
    timed
      .filter((item) => item.endsAt > windowStart && item.startsAt < windowEnd)
      .map((item) => ({ data: item, ...clip(item.startsAt, item.endsAt) })),
    windowStartMs,
    windowMs,
  ).map(({ data: item, ...placement }) => ({
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
    ...placement,
    running: false,
    muted: item.status === "done",
  }));

  const actual: TimelineBlock[] = layoutLane(
    input.entries
      .filter((entry) => {
        const end = entry.endedAt ?? input.now;
        return end > windowStart && entry.startedAt < windowEnd;
      })
      .map((entry) => ({
        data: entry,
        ...clip(entry.startedAt, entry.endedAt ?? input.now),
      })),
    windowStartMs,
    windowMs,
  ).map(({ data: entry, ...placement }) => ({
    id: entry.id,
    title: entry.label,
    detail: entry.endedAt
      ? `${formatShort(entry.startedAt)}–${formatShort(entry.endedAt)}`
      : `${formatShort(entry.startedAt)} – now`,
    color: categoryColor(entry.category),
    ...placement,
    running: !entry.endedAt,
    muted: false,
  }));

  // Rhythm context: sleep / morning sessions as soft, read-only blocks that
  // sit behind the tracked lane. Clipped to the window, never interactive.
  const context: TimelineBlock[] = layoutLane(
    rhythms
      .filter((rhythm) => {
        const end = rhythm.endedAt ?? input.now;
        return end > windowStart && rhythm.startedAt < windowEnd;
      })
      .map((rhythm) => ({
        data: rhythm,
        ...clip(rhythm.startedAt, rhythm.endedAt ?? input.now),
      })),
    windowStartMs,
    windowMs,
  ).map(({ data: rhythm, ...placement }) => ({
    id: `rhythm-${rhythm.id}`,
    title: rhythm.type === "sleep" ? "Sleep" : "Morning",
    detail: `${formatShort(rhythm.startedAt)}–${formatShort(rhythm.endedAt ?? input.now)}`,
    color: RHYTHM_CONTEXT_COLOR[rhythm.type] ?? categoryColor(null),
    // Context spans the full lane width — it's a backdrop, not a column.
    topPct: placement.topPct,
    heightPct: placement.heightPct,
    leftPct: 0,
    widthPct: 100,
    running: rhythm.endedAt === null,
    muted: true,
  }));

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

  return { windowStart, windowEnd, hourMarks, planned, actual, context, nowPct };
}
