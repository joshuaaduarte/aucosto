"use client";

import { useRef, useTransition, type PointerEvent as ReactPointerEvent } from "react";
import { useRouter } from "next/navigation";
import { momentumDotColor } from "@/lib/projects";
import { startProjectTimerAction } from "../actions";
import type { ProjectCardView } from "./project-card";

// Swipe geometry (px). THRESHOLD = snap-open commit; ACTION_W = revealed action
// width (≥44px tap target); FULL = a decisive flick that fires immediately.
const THRESHOLD = 80;
const ACTION_W = 88;
const FULL = 200;
const SNAP = "transform 220ms cubic-bezier(0.25, 0.46, 0.45, 0.94)";

/**
 * One compact, single-line project row for the mobile list. iOS-mail-style
 * swipe: drag right reveals a green ▶ Start-timer action, drag left reveals a
 * red ⋯ More action. Translation is driven directly on the DOM node during the
 * gesture (no setState per pointermove); a tap that didn't move opens detail.
 */
export function ProjectRow({
  view,
  muted = false,
  onQuickAction,
}: {
  view: ProjectCardView;
  /** Done projects: 50% opacity, no momentum dot. */
  muted?: boolean;
  onQuickAction: (view: ProjectCardView) => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const fgRef = useRef<HTMLDivElement>(null);
  const startRef = useRef<{ x: number; y: number } | null>(null);
  const axisRef = useRef<"h" | "v" | null>(null);
  const restRef = useRef(0); // resting offset: 0, +ACTION_W, or -ACTION_W
  const offsetRef = useRef(0); // last applied offset during the drag

  const setX = (x: number, animate: boolean) => {
    const el = fgRef.current;
    if (!el) return;
    el.style.transition = animate ? SNAP : "none";
    el.style.transform = `translateX(${x}px)`;
    offsetRef.current = x;
  };

  const open = () => router.push(`/app/projects/${view.id}`, { scroll: false });

  const close = () => {
    restRef.current = 0;
    setX(0, true);
  };

  const startTimer = () => {
    close();
    startTransition(async () => {
      await startProjectTimerAction(view.id);
      router.refresh();
    });
  };

  const more = () => {
    close();
    onQuickAction(view);
  };

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    startRef.current = { x: e.clientX, y: e.clientY };
    axisRef.current = null;
    fgRef.current?.setPointerCapture?.(e.pointerId);
    const el = fgRef.current;
    if (el) el.style.transition = "none";
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!startRef.current) return;
    const dx = e.clientX - startRef.current.x;
    const dy = e.clientY - startRef.current.y;
    if (axisRef.current === null && (Math.abs(dx) > 8 || Math.abs(dy) > 8)) {
      axisRef.current = Math.abs(dx) > Math.abs(dy) * 1.5 ? "h" : "v";
    }
    if (axisRef.current === "h") {
      const next = Math.max(-FULL, Math.min(FULL, restRef.current + dx));
      const el = fgRef.current;
      if (el) el.style.transform = `translateX(${next}px)`;
      offsetRef.current = next;
    }
  };

  const onPointerUp = () => {
    if (!startRef.current) return;
    const wasHorizontal = axisRef.current === "h";
    const offset = offsetRef.current;
    startRef.current = null;
    axisRef.current = null;

    if (!wasHorizontal) {
      // A tap: close if open, otherwise navigate to the project.
      if (restRef.current !== 0) close();
      else open();
      return;
    }

    if (offset >= FULL * 0.9) return startTimer();
    if (offset <= -FULL * 0.9) return more();
    if (offset > THRESHOLD) {
      restRef.current = ACTION_W;
      return setX(ACTION_W, true);
    }
    if (offset < -THRESHOLD) {
      restRef.current = -ACTION_W;
      return setX(-ACTION_W, true);
    }
    close();
  };

  const onPointerCancel = () => {
    startRef.current = null;
    axisRef.current = null;
    setX(restRef.current, true);
  };

  return (
    <div className="relative overflow-hidden rounded-xl" style={{ opacity: muted ? 0.5 : 1 }}>
      {/* Revealed actions, behind the foreground */}
      <button
        type="button"
        aria-label={`Start timer for ${view.name}`}
        onClick={startTimer}
        disabled={pending}
        className="absolute inset-y-0 left-0 flex items-center justify-center text-[1.05rem] text-white"
        style={{ width: ACTION_W, background: "#22c55e" }}
      >
        ▶
      </button>
      <button
        type="button"
        aria-label={`More actions for ${view.name}`}
        onClick={more}
        className="absolute inset-y-0 right-0 flex items-center justify-center text-[1.25rem] leading-none text-white"
        style={{ width: ACTION_W, background: "#ef4444" }}
      >
        ⋯
      </button>

      {/* Foreground row — translates on swipe, covers the actions at rest */}
      <div
        ref={fgRef}
        role="link"
        tabIndex={0}
        onKeyDown={(event) => {
          if (event.key === "Enter") open();
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        className="relative flex min-h-[3.5rem] cursor-pointer touch-pan-y items-center gap-3 pl-3.5 pr-3.5 focus:outline-none"
        style={{
          background: "var(--bg-page)",
          borderLeft: `4px solid ${view.stripColor}`,
          borderTopLeftRadius: "0.75rem",
          borderBottomLeftRadius: "0.75rem",
          willChange: "transform",
        }}
      >
        <div className="min-w-0 flex-1">
          <h3
            className="truncate text-[0.9375rem] font-semibold"
            style={{ color: "var(--text)" }}
          >
            {view.name}
          </h3>
          {view.nextAction ? (
            <p className="truncate text-[0.75rem]" style={{ color: "var(--text-faint)" }}>
              <span style={{ color: "var(--text-ghost)" }}>▸ </span>
              {view.nextAction}
            </p>
          ) : null}
        </div>
        {!muted ? (
          <span
            className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
            style={{ background: momentumDotColor(view.momentum) }}
            title={view.momentum?.hint ?? view.statusLabel}
            aria-hidden
          />
        ) : null}
        <span className="tabular shrink-0 text-[0.8125rem]" style={{ color: "var(--text-faint)" }}>
          {view.weekMinutes > 0 ? view.weekMinutesLabel : "—"}
        </span>
      </div>
    </div>
  );
}
