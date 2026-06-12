// Planned vs actual: today's calendar items beside today's tracked time,
// on a shared hour axis, so the plan and reality line up visually.
// All positioning math lives in ../_lib/timeline.ts (pure, tested).

import Link from "next/link";
import type { DayTimelineModel, TimelineBlock } from "../_lib/timeline";
import { TimelineNowLine } from "./timeline-now-line";

const PX_PER_HOUR = 44;

export type DayTimelineNav = {
  dayLabel: string;
  prevHref: string;
  nextHref: string;
  todayHref: string;
  isToday: boolean;
};

export function DayTimeline({
  model,
  nav,
}: {
  model: DayTimelineModel;
  nav: DayTimelineNav;
}) {
  const hours =
    (model.windowEnd.getTime() - model.windowStart.getTime()) / 3_600_000;
  const height = Math.round(hours * PX_PER_HOUR);
  const isEmpty = model.planned.length === 0 && model.actual.length === 0;

  return (
    <section
      className="rounded-md border p-4 sm:p-5"
      style={{
        borderColor: "var(--border-soft)",
        background: "var(--bg-page)",
      }}
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
            {nav.isToday ? "How today is really going" : nav.dayLabel}
          </h2>
        </div>

        <div className="flex items-center gap-1.5">
          <Link
            href={nav.prevHref}
            aria-label="Previous day"
            className="btn-icon rounded-md border"
            style={{ borderColor: "var(--border-faint)" }}
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M7.5 2.5 4 6l3.5 3.5" />
            </svg>
          </Link>
          <span
            className="min-w-[5.5rem] text-center text-[0.8125rem] font-medium tabular"
            style={{ color: "var(--text)" }}
          >
            {nav.dayLabel}
          </span>
          <Link
            href={nav.nextHref}
            aria-label="Next day"
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
      </header>

      {isEmpty ? (
        <p className="text-[0.875rem]" style={{ color: "var(--text-muted)" }}>
          Nothing planned or tracked on {nav.isToday ? "this day yet" : "this day"}.
        </p>
      ) : (
      <div className="grid grid-cols-[3rem_1fr_1fr] gap-x-2">
        <div />
        <p
          className="pb-2 text-[0.625rem] font-semibold uppercase tracking-wider"
          style={{ color: "var(--text-faint)" }}
        >
          Planned
        </p>
        <p
          className="pb-2 text-[0.625rem] font-semibold uppercase tracking-wider"
          style={{ color: "var(--text-faint)" }}
        >
          Tracked
        </p>

        {/* Hour axis */}
        <div className="relative" style={{ height }}>
          {model.hourMarks.map((mark) => (
            <span
              key={mark.hour}
              className="absolute right-1 -translate-y-1/2 text-[0.625rem] tabular"
              style={{ top: `${mark.topPct}%`, color: "var(--text-faint)" }}
            >
              {mark.label}
            </span>
          ))}
        </div>

        <TimelineLane
          blocks={model.planned}
          model={model}
          height={height}
          variant="planned"
        />
        <TimelineLane
          blocks={model.actual}
          model={model}
          height={height}
          variant="actual"
        />
      </div>
      )}
    </section>
  );
}

function TimelineLane({
  blocks,
  model,
  height,
  variant,
}: {
  blocks: TimelineBlock[];
  model: DayTimelineModel;
  height: number;
  variant: "planned" | "actual";
}) {
  return (
    <div
      className="relative overflow-hidden rounded"
      style={{ height, background: "var(--bg-tint)" }}
    >
      {model.hourMarks.map((mark) => (
        <div
          key={mark.hour}
          className="absolute inset-x-0"
          style={{
            top: `${mark.topPct}%`,
            borderTop: "1px solid var(--border-faint)",
          }}
          aria-hidden
        />
      ))}

      <TimelineNowLine
        windowStartIso={model.windowStart.toISOString()}
        windowEndIso={model.windowEnd.toISOString()}
      />

      {blocks.map((block) => {
        const blockPx = (block.heightPct / 100) * height;
        const compact = blockPx < 30;
        return (
          <article
            key={block.id}
            className="absolute overflow-hidden rounded px-1.5 py-0.5"
            style={{
              top: `${block.topPct}%`,
              height: `${block.heightPct}%`,
              // Sub-columns: overlapping blocks sit side by side with a
              // 2px gutter instead of painting over each other.
              left: `calc(${block.leftPct}% + 4px)`,
              width: `calc(${block.widthPct}% - 8px)`,
              minHeight: "15px",
              background:
                variant === "actual"
                  ? `color-mix(in srgb, ${block.color} 22%, var(--bg-page))`
                  : "var(--bg-page)",
              borderLeft: `3px solid ${block.color}`,
              border:
                variant === "planned"
                  ? "1px solid var(--border-soft)"
                  : undefined,
              borderLeftWidth: "3px",
              borderLeftStyle: "solid",
              borderLeftColor: block.color,
              opacity: block.muted ? 0.55 : 1,
            }}
            title={`${block.title} · ${block.detail}`}
          >
            <p
              className="truncate text-[0.6875rem] font-medium leading-tight"
              style={{ color: "var(--text)" }}
            >
              {block.running ? (
                <span
                  className="ink-pulse mr-1 inline-block h-1.5 w-1.5 rounded-full align-middle"
                  style={{ background: "var(--accent)" }}
                  aria-hidden
                />
              ) : null}
              {block.title}
            </p>
            {/* Short blocks: title only — the time range lives in the
                hover/long-press tooltip via the title attribute. */}
            {!compact ? (
              <p
                className="truncate text-[0.625rem] leading-tight"
                style={{ color: "var(--text-faint)" }}
              >
                {block.detail}
              </p>
            ) : null}
          </article>
        );
      })}

      {blocks.length === 0 ? (
        <p
          className="absolute inset-x-0 top-1/2 -translate-y-1/2 px-2 text-center text-[0.6875rem]"
          style={{ color: "var(--text-faint)" }}
        >
          {variant === "planned" ? "Nothing planned" : "Nothing tracked yet"}
        </p>
      ) : null}
    </div>
  );
}
