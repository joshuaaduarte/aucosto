"use client";

// Planned vs actual on a shared hour axis. One day = one column (planned +
// tracked lanes); the 2D/3D/W views simply render the same column N times
// against one shared y-axis. All positioning math lives in ../_lib/timeline.ts
// (pure, tested); drag-to-create lives in ./timeline-lane.tsx.

import {
  type PointerEvent as ReactPointerEvent,
  useEffect,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { LinkableTask } from "../../time/entry-editor";
import type { DayTimelineModel } from "../_lib/timeline";
import { TimelineLane } from "./timeline-lane";
import type { TimelineBlockPayload } from "./timeline-block";
import { ViewSelector, type CalendarView } from "./view-selector";
import { MobileDateStrip } from "./mobile-date-strip";

const PX_PER_HOUR = 44;
const HEADER_PX = 26;
const SWIPE_THRESHOLD = 40; // px of horizontal travel before a swipe commits
const SWIPE_NUDGE = 36; // px the timeline slides on a committed swipe

function shiftIso(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + days);
  return d.toLocaleDateString("en-CA"); // YYYY-MM-DD, local
}

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
  today,
  columns,
  payloads,
  tasks,
  nav,
}: {
  view: CalendarView;
  hasExplicitView: boolean;
  anchorDay: string;
  /** Today, YYYY-MM-DD — drives the mobile date strip's dot indicator. */
  today: string;
  columns: CalendarColumn[];
  payloads: Record<string, TimelineBlockPayload>;
  tasks: LinkableTask[];
  nav: CalendarTimelineNav;
}) {
  const router = useRouter();

  // Week view is too dense for phones: fall back to 3 columns + a hint.
  const [isNarrow, setIsNarrow] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 1023px)");
    const update = () => setIsNarrow(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  // Mobile (< md): always single-day, no view selector, swipe-navigable.
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  // Touch devices get swipe-to-navigate; mouse devices keep drag-to-create.
  const [isTouch, setIsTouch] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(pointer: coarse)");
    const update = () => setIsTouch(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  const prevDayHref = `/app/calendar?view=1d&day=${shiftIso(anchorDay, -1)}`;
  const nextDayHref = `/app/calendar?view=1d&day=${shiftIso(anchorDay, 1)}`;
  const todayDayHref = `/app/calendar?view=1d`;
  const mobileLabel =
    anchorDay === today
      ? "Today"
      : new Date(`${anchorDay}T00:00:00`).toLocaleDateString([], {
          weekday: "short",
          month: "short",
          day: "numeric",
        });

  // Swipe-to-navigate (touch only). We follow the finger (dampened) on the
  // horizontal axis and commit a day change past the threshold; vertical
  // gestures fall through to normal page scroll (touch-action: pan-y).
  const [dragX, setDragX] = useState(0);
  const [transitionOn, setTransitionOn] = useState(false);
  const startRef = useRef<{ x: number; y: number } | null>(null);
  const axisRef = useRef<"h" | "v" | null>(null);
  const pendingDirRef = useRef(0);

  // After a committed swipe re-renders with the new day, slide it in from the
  // opposite edge for a subtle hint of motion.
  useEffect(() => {
    const dir = pendingDirRef.current;
    if (dir === 0) return;
    pendingDirRef.current = 0;
    setTransitionOn(false);
    setDragX(-dir * SWIPE_NUDGE);
    const id = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setTransitionOn(true);
        setDragX(0);
      });
    });
    return () => cancelAnimationFrame(id);
  }, [anchorDay]);

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!isTouch) return;
    startRef.current = { x: e.clientX, y: e.clientY };
    axisRef.current = null;
    setTransitionOn(false);
  };
  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!startRef.current) return;
    const dx = e.clientX - startRef.current.x;
    const dy = e.clientY - startRef.current.y;
    if (axisRef.current === null && (Math.abs(dx) > 8 || Math.abs(dy) > 8)) {
      axisRef.current = Math.abs(dx) > Math.abs(dy) * 1.5 ? "h" : "v";
    }
    if (axisRef.current === "h") {
      const followed = dx * 0.35;
      setDragX(Math.max(-60, Math.min(60, followed)));
    }
  };
  const onPointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!startRef.current) return;
    const dx = e.clientX - startRef.current.x;
    const dy = e.clientY - startRef.current.y;
    const wasHorizontal = axisRef.current === "h";
    startRef.current = null;
    axisRef.current = null;
    setTransitionOn(true);
    if (
      wasHorizontal &&
      Math.abs(dx) > SWIPE_THRESHOLD &&
      Math.abs(dx) > Math.abs(dy) * 1.5
    ) {
      const dir = dx < 0 ? -1 : 1; // left swipe → next day, right → previous
      pendingDirRef.current = dir;
      setDragX(dir * SWIPE_NUDGE);
      router.push(dir < 0 ? nextDayHref : prevDayHref);
    } else {
      setDragX(0); // snap back
    }
  };

  const weekOnPhone = view === "w" && isNarrow && !isMobile;
  const displayColumns = isMobile
    ? columns.slice(0, 1)
    : weekOnPhone
      ? columns.slice(0, 3)
      : columns;
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
            <span className="md:hidden">{mobileLabel}</span>
            <span className="hidden md:inline">
              {nav.isToday && view === "1d"
                ? "How today is really going"
                : nav.rangeLabel}
            </span>
          </h2>
        </div>

        <div className="flex items-center gap-2">
          {/* View selector — tablet/desktop only; mobile is always single-day. */}
          <div className="hidden md:block">
            <ViewSelector
              view={view}
              anchorDay={anchorDay}
              hasExplicitView={hasExplicitView}
            />
          </div>

          {/* Desktop nav: steps by the active view's span. */}
          <div className="hidden items-center gap-1.5 md:flex">
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

          {/* Mobile nav: steps one day at a time, forcing single-day view. */}
          <div className="flex items-center gap-1.5 md:hidden">
            <Link
              href={prevDayHref}
              aria-label="Previous day"
              className="btn-icon rounded-md border"
              style={{ borderColor: "var(--border-faint)" }}
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M7.5 2.5 4 6l3.5 3.5" />
              </svg>
            </Link>
            <Link
              href={nextDayHref}
              aria-label="Next day"
              className="btn-icon rounded-md border"
              style={{ borderColor: "var(--border-faint)" }}
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M4.5 2.5 8 6 4.5 9.5" />
              </svg>
            </Link>
            {anchorDay !== today ? (
              <Link href={todayDayHref} className="btn-ghost h-8 px-2.5 text-[0.75rem]">
                Today
              </Link>
            ) : null}
          </div>
        </div>
      </header>

      <MobileDateStrip anchorDay={anchorDay} today={today} />

      {weekOnPhone ? (
        <p
          className="mb-3 rounded-md px-3 py-2 text-[0.75rem]"
          style={{ background: "var(--bg-tint)", color: "var(--text-muted)" }}
        >
          Week view works best on larger screens — showing 3 days here.
        </p>
      ) : null}

      <div
        className="flex gap-2 sm:gap-3"
        onPointerDown={isTouch ? onPointerDown : undefined}
        onPointerMove={isTouch ? onPointerMove : undefined}
        onPointerUp={isTouch ? onPointerUp : undefined}
        onPointerCancel={
          isTouch
            ? () => {
                startRef.current = null;
                axisRef.current = null;
                setTransitionOn(true);
                setDragX(0);
              }
            : undefined
        }
        style={{
          touchAction: isTouch ? "pan-y" : undefined,
          transform: dragX ? `translateX(${dragX}px)` : undefined,
          transition: transitionOn ? "transform 150ms ease-out" : "none",
        }}
      >
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
              allowCreate={!isTouch}
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
  allowCreate,
  payloads,
  tasks,
}: {
  column: CalendarColumn;
  height: number;
  hourMarks: DayTimelineModel["hourMarks"];
  multiDay: boolean;
  /** Drag-to-create on the tracked lane (mouse/desktop only). */
  allowCreate: boolean;
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
          enableCreate={allowCreate}
        />
      </div>
    </div>
  );
}
