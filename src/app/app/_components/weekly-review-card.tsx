import Link from "next/link";
import type { HubReviewState, PriorityOutcome } from "@/lib/weekly-review";

// The weekly review on Today: a nudge on Saturday to Monday while the week is
// unreviewed, otherwise the three picks it produced, ticked off as they get
// done. Nothing shows the rest of the time.

export function WeeklyReviewCard({
  state,
  outcomes,
}: {
  state: HubReviewState | null;
  outcomes: PriorityOutcome[];
}) {
  if (!state) return null;

  if (state.kind === "nudge") {
    return (
      <section
        aria-label="Weekly review"
        className="fade-in flex flex-wrap items-center justify-between gap-3 rounded-lg border px-4 py-3"
        style={{ borderColor: "var(--border-soft)", background: "var(--bg-page)" }}
      >
        <div className="min-w-0">
          <p
            className="text-[0.6875rem] font-semibold uppercase tracking-wider"
            style={{ color: "var(--text-faint)" }}
          >
            Weekly review · {state.label}
          </p>
          <p className="mt-0.5 text-[0.9rem]" style={{ color: "var(--text)" }}>
            Five minutes: look back at the week and pick three things for the next one.
          </p>
        </div>
        <Link href="/app/review" className="btn-ink h-9 shrink-0 px-3 text-[0.84rem]">
          Start review
        </Link>
      </section>
    );
  }

  const done = outcomes.filter((outcome) => outcome.done).length;
  return (
    <section
      aria-label={state.heading}
      className="fade-in rounded-lg border px-4 py-3"
      style={{ borderColor: "var(--border-soft)", background: "var(--bg-page)" }}
    >
      <div className="flex items-baseline justify-between gap-3">
        <p
          className="text-[0.6875rem] font-semibold uppercase tracking-wider"
          style={{ color: "var(--text-faint)" }}
        >
          {state.heading}
        </p>
        <Link
          href="/app/review"
          className="text-[0.75rem] tabular-nums"
          style={{ color: "var(--text-faint)" }}
        >
          {done} of {outcomes.length} done →
        </Link>
      </div>
      <ul className="mt-1.5 space-y-1">
        {outcomes.map((outcome) => (
          <li key={outcome.id} className="flex items-baseline gap-2 text-[0.9rem]">
            <span
              aria-hidden
              className="w-4 shrink-0 text-center"
              style={{ color: outcome.done ? "var(--positive)" : "var(--text-faint)" }}
            >
              {outcome.done ? "✓" : "○"}
            </span>
            <span
              className="min-w-0"
              style={{
                color: outcome.done ? "var(--text-muted)" : "var(--text)",
                textDecoration: outcome.done ? "line-through" : undefined,
              }}
            >
              {outcome.title}
              <span className="sr-only">{outcome.done ? " (done)" : ""}</span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
