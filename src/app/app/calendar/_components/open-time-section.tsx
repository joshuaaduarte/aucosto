import type { CalendarGapSuggestion } from "../_lib/derive";
import { formatShortTime } from "../_lib/derive";

export function OpenTimeSection({
  gapSuggestions,
}: {
  gapSuggestions: CalendarGapSuggestion[];
}) {
  if (gapSuggestions.length === 0) return null;

  return (
    <section
      className="rounded-md border p-4 sm:p-5"
      style={{ borderColor: "var(--border-soft)", background: "var(--bg-page)" }}
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <p
            className="text-[0.6875rem] font-semibold uppercase tracking-wider"
            style={{ color: "var(--text-faint)" }}
          >
            Open time
          </p>
          <h2
            className="mt-1 text-[1rem] font-semibold tracking-tight"
            style={{ color: "var(--text)" }}
          >
            Tasks that fit the day you already have
          </h2>
        </div>
        <p className="text-[0.75rem]" style={{ color: "var(--text-faint)" }}>
          {gapSuggestions.length} suggestion{gapSuggestions.length === 1 ? "" : "s"}
        </p>
      </div>
      <ol className="mt-4 space-y-3">
        {gapSuggestions.map((suggestion) => (
          <li
            key={`${suggestion.taskId}-${suggestion.gapStart.toISOString()}`}
            className="rounded-md border p-3"
            style={{ borderColor: "var(--border-faint)" }}
          >
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-[0.9375rem] font-medium" style={{ color: "var(--text)" }}>
                {suggestion.title}
              </p>
              <span className="pill">
                {suggestion.fit === "tight" ? "tight fit" : "comfortable fit"}
              </span>
            </div>
            <p className="mt-1 text-[0.75rem]" style={{ color: "var(--text-faint)" }}>
              {`${formatShortTime(suggestion.gapStart)}-${formatShortTime(suggestion.gapEnd)} open`}
              {suggestion.estimateMinutes
                ? ` · estimate ${suggestion.estimateMinutes}m`
                : ""}
            </p>
            <p className="mt-1.5 text-[0.8125rem]" style={{ color: "var(--text-muted)" }}>
              {suggestion.reason}
            </p>
          </li>
        ))}
      </ol>
    </section>
  );
}
