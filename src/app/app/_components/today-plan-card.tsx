"use client";

// The day's plan, on the hub.
//
// The plan is the one thing that should be readable without scrolling or
// navigating: it's what the morning nudge asked about, and each block is a
// one-tap timer start. When there's no plan it becomes a single prompt rather
// than another empty card.

import Link from "next/link";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { startPlannedBlockAction } from "../plan/actions";

export type HubPlanBlock = {
  id: string;
  title: string;
  timeLabel: string;
  /** Block's end has passed. */
  past: boolean;
};

export function TodayPlanCard({
  blocks,
  runningLabel,
  canPlanToday,
}: {
  blocks: HubPlanBlock[];
  runningLabel: string | null;
  /** Before the late-day cutoff — an empty plan is still worth shaping. */
  canPlanToday: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function start(title: string) {
    startTransition(async () => {
      const formData = new FormData();
      formData.set("title", title);
      await startPlannedBlockAction(formData);
      router.refresh();
    });
  }

  if (blocks.length === 0) {
    return (
      <section
        className="fade-in flex flex-wrap items-center justify-between gap-3 rounded-lg border px-4 py-3"
        style={{
          background: "var(--bg-page)",
          borderColor: "var(--border-faint)",
          borderLeft: "3px solid var(--border-soft)",
        }}
      >
        <div className="min-w-0">
          <p
            className="text-[0.6875rem] font-semibold uppercase tracking-wider"
            style={{ color: "var(--text-faint)" }}
          >
            {canPlanToday ? "Today" : "Tomorrow"}
          </p>
          <p
            className="mt-0.5 text-[0.8125rem]"
            style={{ color: "var(--text-muted)" }}
          >
            {canPlanToday
              ? "No blocks yet — name two or three."
              : "Set tomorrow up before bed."}
          </p>
        </div>
        <Link href="/app/plan" className="btn-ink h-9 shrink-0 px-3.5 text-[0.8125rem]">
          {canPlanToday ? "Shape the day" : "Plan tomorrow"}
        </Link>
      </section>
    );
  }

  return (
    <section
      className="fade-in rounded-lg border px-4 py-3"
      style={{
        background: "var(--bg-page)",
        borderColor: "var(--border-faint)",
        borderLeft: "3px solid var(--accent)",
      }}
    >
      <div className="flex items-center justify-between gap-3">
        <p
          className="text-[0.6875rem] font-semibold uppercase tracking-wider"
          style={{ color: "var(--text-faint)" }}
        >
          Today&apos;s plan
        </p>
        <Link
          href="/app/plan"
          className="shrink-0 text-[0.75rem] font-medium"
          style={{ color: "var(--text-faint)" }}
        >
          Edit
        </Link>
      </div>

      <ul className="mt-2 space-y-1">
        {blocks.map((block) => {
          const running = runningLabel === block.title;
          return (
            <li key={block.id} className="flex items-center gap-3 py-1">
              <span
                className="w-[4.5rem] shrink-0 text-[0.8125rem] tabular"
                style={{ color: "var(--text-faint)" }}
              >
                {block.timeLabel}
              </span>
              <span
                className="min-w-0 flex-1 truncate text-[0.875rem]"
                style={{
                  color: block.past ? "var(--text-faint)" : "var(--text)",
                  textDecoration: block.past ? "line-through" : undefined,
                }}
              >
                {block.title}
              </span>
              {running ? (
                <span
                  className="shrink-0 text-[0.75rem] font-medium"
                  style={{ color: "var(--accent-strong)" }}
                >
                  Running
                </span>
              ) : (
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => start(block.title)}
                  className="btn-ghost h-8 shrink-0 px-2.5 text-[0.75rem]"
                >
                  Start
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
