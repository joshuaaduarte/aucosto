// Planned vs actual: today's calendar items beside today's tracked time,
// on a shared hour axis, so the plan and reality line up visually.
// All positioning math lives in ../_lib/timeline.ts (pure, tested).

import Link from "next/link";
import type { LinkableTask } from "../../time/entry-editor";
import type { DayTimelineModel, TimelineBlock } from "../_lib/timeline";
import {
  TimelineBlockButton,
  type TimelineBlockPayload,
} from "./timeline-block";
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
  payloads,
  tasks,
}: {
  model: DayTimelineModel;
  nav: DayTimelineNav;
  /** Per-block tap payloads keyed by block id (entry edit / planned edit / running). */
  payloads: Record<string, TimelineBlockPayload>;
  tasks: LinkableTask[];
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
          payloads={payloads}
          tasks={tasks}
        />
        <TimelineLane
          blocks={model.actual}
          model={model}
          height={height}
          variant="actual"
          payloads={payloads}
          tasks={tasks}
          context={model.context}
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
  payloads,
  tasks,
  context = [],
}: {
  blocks: TimelineBlock[];
  model: DayTimelineModel;
  height: number;
  variant: "planned" | "actual";
  payloads: Record<string, TimelineBlockPayload>;
  tasks: LinkableTask[];
  /** Read-only rhythm context drawn behind the tracked blocks. */
  context?: TimelineBlock[];
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

      {/* Rhythm context: soft, striped, non-interactive backdrop. */}
      {context.map((block) => (
        <div
          key={block.id}
          className="absolute left-0 right-0 flex items-start justify-end overflow-hidden rounded-sm px-1.5 py-0.5"
          style={{
            top: `${block.topPct}%`,
            height: `${block.heightPct}%`,
            background: `repeating-linear-gradient(45deg, ${block.color}1f, ${block.color}1f 6px, ${block.color}0f 6px, ${block.color}0f 12px)`,
            borderLeft: `2px solid ${block.color}66`,
            pointerEvents: "none",
          }}
          aria-hidden
        >
          <span
            className="text-[0.5625rem] font-semibold uppercase tracking-wider"
            style={{ color: block.color }}
          >
            {block.title}
          </span>
        </div>
      ))}

      <TimelineNowLine
        windowStartIso={model.windowStart.toISOString()}
        windowEndIso={model.windowEnd.toISOString()}
      />

      {blocks.map((block) => {
        const blockPx = (block.heightPct / 100) * height;
        const payload = payloads[block.id];
        if (!payload) return null;
        return (
          <TimelineBlockButton
            key={block.id}
            block={block}
            variant={variant}
            compact={blockPx < 30}
            payload={payload}
            tasks={tasks}
          />
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
