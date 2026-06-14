"use client";

// "Stop at an earlier time." Josh finishes at 2pm but doesn't hit Stop until
// 3pm. This picker ends the running entry at the chosen earlier moment, then the
// caller sends him to /app/time where the existing gap-backfill card offers to
// account for the 2pm–3pm stretch it left behind (fill it, split it, "still
// doing it", or skip) — so the recovery flow is reused, not rebuilt.
//
// Mobile-first: a native time field (big native wheel on phones) plus large
// "−15m / −30m / −1h / −2h" nudge chips, all clamped between the timer's start
// and now. A live preview shows the resulting duration and how much time is
// left untracked, so the consequence of the pick is never a surprise.

import { useMemo, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { useBodyScrollLock } from "../_components/use-body-scroll-lock";
import { stopEntryAt } from "./actions";

function fmtTime(date: Date) {
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

// "HH:mm" in the browser's timezone — keeps wall-clock math in the browser,
// matching the gap-fill modals' convention (never the LA-pinned server).
function hhmm(date: Date) {
  return date.toLocaleTimeString("en-CA", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function formatDuration(ms: number) {
  const mins = Math.max(0, Math.round(ms / 60000));
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h`;
  return `${m}m`;
}

export function BackdatedStopModal({
  startedAtIso,
  onClose,
  onStopped,
}: {
  startedAtIso: string;
  /** Dismiss without stopping (cancel / backdrop / ×). */
  onClose: () => void;
  /** Stop succeeded — caller closes and refreshes/navigates to the gap card. */
  onStopped: () => void;
}) {
  useBodyScrollLock();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Freeze "now" and the start at open time so the clamp window is stable while
  // the user nudges the picker. "now" goes through a lazy useState initializer
  // (not render) so the react-hooks/purity rule stays happy — same pattern the
  // running card and timer bar use for their live clocks.
  const [now] = useState(() => new Date());
  const startedAt = useMemo(() => new Date(startedAtIso), [startedAtIso]);

  // Default to 15 minutes ago, but never earlier than the timer's start.
  const defaultEnd = useMemo(() => {
    const fifteenAgo = new Date(now.getTime() - 15 * 60000);
    return fifteenAgo.getTime() < startedAt.getTime() ? startedAt : fifteenAgo;
  }, [now, startedAt]);

  const [value, setValue] = useState(() => hhmm(defaultEnd));

  // Resolve the "HH:mm" field to an absolute time. If it reads as "in the
  // future" (picking 11pm at 1am), roll back a day — the timer may have started
  // the previous evening.
  const resolved = useMemo(() => {
    const [h, m] = value.split(":").map(Number);
    if (
      h === undefined ||
      m === undefined ||
      !Number.isFinite(h) ||
      !Number.isFinite(m)
    ) {
      return null;
    }
    const candidate = new Date(now);
    candidate.setHours(h, m, 0, 0);
    if (candidate.getTime() > now.getTime()) {
      candidate.setDate(candidate.getDate() - 1);
    }
    return candidate;
  }, [value, now]);

  const valid =
    resolved !== null &&
    resolved.getTime() >= startedAt.getTime() &&
    resolved.getTime() <= now.getTime();

  const newDurationMs = resolved ? resolved.getTime() - startedAt.getTime() : 0;
  const untrackedMs = resolved ? now.getTime() - resolved.getTime() : 0;

  const setMinutesAgo = (mins: number) => {
    const candidate = new Date(now.getTime() - mins * 60000);
    const clamped =
      candidate.getTime() < startedAt.getTime() ? startedAt : candidate;
    setValue(hhmm(clamped));
  };

  // Only offer nudges that still land after the timer started.
  const presets = [15, 30, 60, 120].filter(
    (mins) => now.getTime() - mins * 60000 > startedAt.getTime(),
  );

  const submit = () => {
    if (pending) return;
    if (!resolved || !valid) {
      setError(
        resolved && resolved.getTime() < startedAt.getTime()
          ? "Pick a time after the timer started."
          : "Pick a time in the past.",
      );
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        await stopEntryAt(resolved.toISOString());
        onStopped();
      } catch (caught) {
        setError(
          caught instanceof Error ? caught.message : "Could not stop the timer.",
        );
      }
    });
  };

  return createPortal(
    <div
      className="calendar-modal-backdrop"
      role="presentation"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="backdated-stop-title"
        className="calendar-modal"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p
              className="text-[0.6875rem] font-semibold uppercase tracking-wider"
              style={{ color: "var(--text-faint)" }}
            >
              Stop earlier
            </p>
            <h2
              id="backdated-stop-title"
              className="mt-1 text-[1.125rem] font-semibold tracking-tight"
              style={{ color: "var(--text)" }}
            >
              When did you actually finish?
            </h2>
          </div>
          <button
            type="button"
            className="btn-icon h-8 w-8 rounded-full border"
            style={{ borderColor: "var(--border-faint)" }}
            onClick={onClose}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="mt-4 space-y-4">
          <p className="text-[0.8125rem]" style={{ color: "var(--text-muted)" }}>
            Started at {fmtTime(startedAt)}. We&apos;ll end it at the time you
            pick, then help you account for the gap up to now.
          </p>

          <div className="space-y-1.5">
            <label
              className="block text-[0.75rem] font-medium"
              style={{ color: "var(--text-muted)" }}
              htmlFor="backdated-stop-time"
            >
              Ended at
            </label>
            <div className="flex flex-wrap items-center gap-2">
              <input
                id="backdated-stop-time"
                type="time"
                value={value}
                onChange={(event) => setValue(event.target.value)}
                className="field"
                style={{ maxWidth: "9rem" }}
              />
              {presets.map((mins) => (
                <button
                  key={mins}
                  type="button"
                  onClick={() => setMinutesAgo(mins)}
                  className="rounded px-2.5 py-2 text-[0.8125rem] font-medium transition-colors"
                  style={{
                    background: "var(--bg-tint)",
                    color: "var(--text-muted)",
                  }}
                >
                  −{formatDuration(mins * 60000)}
                </button>
              ))}
            </div>
          </div>

          <div
            className="rounded-md px-3 py-2.5"
            style={{ background: "var(--bg-tint)" }}
          >
            {valid && resolved ? (
              <>
                <p
                  className="text-[0.8125rem] font-semibold tracking-tight"
                  style={{ color: "var(--text)" }}
                >
                  {formatDuration(newDurationMs)} tracked ·{" "}
                  {fmtTime(startedAt)} – {fmtTime(resolved)}
                </p>
                <p
                  className="mt-0.5 text-[0.75rem]"
                  style={{ color: "var(--text-muted)" }}
                >
                  {untrackedMs >= 60000
                    ? `${formatDuration(untrackedMs)} left untracked (${fmtTime(resolved)} – now)`
                    : "Stops right about now — nothing left untracked."}
                </p>
              </>
            ) : (
              <p
                className="text-[0.8125rem]"
                style={{ color: "var(--text-muted)" }}
              >
                Pick a time between {fmtTime(startedAt)} and now.
              </p>
            )}
          </div>

          {error ? (
            <p
              className="rounded-md px-3 py-2 text-[0.8125rem]"
              style={{
                background: "var(--accent-tint)",
                color: "var(--accent-strong)",
                border: "1px solid var(--accent-tint-strong)",
              }}
            >
              {error}
            </p>
          ) : null}

          <div
            className="sticky bottom-0 -mx-4 mt-2 flex items-center justify-between gap-3 border-t px-4 pb-1 pt-3 sm:-mx-5 sm:px-5"
            style={{
              background: "var(--bg-page)",
              borderColor: "var(--border-faint)",
            }}
          >
            <button
              type="button"
              className="btn-ghost"
              disabled={pending}
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn-ink flex-1 sm:flex-none"
              disabled={pending || !valid}
              onClick={submit}
            >
              {pending
                ? "Stopping..."
                : valid && resolved
                  ? `Stop at ${fmtTime(resolved)}`
                  : "Stop earlier"}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

// Shared trigger glyph: a clock with a counter-clockwise rewind arrow.
export function ClockRewindIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M2.2 8a5.8 5.8 0 1 1 1.7 4.1" />
      <path d="M2 12.5V9.4h3.1" />
      <path d="M8 5.2V8l1.9 1.4" />
    </svg>
  );
}
