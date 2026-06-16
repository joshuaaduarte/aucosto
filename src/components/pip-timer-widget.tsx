"use client";

// Self-contained widget for the ~320px Document Picture-in-Picture window.
// It renders into the PiP document via its own React root (see
// PipLaunchButton), so it can't rely on any app-level context/providers — all
// data arrives as props and every mutation is a callback the opener wired to a
// server action. It's a floating overlay, so it's deliberately dark.
//
// The elapsed clock ticks locally (setInterval) off `entry.startedAtMs`; the
// rest is static for the lifetime of the window. Tapping an undone habit fires
// onLogHabit and optimistically flips the row to done.

import { useEffect, useState } from "react";
import { formatDuration, formatHM } from "@/lib/time";

export type PipHabit = {
  id: string;
  name: string;
  done: boolean;
  streak: number;
};

export type PipEntry = {
  id: string;
  name: string;
  /** Epoch ms of the running entry's start — the live clock counts up from it. */
  startedAtMs: number;
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
  // Optimistic per-habit state: rows the user has logged this session, and rows
  // mid-flight (so a double-tap doesn't fire the action twice).
  const [logged, setLogged] = useState<Record<string, boolean>>({});
  const [pending, setPending] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const elapsed = Math.max(0, now - entry.startedAtMs);

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
      className="flex h-screen w-screen flex-col gap-4 overflow-y-auto px-4 py-4"
      style={{
        background: "#0f0f0f",
        color: "#f5f5f5",
        fontFamily:
          "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif",
      }}
    >
      {/* Status badge */}
      <div className="flex items-center gap-2">
        <span
          className="inline-block h-2 w-2 rounded-full"
          style={{ background: "#22c55e", boxShadow: "0 0 6px #22c55e" }}
          aria-hidden
        />
        <span
          className="text-[0.6875rem] font-semibold uppercase tracking-[0.12em]"
          style={{ color: "#22c55e" }}
        >
          Running
        </span>
      </div>

      {/* Entry name + live elapsed */}
      <div>
        <p
          className="truncate text-[1.25rem] font-bold leading-tight"
          style={{ color: "#fafafa" }}
          title={entry.name}
        >
          {entry.name}
        </p>
        <p
          className="mt-1 text-[2.25rem] font-semibold leading-none"
          style={{
            color: "#fafafa",
            fontFamily: "ui-monospace, 'SF Mono', Menlo, monospace",
            fontFeatureSettings: '"tnum" 1',
            letterSpacing: "-0.02em",
          }}
        >
          {formatDuration(elapsed)}
        </p>
      </div>

      {/* Primary actions */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleStop}
          disabled={stopping}
          className="flex-1 rounded-lg px-3 py-2 text-[0.875rem] font-semibold transition-opacity disabled:opacity-60"
          style={{ background: "#dc2626", color: "#fff" }}
        >
          {stopping ? "Stopping…" : "Stop"}
        </button>
        <button
          type="button"
          onClick={onSwitch}
          className="flex-1 rounded-lg border px-3 py-2 text-[0.875rem] font-semibold"
          style={{ borderColor: "#3f3f46", color: "#e5e5e5", background: "transparent" }}
        >
          Switch
        </button>
      </div>

      {/* Today total */}
      <div>
        <div className="flex items-center gap-2">
          <span
            className="text-[0.625rem] font-semibold uppercase tracking-[0.12em]"
            style={{ color: "#a1a1aa" }}
          >
            Today
          </span>
          <span className="h-px flex-1" style={{ background: "#27272a" }} aria-hidden />
        </div>
        <p className="mt-1.5 text-[0.875rem]" style={{ color: "#d4d4d8" }}>
          Total: <span className="font-semibold" style={{ color: "#fafafa" }}>{formatHM(totalMsToday)}</span>
        </p>
      </div>

      {/* Habits */}
      {habits.length > 0 ? (
        <div>
          <p
            className="mb-1.5 text-[0.625rem] font-semibold uppercase tracking-[0.12em]"
            style={{ color: "#a1a1aa" }}
          >
            Habits
          </p>
          <ul className="flex flex-col gap-0.5">
            {habits.map((habit) => {
              const done = habit.done || logged[habit.id];
              const isPending = pending[habit.id];
              return (
                <li key={habit.id}>
                  <button
                    type="button"
                    onClick={() => handleLog(habit)}
                    disabled={done || isPending}
                    className="flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-[0.8125rem] transition-colors enabled:hover:bg-white/5 disabled:cursor-default"
                    aria-label={done ? `${habit.name} — done` : `Mark ${habit.name} done`}
                  >
                    {done ? (
                      <CheckIcon />
                    ) : (
                      <span
                        className="inline-block h-[14px] w-[14px] shrink-0 rounded-full border"
                        style={{ borderColor: isPending ? "#22c55e" : "#52525b" }}
                        aria-hidden
                      />
                    )}
                    <span
                      className="min-w-0 flex-1 truncate"
                      style={{
                        color: done ? "#71717a" : "#e5e5e5",
                        textDecorationLine: done ? "line-through" : "none",
                      }}
                    >
                      {habit.name}
                    </span>
                    {habit.streak > 0 ? (
                      <span
                        className="shrink-0 text-[0.75rem] tabular-nums"
                        style={{ color: "#fb923c" }}
                      >
                        🔥{habit.streak}
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

function CheckIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="none"
      stroke="#22c55e"
      strokeWidth="2.25"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="shrink-0"
      aria-hidden
    >
      <path d="M3 8.5 6.5 12 13 4.5" />
    </svg>
  );
}
