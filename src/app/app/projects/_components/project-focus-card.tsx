"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { momentumDotColor } from "@/lib/projects";
import { startProjectTimerAction } from "../actions";
import type { ProjectCardView } from "./project-card";

/**
 * The mobile "what am I working on" anchor: one large, full-width card pinned at
 * the top of the list for the most recently-worked active project. Color band,
 * momentum dot, the week's hours, intent + next action, and a 44px start-timer
 * button bottom-right. Tap anywhere else opens the project detail.
 */
export function ProjectFocusCard({ view }: { view: ProjectCardView }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const dotColor = momentumDotColor(view.momentum);
  const alive = view.momentum?.level === "alive";

  const open = () => router.push(`/app/projects/${view.id}`, { scroll: false });

  return (
    <article
      role="link"
      tabIndex={0}
      onClick={open}
      onKeyDown={(event) => {
        if (event.key === "Enter") open();
      }}
      className="card-in relative flex min-h-[7.5rem] cursor-pointer flex-col overflow-hidden rounded-2xl transition-transform duration-200 active:scale-[0.99] focus:outline-none"
      style={{
        // 5% area-color wash over the page background.
        background: `${view.stripColor}0d`,
        boxShadow: "var(--shadow-card)",
      }}
    >
      {/* Area color band */}
      <span aria-hidden className="h-1.5 w-full shrink-0" style={{ background: view.stripColor }} />

      <div className="flex flex-1 flex-col gap-1.5 p-4">
        {/* Momentum dot + name + hours this week */}
        <div className="flex items-center gap-2.5">
          <span className="relative flex h-3 w-3 shrink-0 items-center justify-center">
            {alive ? (
              <span
                aria-hidden
                className="absolute inline-flex h-full w-full animate-ping rounded-full"
                style={{ background: dotColor, opacity: 0.25 }}
              />
            ) : null}
            <span
              className="relative inline-flex h-3 w-3 rounded-full"
              style={{ background: dotColor }}
              title={view.momentum?.hint ?? view.statusLabel}
            />
          </span>
          <h2
            className="min-w-0 flex-1 truncate text-[1.0625rem] font-bold tracking-tight"
            style={{ color: "var(--text)" }}
          >
            {view.name}
          </h2>
          <span
            className="tabular shrink-0 text-[0.9375rem] font-semibold"
            style={{ color: view.weekMinutes > 0 ? view.stripColor : "var(--text-ghost)" }}
          >
            {view.weekMinutes > 0 ? view.weekMinutesLabel : "—"}
          </span>
        </div>

        {/* Intent (italic, muted) */}
        {view.intent ? (
          <p className="truncate pr-2 text-[0.8125rem] italic" style={{ color: "var(--text-muted)" }}>
            {view.intent}
          </p>
        ) : null}

        {/* Next action */}
        {view.nextAction ? (
          <p className="truncate pr-12 text-[0.75rem]" style={{ color: "var(--text-muted)" }}>
            <span style={{ color: "var(--text-ghost)" }}>▸ </span>
            {view.nextAction}
          </p>
        ) : null}
      </div>

      {/* Start timer — 44px tap target, bottom-right */}
      <button
        type="button"
        aria-label={`Start timer for ${view.name}`}
        disabled={pending}
        onClick={(event) => {
          event.stopPropagation();
          startTransition(async () => {
            await startProjectTimerAction(view.id);
            router.refresh();
          });
        }}
        className="absolute bottom-3 right-3 inline-flex h-11 w-11 items-center justify-center rounded-full text-[1rem] leading-none transition-transform active:scale-90 disabled:opacity-50"
        style={{ background: view.stripColor, color: "#fff", boxShadow: "var(--shadow-card)" }}
      >
        {pending ? "…" : "▶"}
      </button>
    </article>
  );
}
