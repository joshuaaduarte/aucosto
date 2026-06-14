"use client";

export type AllocationSegmentView = {
  projectId: string | null;
  name: string;
  color: string;
  minutes: number;
  label: string;
  pct: number;
};

/**
 * "Where did my week actually go?" — a single stacked bar of time logged this
 * week, one segment per project (plus an Untagged segment). Hovering a segment
 * lifts the highlighted project id so the matching card lights up.
 */
export function TimeAllocationBar({
  segments,
  totalLabel,
  highlightedId,
  onHover,
}: {
  segments: AllocationSegmentView[];
  totalLabel: string;
  highlightedId: string | null;
  onHover: (projectId: string | null) => void;
}) {
  if (segments.length === 0) return null;

  return (
    <section
      className="rounded-lg border p-4"
      style={{ borderColor: "var(--border-soft)", background: "var(--bg-page)" }}
    >
      <div className="flex items-baseline justify-between gap-2">
        <p
          className="text-[0.6875rem] font-semibold uppercase tracking-wider"
          style={{ color: "var(--text-faint)" }}
        >
          This week’s time
        </p>
        <p className="text-[0.8125rem] font-semibold tabular" style={{ color: "var(--text)" }}>
          {totalLabel}
        </p>
      </div>

      <div
        className="mt-3 flex h-3 w-full overflow-hidden rounded-full"
        style={{ background: "var(--bg-tint-strong)" }}
        onMouseLeave={() => onHover(null)}
      >
        {segments.map((segment) => {
          const active = highlightedId !== null && highlightedId === segment.projectId;
          return (
            <button
              key={segment.projectId ?? "untagged"}
              type="button"
              onMouseEnter={() => onHover(segment.projectId)}
              onFocus={() => onHover(segment.projectId)}
              onBlur={() => onHover(null)}
              aria-label={`${segment.name}: ${segment.label}`}
              className="h-full transition-opacity"
              style={{
                width: `${segment.pct}%`,
                background: segment.color,
                opacity: highlightedId === null || active ? 1 : 0.35,
              }}
            />
          );
        })}
      </div>

      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
        {segments.map((segment) => {
          const active = highlightedId !== null && highlightedId === segment.projectId;
          return (
            <button
              key={segment.projectId ?? "untagged"}
              type="button"
              onMouseEnter={() => onHover(segment.projectId)}
              onMouseLeave={() => onHover(null)}
              className="inline-flex items-center gap-1.5 text-[0.75rem] transition-opacity"
              style={{
                color: "var(--text-muted)",
                opacity: highlightedId === null || active ? 1 : 0.45,
              }}
            >
              <span
                className="inline-block h-2 w-2 rounded-full"
                style={{ background: segment.color }}
                aria-hidden
              />
              <span style={{ color: active ? "var(--text)" : "var(--text-muted)" }}>
                {segment.name}
              </span>
              <span className="tabular" style={{ color: "var(--text-faint)" }}>
                {segment.label}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
