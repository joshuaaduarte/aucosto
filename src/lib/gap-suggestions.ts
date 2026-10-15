// One-tap fills for an untracked gap.
//
// Why this file exists: the gap card's three paths (one entry / split /
// still doing it) each open a form, so recovering a gap cost three taps plus
// typing — and ~45% of entries are written after the fact. Most gaps have an
// obvious answer the app already knows, so we offer it as a single button:
//   1. plan     — a calendar/plan block overlapping the gap ("On your plan").
//   2. continue — the entry right before the gap just kept going.
//   3. usual    — what the history says usually fills this time of day.
//
// No DB access — importable from anywhere. Tested in tests/gap-suggestions.test.ts.

export type GapFillKind = "plan" | "continue" | "usual";

export type GapFillSuggestion = {
  key: string;
  kind: GapFillKind;
  label: string;
  category: string | null;
  /** The span this fill covers — a plan block only covers its overlap. */
  start: Date;
  end: Date;
  /** "continue" extends this entry instead of creating a new one. */
  extendEntryId?: string;
  /** Short why-line shown under the label. */
  reason: string;
};

export type GapPlannedBlock = {
  id: string;
  title: string;
  startsAt: Date;
  endsAt: Date;
  status: string;
  allDay: boolean;
  /** Resolved time-category name, when the block carries one. */
  category?: string | null;
};

export type GapPreviousEntry = {
  id: string;
  label: string;
  category: string | null;
  endedAt: Date | null;
};

export type GapHistoryEntry = {
  label: string;
  category: string | null;
  startedAt: Date;
  endedAt: Date | null;
};

const MINUTE = 60_000;
/** A plan block must overlap the gap at least this much to be offered. */
const MIN_PLAN_OVERLAP_MINUTES = 10;
/** "Kept going" stops being plausible past this — nobody forgets a 5h stop. */
const MAX_CONTINUE_MINUTES = 3 * 60;
/** "Usual" needs this many distinct past days doing the same thing. */
const MIN_USUAL_DAYS = 2;
/** …and on average must cover this share of the gap on those days. */
const MIN_USUAL_COVERAGE = 0.25;

function overlapMs(aStart: number, aEnd: number, bStart: number, bEnd: number) {
  return Math.max(0, Math.min(aEnd, bEnd) - Math.max(aStart, bStart));
}

function minutesOfDay(date: Date) {
  return date.getHours() * 60 + date.getMinutes();
}

