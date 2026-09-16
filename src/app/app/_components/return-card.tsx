import Link from "next/link";
import { describeAway } from "@/lib/day-plan";

// Shown when the owner comes back after a real gap.
//
// The failure mode this exists for: a gap makes coverage partial, partial
// coverage makes the insights meaningless, and meaningless insights remove
// the reason to log. A streak counter makes that worse — it prices the gap as
// failure right when the job is to restart. So on re-entry we mark the
// landmark, start the counters from today, and offer exactly one next action.

export function ReturnCard({
  awayDays,
  hasPlanToday,
}: {
  awayDays: number;
  hasPlanToday: boolean;
}) {
  return (
    <section
      className="fade-in rounded-lg border px-4 py-4"
      style={{
        background: "var(--accent-tint)",
        borderColor: "var(--accent-tint-strong)",
        borderLeft: "3px solid var(--accent)",
      }}
    >
      <p
        className="text-[0.6875rem] font-semibold uppercase tracking-wider"
        style={{ color: "var(--accent-strong)" }}
      >
        Fresh start
      </p>
      <h2
        className="mt-1 text-[1.0625rem] font-semibold tracking-tight"
        style={{ color: "var(--text)" }}
      >
        Welcome back.
      </h2>
      <p
        className="mt-1 text-[0.8125rem]"
        style={{ color: "var(--text-muted)" }}
      >
        It&apos;s been {describeAway(awayDays)}. Nothing to catch up on — the
        last stretch is behind you and today counts as day one.
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Link href="/app/plan" className="btn-ink h-9 px-3.5 text-[0.8125rem]">
          {hasPlanToday ? "Confirm today's plan" : "Shape today"}
        </Link>
        <Link
          href="/app/time"
          className="btn-ghost h-9 px-3 text-[0.8125rem]"
        >
          Start a timer
        </Link>
      </div>
    </section>
  );
}
