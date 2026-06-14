"use client";

// A habit reminder rendered as a ghost/template block on the planned lane.
// Dashed border + translucent fill in the habit's colour, a small repeat icon,
// and a tap-to-open action popover (start a timer / log as done / dismiss).
// These sit BEHIND real planned blocks — they're suggestions, not entries.

import { useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import {
  logHabitBlockDoneAction,
  startHabitTimerAction,
} from "../actions";
import type { HabitGhostBlock as HabitGhost } from "../_lib/timeline";

const POPOVER_W = 208;

export function HabitGhostBlock({
  block,
  narrow,
}: {
  block: HabitGhost;
  /** Narrow column (multi-day): thinner block, label only. */
  narrow: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [pop, setPop] = useState<{ left: number; top: number; flip: boolean } | null>(
    null,
  );

  const openPopover = (target: HTMLElement) => {
    const rect = target.getBoundingClientRect();
    let left = rect.left;
    if (left + POPOVER_W > window.innerWidth - 8) {
      left = window.innerWidth - 8 - POPOVER_W;
    }
    left = Math.max(8, left);
    const flip = rect.bottom + 180 > window.innerHeight;
    setPop({ left, top: flip ? rect.top : rect.bottom, flip });
  };

  const close = () => setPop(null);

  const runDone = () => {
    startTransition(async () => {
      const fd = new FormData();
      fd.set("habitId", block.habitId);
      fd.set("title", block.title);
      fd.set("category", block.category);
      fd.set("startIso", block.startIso);
      fd.set("endIso", block.endIso);
      await logHabitBlockDoneAction(fd);
      router.refresh();
      close();
    });
  };

  // Start timer redirects to /app/time server-side, so no manual refresh/close.
  const runStart = () => {
    startTransition(async () => {
      const fd = new FormData();
      fd.set("habitId", block.habitId);
      await startHabitTimerAction(fd);
    });
  };

  return (
    <>
      {/* Flexible-window band: the full window range at very low opacity, non-
          interactive (z-auto, painted before the ghost so the dashed slot and
          real blocks sit on top). A matched window — a real tracked entry
          overlapped it that day — gets more fill, a thin solid border, and a
          ✓: the "ideal week" hit treatment. */}
      {block.band ? (
        <div
          aria-hidden
          className="pointer-events-none absolute overflow-hidden rounded"
          style={{
            top: `${block.band.topPct}%`,
            height: `${block.band.heightPct}%`,
            left: `calc(${block.leftPct}% + 4px)`,
            width: `calc(${block.widthPct}% - 8px)`,
            background: `color-mix(in srgb, ${block.color} ${
              block.band.matched ? 16 : 9
            }%, transparent)`,
            border: block.band.matched
              ? `1px solid color-mix(in srgb, ${block.color} 55%, transparent)`
              : "none",
          }}
        >
          {block.band.matched ? (
            <span
              className="absolute right-1 top-0.5 text-[0.625rem] leading-none"
              style={{ color: block.color }}
            >
              ✓
            </span>
          ) : null}
        </div>
      ) : null}

      <button
        type="button"
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => {
          event.stopPropagation();
          openPopover(event.currentTarget);
        }}
        // z-[5] lifts the ghost above the real planned blocks (which render
        // later in DOM with z-auto), so a habit reminder that shares a slot with
        // a planned item still receives the tap instead of the opaque block
        // swallowing it. min-h is set via classes (not inline style) so the
        // coarse-pointer 44px tap target isn't clobbered by inline specificity.
        className={`absolute z-[5] flex items-start justify-between gap-1 overflow-hidden rounded text-left min-h-[16px] [@media(pointer:coarse)]:min-h-[44px] ${
          narrow ? "px-1 py-0.5" : "px-1.5 py-0.5"
        }`}
        style={{
          top: `${block.topPct}%`,
          height: `${block.heightPct}%`,
          left: `calc(${block.leftPct}% + 4px)`,
          width: `calc(${block.widthPct}% - 8px)`,
          background: `color-mix(in srgb, ${block.color} 10%, var(--bg-page))`,
          border: `1px dashed ${block.color}`,
          color: "var(--text-muted)",
          opacity: 0.9,
        }}
        title={`${block.title} · ${block.timeLabel} (habit)`}
        aria-label={`Habit reminder: ${block.title} at ${block.timeLabel}`}
      >
        <span className="min-w-0 flex-1 truncate text-[0.6875rem] font-medium leading-tight">
          {block.title}
        </span>
        <span
          className="shrink-0 text-[0.6875rem] leading-none"
          style={{ color: block.color }}
          aria-hidden
        >
          ↻
        </span>
      </button>

      {pop && typeof document !== "undefined"
        ? createPortal(
            <>
              {/* Click-away backdrop. */}
              <div
                className="fixed inset-0 z-40"
                onClick={close}
                role="presentation"
              />
              <div
                className="fixed z-50 rounded-md border p-2 shadow-lg"
                style={{
                  left: pop.left,
                  top: pop.top,
                  width: POPOVER_W,
                  transform: pop.flip
                    ? "translateY(calc(-100% - 6px))"
                    : "translateY(6px)",
                  background: "var(--bg-page)",
                  borderColor: "var(--border-soft)",
                }}
                role="dialog"
                aria-label={block.title}
              >
                <div className="mb-2 flex items-center gap-1.5 px-1">
                  <span
                    className="inline-block h-2 w-2 shrink-0 rounded-full"
                    style={{ background: block.color }}
                    aria-hidden
                  />
                  <div className="min-w-0">
                    <p
                      className="truncate text-[0.8125rem] font-semibold leading-tight"
                      style={{ color: "var(--text)" }}
                    >
                      {block.title}
                    </p>
                    <p
                      className="text-[0.625rem] tabular leading-tight"
                      style={{ color: "var(--text-faint)" }}
                    >
                      Habit · {block.timeLabel}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  disabled={pending}
                  onClick={runStart}
                  className="flex w-full items-center gap-2 rounded px-2 py-2 text-left text-[0.8125rem] font-medium disabled:opacity-50"
                  style={{ color: "var(--text)" }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.background = "var(--bg-tint)")
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.background = "transparent")
                  }
                >
                  <span aria-hidden>▶</span> Start timer
                </button>
                <button
                  type="button"
                  disabled={pending}
                  onClick={runDone}
                  className="flex w-full items-center gap-2 rounded px-2 py-2 text-left text-[0.8125rem] font-medium disabled:opacity-50"
                  style={{ color: "var(--text)" }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.background = "var(--bg-tint)")
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.background = "transparent")
                  }
                >
                  <span aria-hidden>✓</span> Log as done
                </button>
                <button
                  type="button"
                  disabled={pending}
                  onClick={close}
                  className="flex w-full items-center gap-2 rounded px-2 py-2 text-left text-[0.8125rem] disabled:opacity-50"
                  style={{ color: "var(--text-faint)" }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.background = "var(--bg-tint)")
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.background = "transparent")
                  }
                >
                  Dismiss
                </button>
              </div>
            </>,
            document.body,
          )
        : null}
    </>
  );
}
