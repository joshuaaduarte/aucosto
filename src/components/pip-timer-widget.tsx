"use client";

// Self-contained widget for the ~320px Document Picture-in-Picture window.
// It renders into the PiP document via its own React root (see
// PipLaunchButton), so it can't lean on any app-level context/providers — all
// data arrives as props and every mutation is a callback the opener wired to a
// server action.
//
// Styled to feel like a popped-out slice of aucosto rather than a generic
// widget: it uses the app's CSS tokens (--bg-*, --text-*, --accent*) and the
// same utilities (eyebrow, tabular, ink-pulse, hover-row, pill) the time page
// and timer bar use — the host stylesheets are mirrored into this window, so
// they resolve and follow the same light/dark theme.
//
// The elapsed clock ticks locally (setInterval off entry.startedAtMs); the
// rest is a snapshot for the window's lifetime. Tapping an undone habit fires
// onLogHabit and optimistically flips the row to done.

import { useEffect, useState } from "react";
import { formatDuration, formatHM } from "@/lib/time";

export type PipHabit = {
  id: string;
  name: string;
  done: boolean;
  streak: number;
  /** Bucket color (categoryColor) — matches the dot color used across the app. */
  color: string;
};

export type PipEntry = {
  id: string;
  name: string;
  /** Epoch ms of the running entry's start — the live clock counts up from it. */
  startedAtMs: number;
  category?: string | null;
  /** Category color for the status dot, matching the timer bar. */
  color?: string;
  habitId?: string | null;
};

export function PipTimerWidget({
  entry,
  habits,
  totalMsToday,
  onStop,
  onSwitch,
  onLogHabit,
}: {
  entry: PipEntry;
  habits: PipHabit[];
  totalMsToday: number;
  onStop: () => void | Promise<void>;
  onSwitch: () => void;
  onLogHabit: (habitId: string) => void | Promise<void>;
}) {
  const [now, setNow] = useState(() => Date.now());
  const [stopping, setStopping] = useState(false);
  const [logged, setLogged] = useState<Record<string, boolean>>({});
  const [pending, setPending] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const elapsed = Math.max(0, now - entry.startedAtMs);
  const dotColor = entry.color ?? "var(--accent)";

  async function handleStop() {
    if (stopping) return;
    setStopping(true);
    try {
      await onStop();
    } finally {
      setStopping(false);
    }
  }

  async function handleLog(habit: PipHabit) {
    if (habit.done || logged[habit.id] || pending[habit.id]) return;
    setPending((prev) => ({ ...prev, [habit.id]: true }));
    try {
      await onLogHabit(habit.id);
      setLogged((prev) => ({ ...prev, [habit.id]: true }));
    } finally {
      setPending((prev) => ({ ...prev, [habit.id]: false }));
    }
  }

  return (
    <div
      className="flex h-screen w-screen flex-col gap-3 overflow-y-auto p-3"
      style={{
        background: "var(--bg-app)",
        color: "var(--text)",
        fontFamily:
          "var(--font-inter-tight), -apple-system, ui-sans-serif, system-ui, sans-serif",
        letterSpacing: "-0.005em",
      }}
    >
      {/* Running card — mirrors the time page's accent-tinted running block. */}
      <article
        className="rounded-md px-4 py-3.5"
        style={{
          background: "var(--accent-tint)",
          border: "1px solid var(--accent-tint-strong)",
        }}
      >
        <div className="flex items-center gap-2">
          <span
            className="ink-pulse inline-block h-1.5 w-1.5 rounded-full"
            style={{ background: dotColor }}
            aria-hidden
          />
          <span
            className="text-[0.625rem] font-semibold uppercase tracking-[0.08em]"
            style={{ color: "var(--accent-strong)" }}
          >
            Running{entry.category ? ` · ${entry.category}` : ""}
          </span>
        </div>

        <h1
          className="mt-1.5 truncate text-[1.0625rem] font-bold tracking-tight"
          style={{ color: "var(--text)", letterSpacing: "-0.018em" }}
          title={entry.name}
        >
          {entry.name}
        </h1>
        <p
          className="tabular mt-1 text-[2.5rem] font-semibold leading-none"
          style={{ color: "var(--text)", letterSpacing: "-0.03em" }}
        >
          {formatDuration(elapsed)}
        </p>

        <div className="mt-3.5 flex gap-2">
          <button
            type="button"
            onClick={handleStop}
            disabled={stopping}
            className="btn-ink h-9 flex-1 rounded-md text-[0.8125rem]"
          >
            {stopping ? "Stopping…" : "Stop"}
          </button>
          <button
            type="button"
            onClick={onSwitch}
            className="btn-ghost h-9 flex-1 rounded-md text-[0.8125rem]"
          >
            Switch
          </button>
        </div>
      </article>

      {/* Today total — quiet stat line. */}
      <div className="flex items-baseline justify-between px-1">
        <span className="eyebrow">Today</span>
        <span
          className="tabular text-[0.875rem] font-semibold"
          style={{ color: "var(--text)" }}
        >
          {formatHM(totalMsToday)}
        </span>
      </div>

      {/* Habits — same colored-dot row vocabulary as the time/habits surfaces. */}
      {habits.length > 0 ? (
        <div
          className="card-block px-2 py-2"
          style={{ background: "var(--bg-page)" }}
        >
          <p className="eyebrow mb-1 px-1">Habits</p>
          <ul className="flex flex-col">
            {habits.map((habit) => {
              const done = habit.done || Boolean(logged[habit.id]);
              const isPending = Boolean(pending[habit.id]);
              return (
                <li key={habit.id}>
                  <button
                    type="button"
                    onClick={() => handleLog(habit)}
                    disabled={done || isPending}
                    className="hover-row flex w-full items-center gap-2.5 px-1.5 py-1.5 text-left enabled:cursor-pointer disabled:cursor-default"
                    aria-label={done ? `${habit.name} — done` : `Mark ${habit.name} done`}
                  >
                    <HabitDot color={habit.color} done={done} pending={isPending} />
                    <span
                      className="min-w-0 flex-1 truncate text-[0.8125rem]"
                      style={{
                        color: done ? "var(--text-faint)" : "var(--text)",
                        textDecorationLine: done ? "line-through" : "none",
                      }}
                    >
                      {habit.name}
                    </span>
                    {habit.streak > 0 ? (
                      <span className="pill tabular shrink-0">
                        🔥 {habit.streak}
                      </span>
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

/** 14px status marker: hollow ring (tappable) → filled check (done). */
function HabitDot({
  color,
  done,
  pending,
}: {
  color: string;
  done: boolean;
  pending: boolean;
}) {
  if (done) {
    return (
      <span
        className="inline-flex h-[15px] w-[15px] shrink-0 items-center justify-center rounded-full"
        style={{ background: color }}
        aria-hidden
      >
        <svg
          width="9"
          height="9"
          viewBox="0 0 16 16"
          fill="none"
          stroke="#fff"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M3 8.5 6.5 12 13 4.5" />
        </svg>
      </span>
    );
  }
  return (
    <span
      className="inline-block h-[15px] w-[15px] shrink-0 rounded-full border-2"
      style={{
        borderColor: color,
        opacity: pending ? 1 : 0.7,
        background: pending ? color : "transparent",
      }}
      aria-hidden
    />
  );
}
