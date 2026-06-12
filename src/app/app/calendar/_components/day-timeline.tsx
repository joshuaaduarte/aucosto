"use client";

// Planned vs actual on a shared hour axis. One day = one column (planned +
// tracked lanes); the 2D/3D/W views simply render the same column N times
// against one shared y-axis. All positioning math lives in ../_lib/timeline.ts
// (pure, tested); drag-to-create lives in ./timeline-lane.tsx.

import { useEffect, useState } from "react";
import Link from "next/link";
import type { LinkableTask } from "../../time/entry-editor";
import type { DayTimelineModel } from "../_lib/timeline";
import { TimelineLane } from "./timeline-lane";
import type { TimelineBlockPayload } from "./timeline-block";
import { ViewSelector, type CalendarView } from "./view-selector";

const PX_PER_HOUR = 44;
const HEADER_PX = 26;

export type CalendarColumn = {
  /** YYYY-MM-DD for this column. */
  dayIso: string;
  weekday: string; // "Fri"
  dayNum: number; // 13
  isToday: boolean;
  model: DayTimelineModel;
};

export type CalendarTimelineNav = {
  prevHref: string;
  nextHref: string;
  todayHref: string;
  rangeLabel: string;
  isToday: boolean;
};

export function CalendarTimeline({
  view,
  hasExplicitView,
  anchorDay,
  columns,
  payloads,
  tasks,
  nav,
}: {
  view: CalendarView;
  hasExplicitView: boolean;
  anchorDay: string;
  columns: CalendarColumn[];
  payloads: Record<string, TimelineBlockPayload>;
  tasks: LinkableTask[];
  nav: CalendarTimelineNav;
}) {
  // Week view is too dense for phones: fall back to 3 columns + a hint.
  const [isNarrow, setIsNarrow] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 1023px)");
    const update = () => setIsNarrow(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  const weekOnPhone = view === "w" && isNarrow;
  const displayColumns = weekOnPhone ? columns.slice(0, 3) : columns;
  const multiDay = displayColumns.length > 1;

  const base = displayColumns[0]?.model;
  const hours = base
    ? (base.windowEnd.getTime() - base.windowStart.getTime()) / 3_600_000
    : 15;
  const height = Math.round(hours * PX_PER_HOUR);
  const hourMarks = base?.hourMarks ?? [];

  return (
    <section
      className="rounded-md border p-4 sm:p-5"
      style={{ borderColor: "var(--border-soft)", background: "var(--bg-page)" }}
    >
      <header className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p
            className="text-[0.6875rem] font-semibold uppercase tracking-wider"
            style={{ color: "var(--text-faint)" }}
          >
            Plan vs actual
          </p>
          <h2
            className="mt-1 text-[1.0625rem] font-semibold tracking-tight"
            style={{ color: "var(--text)" }}
          >
            {nav.isToday && view === "1d"
              ? "How today is really going"
              : nav.rangeLabel}
          </h2>
        </div>

        <div className="flex items-center gap-2">
          <ViewSelector
            view={view}
            anchorDay={anchorDay}
            hasExplicitView={hasExplicitView}
          />
          <div className="flex items-center gap-1.5">
            <Link
              href={nav.prevHref}
              aria-label="Previous"
              className="btn-icon rounded-md border"
              style={{ borderColor: "var(--border-faint)" }}
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M7.5 2.5 4 6l3.5 3.5" />
              </svg>
            </Link>
            <Link
              href={nav.nextHref}
              aria-label="Next"
              className="btn-icon rounded-md border"
              style={{ borderColor: "var(--border-faint)" }}
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M4.5 2.5 8 6 4.5 9.5" />
              </svg>
            </Link>
            {!nav.isToday ? (
              <Link href={nav.todayHref} className="btn-ghost h-8 px-2.5 text-[0.75rem]">
                Today
              </Link>
            ) : null}
          </div>
        </div>
      </header>

      {weekOnPhone ? (
        <p
          className="mb-3 rounded-md px-3 py-2 text-[0.75rem]"
          style={{ background: "var(--bg-tint)", color: "var(--text-muted)" }}
        >
          Week view works best on larger screens — showing 3 days here.
        </p>
      ) : null}

      <div className="flex gap-2 sm:gap-3">
        {/* Shared hour axis. The matching p-1 keeps its labels aligned with the
            day columns, which carry p-1 for the today-highlight halo. */}
        <div className="flex shrink-0 flex-col p-1" style={{ width: "2.5rem" }}>
          <div style={{ height: HEADER_PX }} />
          <div className="relative" style={{ height }}>
            {hourMarks.map((mark) => (
              <span
                key={mark.hour}
                className="absolute right-1 -translate-y-1/2 text-[0.625rem] tabular"
                style={{ top: `${mark.topPct}%`, color: "var(--text-faint)" }}
              >
                {mark.label}
              </span>
            ))}
          </div>
        </div>

        {/* Day columns. */}
        <div
          className="grid min-w-0 flex-1 gap-2 sm:gap-3"
          style={{
            gridTemplateColumns: `repeat(${displayColumns.length}, minmax(0, 1fr))`,
          }}
        >
          {displayColumns.map((column) => (
            <DayColumn
              key={column.dayIso}
              column={column}
              height={height}
              hourMarks={hourMarks}
              multiDay={multiDay}
              payloads={payloads}
              tasks={tasks}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

function DayColumn({
  column,
  height,
  hourMarks,
  multiDay,
  payloads,
  tasks,
}: {
  column: CalendarColumn;
  height: number;
  hourMarks: DayTimelineModel["hourMarks"];
  multiDay: boolean;
  payloads: Record<string, TimelineBlockPayload>;
  tasks: LinkableTask[];
}) {
  const { model, isToday } = column;
  const windowStartIso = model.windowStart.toISOString();
  const windowEndIso = model.windowEnd.toISOString();

  return (
    <div
      className="flex min-w-0 flex-col rounded-lg p-1"
      style={{
        background: isToday
          ? "color-mix(in srgb, var(--accent) 8%, transparent)"
          : undefined,
      }}
    >
      <div style={{ height: HEADER_PX }} className="flex items-end">
        {multiDay ? (
          <div className="flex w-full items-baseline justify-center gap-1">
            <span
              className="text-[0.625rem] font-semibold uppercase tracking-wider"
              style={{ color: isToday ? "var(--accent-strong)" : "var(--text-faint)" }}
            >
              {column.weekday}
            </span>
            <span
              className="text-[0.8125rem] font-semibold tabular"
              style={{ color: isToday ? "var(--accent-strong)" : "var(--text)" }}
            >
              {column.dayNum}
            </span>
          </div>
        ) : (
          <div className="grid w-full grid-cols-2 items-end gap-1.5">
            <p
              className="text-[0.625rem] font-semibold uppercase tracking-wider"
              style={{ color: "var(--text-faint)" }}
            >
              Planned
            </p>
            <p
              className="text-[0.625rem] font-semibold uppercase tracking-wider"
              style={{ color: "var(--text-faint)" }}
            >
              Tracked
            </p>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-1.5">
        <TimelineLane
          blocks={model.planned}
          hourMarks={hourMarks}
          windowStartIso={windowStartIso}
          windowEndIso={windowEndIso}
          height={height}
          variant="planned"
          payloads={payloads}
          tasks={tasks}
        />
        <TimelineLane
          blocks={model.actual}
          hourMarks={hourMarks}
          windowStartIso={windowStartIso}
          windowEndIso={windowEndIso}
          height={height}
          variant="actual"
          payloads={payloads}
          tasks={tasks}
          context={model.context}
          enableCreate
        />
      </div>
    </div>
  );
}
