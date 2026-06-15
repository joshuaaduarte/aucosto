"use client";

import { useRef } from "react";
import { useRouter } from "next/navigation";
import type { BoardStatus, Momentum } from "@/lib/projects";
import { momentumDotColor } from "@/lib/projects";

export type ProjectCardView = {
  id: string;
  name: string;
  /** Band + accent color: the area color, or a cycled default. */
  stripColor: string;
  momentum: Momentum;
  weekMinutes: number;
  weekMinutesLabel: string;
  lastWorkedShort: string;
  /** Epoch ms of the most recent time entry (0 if never) — sort key for the focus card. */
  lastWorkedMs: number;
  nextAction: string | null;
  openTaskCount: number;
  status: BoardStatus;
  statusLabel: string;
  /** Paused / done → rendered at 60% opacity. */
  dimmed: boolean;
  // Carried so the quick-action sheet + edit sheet can act without a refetch.
  intent: string | null;
  areaId: string | null;
  area: { id: string; name: string; color: string } | null;
  energyType: string;
  timeBudgetHours: string;
  targetDateValue: string;
};

/**
 * One square-ish tile in the project grid. Color and shape do the talking:
 * a color band, a momentum dot, the week's hours in the accent color, and an
 * abbreviated "last worked" — no labels. Tap opens detail; long-press (or
 * right-click, or the ⋯ button) opens the quick-action sheet.
 */
export function ProjectCard({
  view,
  index,
  highlighted,
  onQuickAction,
}: {
  view: ProjectCardView;
  index: number;
  highlighted: boolean;
  onQuickAction: (view: ProjectCardView) => void;
}) {
  const router = useRouter();
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressed = useRef(false);

  const dotColor = momentumDotColor(view.momentum);
  const alive = view.momentum?.level === "alive";

  const open = () => router.push(`/app/projects/${view.id}`, { scroll: false });

  const startPress = () => {
    longPressed.current = false;
    longPressTimer.current = setTimeout(() => {
      longPressed.current = true;
      onQuickAction(view);
    }, 450);
  };
  const cancelPress = () => {
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
  };

  return (
    <article
      role="link"
      tabIndex={0}
      onClick={() => {
        if (longPressed.current) return;
        open();
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter") open();
      }}
      onContextMenu={(event) => {
        event.preventDefault();
        onQuickAction(view);
      }}
      onTouchStart={startPress}
      onTouchEnd={cancelPress}
      onTouchMove={cancelPress}
      style={{
        animationDelay: `${index * 30}ms`,
        opacity: view.dimmed ? 0.6 : 1,
        background: "var(--bg-page)",
        boxShadow: highlighted ? `0 0 0 2px ${view.stripColor}` : "var(--shadow-card)",
      }}
      className="card-in group relative flex min-h-[8.5rem] cursor-pointer flex-col overflow-hidden rounded-2xl transition-transform duration-200 active:scale-[0.97] focus:outline-none"
    >
      {/* Top color band */}
      <span aria-hidden className="h-1.5 w-full shrink-0" style={{ background: view.stripColor }} />

      {/* Quick-action affordance for fine pointers; touch uses long-press */}
      <button
        type="button"
        aria-label="Quick actions"
        onClick={(event) => {
          event.stopPropagation();
          onQuickAction(view);
        }}
        className="absolute right-1.5 top-3 z-10 hidden h-7 w-7 items-center justify-center rounded-full text-[1rem] leading-none opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100 [@media(pointer:fine)]:flex"
        style={{ color: "var(--text-faint)", background: "var(--bg-tint)" }}
      >
        ⋯
      </button>

      <div className="flex flex-1 flex-col gap-2 p-3">
        {/* Momentum dot + name */}
        <div className="flex items-start gap-2">
          <span className="relative mt-[3px] flex h-3 w-3 shrink-0 items-center justify-center">
            {alive ? (
              <span
                aria-hidden
                className="absolute inline-flex h-full w-full animate-ping rounded-full"
                style={{ background: dotColor, opacity: 0.2 }}
              />
            ) : null}
            <span
              className="relative inline-flex h-3 w-3 rounded-full"
              style={{ background: dotColor }}
              title={view.momentum?.hint ?? view.statusLabel}
            />
          </span>
          <h3
            className="line-clamp-2 text-[0.9375rem] font-semibold leading-snug tracking-tight"
            style={{ color: "var(--text)" }}
          >
            {view.name}
          </h3>
        </div>

        <div className="flex-1" />

        {/* Hours this week (accent) · last worked (muted) */}
        <div className="flex items-baseline justify-between gap-2">
          <span
            className="tabular text-[0.9375rem] font-semibold"
            style={{ color: view.weekMinutes > 0 ? view.stripColor : "var(--text-ghost)" }}
          >
            {view.weekMinutes > 0 ? view.weekMinutesLabel : "—"}
          </span>
          <span className="tabular text-[0.75rem]" style={{ color: "var(--text-faint)" }}>
            {view.lastWorkedShort}
          </span>
        </div>

        {/* Next action */}
        {view.nextAction ? (
          <p className="truncate text-[0.75rem]" style={{ color: "var(--text-muted)" }}>
            <span style={{ color: "var(--text-ghost)" }}>▸ </span>
            {view.nextAction}
          </p>
        ) : null}
      </div>
    </article>
  );
}