function dayKey(date: Date) {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function isWeekend(date: Date) {
  return date.getDay() === 0 || date.getDay() === 6;
}

function labelKey(label: string) {
  return label.trim().toLowerCase();
}

/** Most recent category used with this label — so a plan block without a
 *  mapped category still lands in the bucket it's normally tracked under. */
function categoryForLabel(label: string, history: GapHistoryEntry[]): string | null {
  const key = labelKey(label);
  let best: GapHistoryEntry | null = null;
  for (const entry of history) {
    if (!entry.category || labelKey(entry.label) !== key) continue;
    if (!best || entry.startedAt > best.startedAt) best = entry;
  }
  return best?.category ?? null;
}

function planSuggestions(
  gap: { start: Date; end: Date },
  blocks: GapPlannedBlock[],
  history: GapHistoryEntry[],
): GapFillSuggestion[] {
  const gapStart = gap.start.getTime();
  const gapEnd = gap.end.getTime();
  return blocks
    .filter((block) => !block.allDay && block.status !== "cancelled")
    .map((block) => ({
      block,
      overlap: overlapMs(gapStart, gapEnd, block.startsAt.getTime(), block.endsAt.getTime()),
    }))
    .filter(({ overlap }) => overlap >= MIN_PLAN_OVERLAP_MINUTES * MINUTE)
    .sort((a, b) => b.overlap - a.overlap)
    .slice(0, 2)
    .map(({ block }) => ({
      key: `plan:${block.id}`,
      kind: "plan" as const,
      label: block.title,
      category: block.category ?? categoryForLabel(block.title, history),
      start: new Date(Math.max(gapStart, block.startsAt.getTime())),
      end: new Date(Math.min(gapEnd, block.endsAt.getTime())),
      reason: "On your plan",
    }));
}

function continueSuggestion(
  gap: { start: Date; end: Date },
  previous: GapPreviousEntry | null | undefined,
): GapFillSuggestion | null {
  if (!previous?.endedAt) return null;
  // Only when the gap starts where this entry stopped (a wake-anchored gap
  // starts at wake-up, and "kept going" through the night makes no sense).
  if (Math.abs(previous.endedAt.getTime() - gap.start.getTime()) > MINUTE) return null;
  const gapMinutes = (gap.end.getTime() - gap.start.getTime()) / MINUTE;
  if (gapMinutes > MAX_CONTINUE_MINUTES) return null;
  return {
    key: `continue:${previous.id}`,
    kind: "continue",
    label: previous.label,
    category: previous.category,
    start: gap.start,
    end: gap.end,
    extendEntryId: previous.id,
    reason: "Kept going",
  };
}

/**
 * What usually fills this time of day: project the gap's clock window onto
 * each past day of the same kind (weekday vs weekend) and total how much of
 * it each label covered. The winner must recur on several days and cover a
 * real share of the window, or it's noise.
 */
function usualSuggestion(
  gap: { start: Date; end: Date },
  history: GapHistoryEntry[],
): GapFillSuggestion | null {
  const gapMinutes = (gap.end.getTime() - gap.start.getTime()) / MINUTE;
  if (gapMinutes <= 0) return null;
  const windowStart = minutesOfDay(gap.start);
  // A gap that crosses midnight is matched on its same-day part only.
  const windowEnd = Math.min(24 * 60, windowStart + gapMinutes);
  const windowMinutes = windowEnd - windowStart;
  if (windowMinutes <= 0) return null;

  const gapDay = dayKey(gap.start);
  const weekend = isWeekend(gap.start);
  const tally = new Map<
    string,
    { label: string; category: string | null; minutes: number; days: Set<string>; latest: Date }
  >();

  for (const entry of history) {
    if (!entry.endedAt || !entry.label.trim()) continue;
    if (dayKey(entry.startedAt) === gapDay) continue;
    if (isWeekend(entry.startedAt) !== weekend) continue;
    const start = minutesOfDay(entry.startedAt);
    const durationMinutes = (entry.endedAt.getTime() - entry.startedAt.getTime()) / MINUTE;
    const end = Math.min(24 * 60, start + durationMinutes);
    const covered = Math.max(0, Math.min(end, windowEnd) - Math.max(start, windowStart));
    if (covered <= 0) continue;

    const key = labelKey(entry.label);
    const row = tally.get(key) ?? {
      label: entry.label,
      category: entry.category,
      minutes: 0,
      days: new Set<string>(),
      latest: entry.startedAt,
    };
    row.minutes += covered;
    row.days.add(dayKey(entry.startedAt));
    if (entry.startedAt >= row.latest) {
      row.latest = entry.startedAt;
      row.label = entry.label;
      row.category = entry.category;
    }
    tally.set(key, row);
  }

  const best = [...tally.values()]
    .filter((row) => row.days.size >= MIN_USUAL_DAYS)
    .filter((row) => row.minutes / row.days.size >= windowMinutes * MIN_USUAL_COVERAGE)
    .sort((a, b) => b.minutes - a.minutes)[0];
  if (!best) return null;

  return {
    key: `usual:${labelKey(best.label)}`,
    kind: "usual",
    label: best.label,
    category: best.category,
    start: gap.start,
    end: gap.end,
    reason: `Usual at this time · ${best.days.size} days`,
  };
}

/**
 * Up to `limit` one-tap fills for a gap, most specific first (plan, then
 * continue, then usual), deduped by label so the same activity never shows
 * twice.
 */
export function suggestGapFills(input: {
  gap: { start: Date; end: Date };
  plannedBlocks?: GapPlannedBlock[];
  previousEntry?: GapPreviousEntry | null;
  history?: GapHistoryEntry[];
  limit?: number;
}): GapFillSuggestion[] {
  const history = input.history ?? [];
  const candidates: (GapFillSuggestion | null)[] = [
    ...planSuggestions(input.gap, input.plannedBlocks ?? [], history),
    continueSuggestion(input.gap, input.previousEntry),
    usualSuggestion(input.gap, history),
  ];

  const seen = new Set<string>();
  const out: GapFillSuggestion[] = [];
  for (const candidate of candidates) {
    if (!candidate) continue;
    const key = labelKey(candidate.label);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(candidate);
  }
  return out.slice(0, input.limit ?? 3);
}
