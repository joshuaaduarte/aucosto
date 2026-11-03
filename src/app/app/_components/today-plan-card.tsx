"use client";

// The day's plan and calendar, on the hub, as one timeline.
//
// The plan is the one thing that should be readable without scrolling or
// navigating: it's what the morning nudge asked about, and each block is a
// one-tap timer start. When there's no plan it becomes a single prompt rather
// than another empty card.

import Link from "next/link";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { startPlannedBlockAction } from "../plan/actions";

import type { TimelineItem } from "../_lib/hub-now";

/** A plan block or a calendar event on today's timeline. */
export type HubPlanBlock = TimelineItem;

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

  // Nothing planned, or the day is over: offer to shape the next one.
  if (blocks.length === 0 || (!canPlanToday && blocks.every((block) => block.past))) {
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
          Today
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
          const running = block.kind === "plan" && runningLabel === block.title;
          const isNext = !block.past && blocks.find((b) => !b.past)?.id === block.id;
          return (
            <li key={block.id} className="flex items-center gap-3 py-1">
              <span
                className="w-[4.5rem] shrink-0 text-[0.8125rem] tabular"
                style={{ color: isNext ? "var(--text)" : "var(--text-faint)", fontWeight: isNext ? 600 : 400 }}
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
              {block.kind === "event" ? (
                <Link
                  href="/app/calendar"
                  className="shrink-0 rounded-full px-2 py-0.5 text-[0.6875rem]"
                  style={{ background: "var(--bg-tint)", color: "var(--text-faint)" }}
                >
                  Calendar
                </Link>
              ) : block.past ? null : running ? (
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
