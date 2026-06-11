// Planned vs actual: today's calendar items beside today's tracked time,
// on a shared hour axis, so the plan and reality line up visually.
// All positioning math lives in ../_lib/timeline.ts (pure, tested).

import type { DayTimelineModel, TimelineBlock } from "../_lib/timeline";

const PX_PER_HOUR = 44;

export function DayTimeline({ model }: { model: DayTimelineModel }) {
  const hours =
    (model.windowEnd.getTime() - model.windowStart.getTime()) / 3_600_000;
  const height = Math.round(hours * PX_PER_HOUR);

  if (model.planned.length === 0 && model.actual.length === 0) {
    return null;
  }

  return (
    <section
      className="rounded-md border p-4 sm:p-5"
      style={{
        borderColor: "var(--border-soft)",
        background: "var(--bg-page)",
      }}
    >
      <header className="mb-4">
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
          How today is really going
        </h2>
      </header>

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

      {model.nowPct !== null ? (
        <div
          className="absolute inset-x-0 z-10"
          style={{
            top: `${model.nowPct}%`,
            borderTop: "1px dashed var(--accent)",
          }}
          aria-hidden
        />
      ) : null}

      {blocks.map((block) => (
        <article
          key={block.id}
          className="absolute inset-x-1 overflow-hidden rounded px-1.5 py-0.5"
          style={{
            top: `${block.topPct}%`,
            height: `${block.heightPct}%`,
            minHeight: "14px",
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
          <p
            className="truncate text-[0.625rem] leading-tight"
            style={{ color: "var(--text-faint)" }}
          >
            {block.detail}
          </p>
        </article>
      ))}

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
