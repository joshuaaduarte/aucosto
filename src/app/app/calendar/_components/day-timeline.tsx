"use client";

// Planned vs actual on a shared hour axis. One day = one column (planned +
// tracked lanes); the 2D/3D/W views simply render the same column N times
// against one shared y-axis. All positioning math lives in ../_lib/timeline.ts
// (pure, tested); drag-to-create lives in ./timeline-lane.tsx.

import {
  type PointerEvent as ReactPointerEvent,
  useEffect,
  useLayoutEffect,
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
// Ease-out-quad: snappy without being abrupt. Used for both commit + snap-back.
const SWIPE_TRANSITION = "transform 280ms cubic-bezier(0.25, 0.46, 0.45, 0.94)";

// Mobile pager: a 3-wide track (prev · current · next), each panel 1/3 of the
// track. Centring the current panel parks the track at -1/3 of its own width.
const PAGER_CENTER = "translateX(-33.3333%)";
const PAGER_PREV = "translateX(0)";
const PAGER_NEXT = "translateX(-66.6667%)";

// useLayoutEffect warns during SSR; this client component is server-rendered,
// so fall back to useEffect on the server and use the layout variant in the
// browser (needed: the pager re-centres synchronously, before paint).
const useIsoLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

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
  mobilePanels,
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
  /** Mobile-only triple-panel pager: [previous, current, next] day, sharing
      one y-axis so swipes between them are instant and pre-rendered. */
  mobilePanels: CalendarColumn[];
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

  // Swipe-to-navigate (touch only). The drag is driven by *direct DOM
  // mutation* — never React state — so the finger-follow runs at 60fps on the
  // compositor with zero re-renders. Vertical gestures fall through to normal
  // page scroll (touch-action: pan-y). Sign convention: a left swipe (dx < 0)
  // goes to the next day; right swipe to the previous.
  const swipeRef = useRef<HTMLDivElement>(null);
  const startRef = useRef<{ x: number; y: number } | null>(null);
  const axisRef = useRef<"h" | "v" | null>(null);
  const pendingDirRef = useRef(0);
  const animatingRef = useRef(false);

  // After a committed swipe navigates and the new day's content mounts, slide
  // it in from the parked off-screen edge for a true pager feel.
  useEffect(() => {
    const dir = pendingDirRef.current;
    if (dir === 0) return;
    pendingDirRef.current = 0;
    const el = swipeRef.current;
    if (!el) {
      animatingRef.current = false;
      return;
    }
    // el is parked at ±100% (off-screen, holding the freshly-mounted day).
    // Two frames of settle, then transition it home.
    const raf = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        el.style.transition = SWIPE_TRANSITION;
        el.style.transform = "translateX(0)";
      });
    });
    const settle = (event: TransitionEvent) => {
      if (event.target !== el || event.propertyName !== "transform") return;
      el.removeEventListener("transitionend", settle);
      el.style.transition = "none";
      el.style.transform = "translateX(0)";
      animatingRef.current = false;
    };
    el.addEventListener("transitionend", settle);
    return () => {
      cancelAnimationFrame(raf);
      el.removeEventListener("transitionend", settle);
    };
  }, [anchorDay]);

  // Warm the adjacent days so a committed swipe lands with minimal blank.
  useEffect(() => {
    if (!isTouch) return;
    router.prefetch(prevDayHref);
    router.prefetch(nextDayHref);
  }, [isTouch, prevDayHref, nextDayHref, router]);

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!isTouch || animatingRef.current) return;
    startRef.current = { x: e.clientX, y: e.clientY };
    axisRef.current = null;
    const el = swipeRef.current;
    if (el) el.style.transition = "none"; // follow the finger 1:1, no easing
  };
  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!startRef.current) return;
    const dx = e.clientX - startRef.current.x;
    const dy = e.clientY - startRef.current.y;
    if (axisRef.current === null && (Math.abs(dx) > 8 || Math.abs(dy) > 8)) {
      axisRef.current = Math.abs(dx) > Math.abs(dy) * 1.5 ? "h" : "v";
    }
    if (axisRef.current === "h") {
      const el = swipeRef.current;
      if (el) el.style.transform = `translateX(${dx}px)`; // direct DOM, no setState
    }
  };
  const onPointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!startRef.current) return;
    const dx = e.clientX - startRef.current.x;
    const dy = e.clientY - startRef.current.y;
    const wasHorizontal = axisRef.current === "h";
    startRef.current = null;
    axisRef.current = null;
    const el = swipeRef.current;
    if (!el) return;

    const committed =
      wasHorizontal &&
      Math.abs(dx) > SWIPE_THRESHOLD &&
      Math.abs(dx) > Math.abs(dy) * 1.5;

    if (!committed) {
      // Snap back to centre with the same easing.
      el.style.transition = SWIPE_TRANSITION;
      el.style.transform = "translateX(0)";
      return;
    }

    // Commit: slide the current day fully off-screen, then on transitionend
    // park the container on the opposite edge and navigate. The [anchorDay]
    // effect slides the new day in once it mounts.
    animatingRef.current = true;
    const dir = dx < 0 ? -1 : 1; // -1 = next day, +1 = previous day
    const outPct = dir === -1 ? -100 : 100;
    el.style.transition = SWIPE_TRANSITION;
    el.style.transform = `translateX(${outPct}%)`;
    pendingDirRef.current = dir;
    const onEnd = (event: TransitionEvent) => {
      if (event.target !== el || event.propertyName !== "transform") return;
      el.removeEventListener("transitionend", onEnd);
      el.style.transition = "none";
      el.style.transform = `translateX(${-outPct}%)`; // park opposite, off-screen
      router.push(dir === -1 ? nextDayHref : prevDayHref, { scroll: false });
    };
    el.addEventListener("transitionend", onEnd);
  };
  const onPointerCancel = () => {
    startRef.current = null;
    axisRef.current = null;
    const el = swipeRef.current;
    if (el) {
      el.style.transition = SWIPE_TRANSITION;
      el.style.transform = "translateX(0)";
    }
  };

  // ── Mobile triple-panel pager ──────────────────────────────────────────
  // prev/current/next are already rendered side by side, so a committed swipe
  // just slides the track to the neighbour (instant — no fetch). Only after the
  // slide settles do we router.push to re-hydrate fresh prev/next data; the
  // re-centre is invisible because the new centre panel holds the exact day
  // that was just slid into view.
  const pagerRef = useRef<HTMLDivElement>(null);
  const pagerStartRef = useRef<{ x: number; y: number } | null>(null);
  const pagerAxisRef = useRef<"h" | "v" | null>(null);
  const pagerAnimatingRef = useRef(false);

  // Snap the track back to centre whenever the day settles — after a committed
  // swipe's router.push lands, or after any external nav (arrows, date strip).
  // No animation: the freshly-mounted centre panel already shows the right day.
  useIsoLayoutEffect(() => {
    const el = pagerRef.current;
    if (!el) return;
    el.style.transition = "none";
    el.style.transform = PAGER_CENTER;
    pagerAnimatingRef.current = false;
  }, [anchorDay]);

  const onPagerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (pagerAnimatingRef.current) return;
    pagerStartRef.current = { x: e.clientX, y: e.clientY };
    pagerAxisRef.current = null;
    const el = pagerRef.current;
    if (el) el.style.transition = "none"; // follow the finger 1:1
  };
  const onPagerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!pagerStartRef.current) return;
    const dx = e.clientX - pagerStartRef.current.x;
    const dy = e.clientY - pagerStartRef.current.y;
    if (
      pagerAxisRef.current === null &&
      (Math.abs(dx) > 8 || Math.abs(dy) > 8)
    ) {
      pagerAxisRef.current = Math.abs(dx) > Math.abs(dy) * 1.5 ? "h" : "v";
    }
    if (pagerAxisRef.current === "h") {
      const el = pagerRef.current;
      // Centre is -33.3333% of the track's own width; offset by the px drag.
      if (el) el.style.transform = `translateX(calc(-33.3333% + ${dx}px))`;
    }
  };
  const onPagerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!pagerStartRef.current) return;
    const dx = e.clientX - pagerStartRef.current.x;
    const dy = e.clientY - pagerStartRef.current.y;
    const wasHorizontal = pagerAxisRef.current === "h";
    pagerStartRef.current = null;
    pagerAxisRef.current = null;
    const el = pagerRef.current;
    if (!el) return;

    const committed =
      wasHorizontal &&
      Math.abs(dx) > SWIPE_THRESHOLD &&
      Math.abs(dx) > Math.abs(dy) * 1.5;

    if (!committed) {
      el.style.transition = SWIPE_TRANSITION;
      el.style.transform = PAGER_CENTER;
      return;
    }

    // Commit: slide to the neighbour panel (already rendered), then on
    // transitionend re-hydrate via router.push. The [anchorDay] layout effect
    // re-centres once the new day mounts.
    pagerAnimatingRef.current = true;
    const dir = dx < 0 ? -1 : 1; // -1 = next day, +1 = previous day
    el.style.transition = SWIPE_TRANSITION;
    el.style.transform = dir === -1 ? PAGER_NEXT : PAGER_PREV;
    const onEnd = (event: TransitionEvent) => {
      if (event.target !== el || event.propertyName !== "transform") return;
      el.removeEventListener("transitionend", onEnd);
      router.push(dir === -1 ? nextDayHref : prevDayHref, { scroll: false });
    };
    el.addEventListener("transitionend", onEnd);
  };
  const onPagerCancel = () => {
    pagerStartRef.current = null;
    pagerAxisRef.current = null;
    const el = pagerRef.current;
    if (el) {
      el.style.transition = SWIPE_TRANSITION;
      el.style.transform = PAGER_CENTER;
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

  // Mobile pager axis: all three panels share one window, so the centre
  // panel's model drives the fixed hour axis on the left.
  const mobileBase = mobilePanels[1]?.model ?? mobilePanels[0]?.model;
  const mobileHours = mobileBase
    ? (mobileBase.windowEnd.getTime() - mobileBase.windowStart.getTime()) /
      3_600_000
    : 15;
  const mobileHeight = Math.round(mobileHours * PX_PER_HOUR);
  const mobileHourMarks = mobileBase?.hourMarks ?? [];

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
              scroll={false}
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
              scroll={false}
              aria-label="Next"
              className="btn-icon rounded-md border"
              style={{ borderColor: "var(--border-faint)" }}
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M4.5 2.5 8 6 4.5 9.5" />
              </svg>
            </Link>
            {!nav.isToday ? (
              <Link href={nav.todayHref} scroll={false} className="btn-ghost h-8 px-2.5 text-[0.75rem]">
                Today
              </Link>
            ) : null}
          </div>

          {/* Mobile nav: steps one day at a time, forcing single-day view. */}
          <div className="flex items-center gap-1.5 md:hidden">
            <Link
              href={prevDayHref}
              scroll={false}
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
              scroll={false}
              aria-label="Next day"
              className="btn-icon rounded-md border"
              style={{ borderColor: "var(--border-faint)" }}
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M4.5 2.5 8 6 4.5 9.5" />
              </svg>
            </Link>
            {anchorDay !== today ? (
              <Link href={todayDayHref} scroll={false} className="btn-ghost h-8 px-2.5 text-[0.75rem]">
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

      {isMobile ? (
        // Triple-panel pager: fixed hour axis on the left, a 3-wide track
        // (prev · current · next) clipped to one panel. Swipes slide the track;
        // the neighbours are pre-rendered, so there's no fetch gap.
        <div className="flex gap-2 sm:gap-3">
          <div
            className="flex shrink-0 flex-col p-1"
            style={{ width: "2.5rem" }}
          >
            <div style={{ height: HEADER_PX }} />
            <div className="relative" style={{ height: mobileHeight }}>
              {mobileHourMarks.map((mark) => (
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

          {/* overflow-clip (not -hidden): clips the 300%-wide track to one
              panel without becoming a scroll container, so the per-lane sticky
              empty-state can resolve against the page/viewport scroll. */}
          <div className="min-w-0 flex-1 overflow-clip">
            <div
              ref={pagerRef}
              className="flex"
              onPointerDown={isTouch ? onPagerDown : undefined}
              onPointerMove={isTouch ? onPagerMove : undefined}
              onPointerUp={isTouch ? onPagerUp : undefined}
              onPointerCancel={isTouch ? onPagerCancel : undefined}
              style={{
                width: "300%",
                transform: PAGER_CENTER,
                touchAction: isTouch ? "pan-y" : undefined,
                willChange: "transform",
              }}
            >
              {mobilePanels.map((panel) => (
                // Explicit 1/3-of-track width + min-w-0 so a panel can never be
                // widened by its content's min-content size (flexbox's auto
                // minimum). If panels could expand unevenly, PAGER_CENTER's
                // track-relative translate would park each day at a different
                // pixel offset — making the centred empty-state text jump
                // horizontally between swipes. The literal 33.3333% matches the
                // PAGER_* transform constants exactly (w-1/3 = 33.3333333%).
                <div
                  key={panel.dayIso}
                  className="w-[33.3333%] shrink-0 min-w-0"
                >
                  <DayColumn
                    column={panel}
                    height={mobileHeight}
                    hourMarks={mobileHourMarks}
                    multiDay={false}
                    allowCreate={false}
                    payloads={payloads}
                    tasks={tasks}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        // Clip so a committed swipe can slide the day fully off-screen.
        // overflow-clip (not -hidden) keeps this from becoming a scroll
        // container, so the sticky empty-state resolves against the viewport.
        <div className="overflow-clip">
          <div
            ref={swipeRef}
            className="flex gap-2 sm:gap-3"
            onPointerDown={isTouch ? onPointerDown : undefined}
            onPointerMove={isTouch ? onPointerMove : undefined}
            onPointerUp={isTouch ? onPointerUp : undefined}
            onPointerCancel={isTouch ? onPointerCancel : undefined}
            style={{
              touchAction: isTouch ? "pan-y" : undefined,
              willChange: isTouch ? "transform" : undefined,
            }}
          >
            {/* Shared hour axis. The matching p-1 keeps its labels aligned with
                the day columns, which carry p-1 for the today-highlight halo. */}
            <div
              className="flex shrink-0 flex-col p-1"
              style={{ width: "2.5rem" }}
            >
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
        </div>
      )}
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
