"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Momentum } from "@/lib/projects";
import { completeNextActionAction } from "../actions";
import { AreaBadge } from "./area-badge";
import { MomentumBadge } from "./momentum-badge";

export type ProjectCardView = {
  id: string;
  name: string;
  intent: string | null;
  statusLabel: string;
  statusColor: string;
  statusBg: string;
  energyEmoji: string;
  energyLabel: string;
  area: { id: string; name: string; color: string } | null;
  areaId: string | null;
  stripColor: string;
  momentum: Momentum;
  weekMinutesLabel: string;
  lastWorkedLabel: string;
  nextAction: string | null;
  openTaskCount: number;
  daysUntilTarget: number | null;
};

function targetCountdown(days: number | null): { text: string; tone: "soon" | "overdue" | "normal" } | null {
  if (days === null) return null;
  if (days < 0) {
    const abs = Math.abs(days);
    return { text: `${abs} day${abs === 1 ? "" : "s"} overdue`, tone: "overdue" };
  }
  if (days === 0) return { text: "Due today", tone: "overdue" };
  if (days === 1) return { text: "1 day left", tone: "soon" };
  if (days <= 14) return { text: `${days} days left`, tone: "soon" };
  return { text: `${days} days left`, tone: "normal" };
}

export function ProjectCard({
  view,
  highlighted,
}: {
  view: ProjectCardView;
  highlighted: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const go = () => router.push(`/app/projects/${view.id}`, { scroll: false });
  const countdown = targetCountdown(view.daysUntilTarget);

  return (
    <div
      role="link"
      tabIndex={0}
      onClick={go}
      onKeyDown={(event) => {
        if (event.key === "Enter") go();
      }}
      className="group relative cursor-pointer overflow-hidden rounded-lg border pl-4 pr-4 py-3.5 transition-all hover:shadow-sm focus:outline-none"
      style={{
        borderColor: highlighted ? view.stripColor : "var(--border-soft)",
        background: "var(--bg-page)",
        boxShadow: highlighted ? `0 0 0 1px ${view.stripColor}` : undefined,
      }}
    >
      {/* Area / status color strip on the left edge */}
      <span
        aria-hidden
        className="absolute inset-y-0 left-0 w-1"
        style={{ background: view.stripColor }}
      />

      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3
              className="truncate text-[0.9375rem] font-semibold tracking-tight"
              style={{ color: "var(--text)" }}
            >
              {view.name}
            </h3>
            <span
              className="inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[0.625rem] font-semibold uppercase tracking-wider"
              style={{ background: view.statusBg, color: view.statusColor }}
            >
              {view.statusLabel}
            </span>
            <MomentumBadge momentum={view.momentum} />
          </div>

          {view.intent ? (
            <p
              className="mt-1 line-clamp-1 text-[0.8125rem]"
              style={{ color: "var(--text-muted)" }}
            >
              {view.intent}
            </p>
          ) : null}
        </div>

        <span
          className="shrink-0 text-base leading-none"
          title={view.energyLabel}
          aria-label={view.energyLabel}
        >
          {view.energyEmoji}
        </span>
      </div>

      {/* Signals row */}
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[0.75rem]" style={{ color: "var(--text-faint)" }}>
        <span>
          <span className="font-semibold tabular" style={{ color: "var(--text-muted)" }}>
            {view.weekMinutesLabel}
          </span>{" "}
          this week
        </span>
        <span>
          Last worked{" "}
          <span style={{ color: "var(--text-muted)" }}>{view.lastWorkedLabel}</span>
        </span>
        {view.area ? <AreaBadge area={view.area} /> : null}
        {countdown ? (
          <span
            className="font-medium"
            style={{
              color:
                countdown.tone === "overdue"
                  ? "#ef4444"
                  : countdown.tone === "soon"
                    ? "var(--accent-strong)"
                    : "var(--text-faint)",
            }}
          >
            {countdown.text}
          </span>
        ) : null}
      </div>

      {/* Next action — tap the check to complete + clear */}
      {view.nextAction ? (
        <div
          className="mt-3 flex items-center gap-2 rounded-md px-2.5 py-2"
          style={{ background: "var(--bg-tint)" }}
        >
          <button
            type="button"
            disabled={pending}
            onClick={(event) => {
              event.stopPropagation();
              startTransition(() => completeNextActionAction(view.id));
            }}
            aria-label="Mark next action done"
            title="Mark next action done"
            className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-colors hover:bg-bg-hover"
            style={{ borderColor: "var(--border)" }}
          >
            {pending ? (
              <span className="text-[0.625rem]" style={{ color: "var(--text-faint)" }}>
                …
              </span>
            ) : (
              <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="var(--text-faint)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M2.5 6.2l2.3 2.3 4.7-5" />
              </svg>
            )}
          </button>
          <span
            className="min-w-0 flex-1 truncate text-[0.8125rem]"
            style={{ color: "var(--text)" }}
          >
            <span className="font-medium" style={{ color: "var(--text-faint)" }}>
              Next:{" "}
            </span>
            {view.nextAction}
          </span>
        </div>
      ) : (
        <p className="mt-3 text-[0.75rem]" style={{ color: "var(--text-ghost)" }}>
          {view.openTaskCount === 0 ? "No tasks yet — open to add the first." : "No next action set."}
        </p>
      )}
    </div>
  );
}
