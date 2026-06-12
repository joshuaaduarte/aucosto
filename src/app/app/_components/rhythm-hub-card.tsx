"use client";

// The hub's contextual Rhythm card. Rhythms aren't a page — they're the
// connective tissue the hub grows at the day's edges. Two flows live here:
//
//   • Morning check-in (05:00–10:00): log your wake time, knock out morning
//     habits, then wrap it up.
//   • Bedtime check-in (21:00–05:00): a reflection nudge and a "going to bed"
//     toggle that opens a sleep session.
//
// The time-of-day decision MUST happen in the browser: the server runtime is
// pinned to America/Los_Angeles, so a server-derived hour mislabels anyone in
// another timezone (lessons.md). We read the visitor's real local hour here.
// SSR/first render is null (hour unknown) → no hydration mismatch, no flash.

import {
  useEffect,
  useState,
  useTransition,
  type ReactNode,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { quickLogHabitAction } from "../habits/actions";
import { formatRhythmDuration } from "@/lib/rhythms";
import { SleepBackfillCard } from "./sleep-backfill-card";

export type MorningCardState = {
  /** A wakeup session exists for today (the morning was started). */
  started: boolean;
  /** That session was wrapped up ("Done with morning"). */
  completed: boolean;
  /** "HH:mm" the user reported waking, if captured. */
  wakeTime: string | null;
  /** Sleep carried over from last night, in minutes. */
  sleepMinutes: number | null;
};

export type MorningHabit = { id: string; title: string; completedToday: boolean };

function CardShell({
  accent,
  children,
}: {
  accent: string;
  children: ReactNode;
}) {
  return (
    <div
      className="rounded-md border px-4 py-3.5"
      style={{
        borderColor: "var(--border-faint)",
        borderLeft: `3px solid ${accent}`,
        background: "var(--bg-page)",
      }}
    >
      {children}
    </div>
  );
}

/** Default "HH:mm" for an input, from a Date in the browser's local zone. */
function toTimeValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/**
 * Pretty "6:32am" from an "HH:mm" string. Kept Date-free so it's safe to call
 * during render (react-hooks/purity flags argless `new Date()` in a body).
 */
function prettyTime(value: string): string {
  const [h, m] = value.split(":").map(Number);
  if (h === undefined || m === undefined || !Number.isFinite(h) || !Number.isFinite(m)) return value;
  const period = h < 12 ? "am" : "pm";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, "0")}${period}`;
}

/* ── State A: log wake time ──────────────────────────────────────── */

function MorningStart() {
  const router = useRouter();
  // Static default keeps render pure; the real wake time fills in after mount.
  const [wake, setWake] = useState("07:00");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const raf = requestAnimationFrame(() => setWake(toTimeValue(new Date())));
    return () => cancelAnimationFrame(raf);
  }, []);

  async function startMorning() {
    if (pending) return;
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/rhythms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "morning", wakeTime: wake }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error ?? "Couldn't start your morning.");
      }
      // The hub re-derives morning.started on refresh → advances to State B.
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't start your morning.");
      setPending(false);
    }
  }

  return (
    <CardShell accent="#f59e0b">
      <div className="flex items-start gap-3">
        <span aria-hidden className="text-[1.375rem] leading-none">
          🌅
        </span>
        <div className="min-w-0">
          <p className="text-[0.875rem] font-semibold" style={{ color: "var(--text)" }}>
            Good morning
          </p>
          <p className="mt-0.5 text-[0.8125rem]" style={{ color: "var(--text-muted)" }}>
            What time did you wake up?
          </p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-[0.6875rem] font-medium" style={{ color: "var(--text-muted)" }}>
            Woke up
          </span>
          <input
            type="time"
            value={wake}
            onChange={(event) => setWake(event.target.value)}
            className="field"
            style={{ width: "8rem" }}
            aria-label="Wake time"
          />
        </label>
        <button type="button" onClick={startMorning} disabled={pending} className="btn-ink">
          {pending ? "Starting…" : "Start my morning"}
        </button>
      </div>

      {error ? (
        <p
          className="mt-2 rounded-md px-3 py-2 text-[0.8125rem]"
          style={{ background: "var(--accent-tint)", color: "var(--accent-strong)" }}
        >
          {error}
        </p>
      ) : null}
    </CardShell>
  );
}

/* ── State B: morning in progress ────────────────────────────────── */

function MorningInProgress({
  morning,
  habits,
}: {
  morning: MorningCardState;
  habits: MorningHabit[];
}) {
  const router = useRouter();
  const [doneIds, setDoneIds] = useState<Set<string>>(new Set());
  const [logging, startLogging] = useTransition();
  const [wrapping, setWrapping] = useState(false);

  function logHabit(id: string) {
    if (doneIds.has(id)) return;
    setDoneIds((prev) => new Set(prev).add(id)); // optimistic
    const formData = new FormData();
    formData.set("id", id);
    startLogging(async () => {
      await quickLogHabitAction(formData);
      router.refresh();
    });
  }

  async function wrapUp() {
    if (wrapping) return;
    setWrapping(true);
    try {
      await fetch("/api/rhythms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "complete-morning" }),
      });
    } finally {
      router.refresh();
    }
  }

  const sleepLine =
    morning.sleepMinutes && morning.sleepMinutes > 0
      ? `Slept ~${formatRhythmDuration(morning.sleepMinutes)}`
      : null;

  return (
    <CardShell accent="#f59e0b">
      <div className="flex items-start gap-3">
        <span aria-hidden className="text-[1.375rem] leading-none">
          ☀️
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[0.875rem] font-semibold" style={{ color: "var(--text)" }}>
            Your morning
          </p>
          <p className="mt-0.5 text-[0.8125rem]" style={{ color: "var(--text-muted)" }}>
            {morning.wakeTime ? `Up since ${prettyTime(morning.wakeTime)}` : "In progress"}
            {sleepLine ? ` · ${sleepLine}` : ""}
          </p>
        </div>
      </div>

      {habits.length > 0 ? (
        <div className="mt-3">
          <p
            className="text-[0.6875rem] font-semibold uppercase tracking-wider"
            style={{ color: "var(--text-faint)" }}
          >
            Morning habits
          </p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {habits.map((habit) => {
              const done = habit.completedToday || doneIds.has(habit.id);
              return (
                <button
                  key={habit.id}
                  type="button"
                  disabled={done || logging}
                  onClick={() => logHabit(habit.id)}
                  className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[0.75rem] font-medium transition-colors"
                  style={{
                    borderColor: done ? "transparent" : "var(--border-faint)",
                    background: done ? "var(--accent-tint)" : "var(--bg-tint)",
                    color: done ? "var(--accent-strong)" : "var(--text-muted)",
                  }}
                >
                  <span aria-hidden>{done ? "✓" : "+"}</span>
                  {habit.title}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <Link
          href="/app/do"
          className="text-[0.8125rem] underline-offset-2 hover:underline"
          style={{ color: "var(--text-muted)" }}
        >
          What are you starting with? →
        </Link>
        <button
          type="button"
          onClick={wrapUp}
          disabled={wrapping}
          className="btn-ghost text-[0.8125rem]"
          style={{ color: "var(--text-faint)" }}
        >
          {wrapping ? "…" : "Done with morning"}
        </button>
      </div>
    </CardShell>
  );
}

/* ── Bedtime check-in ────────────────────────────────────────────── */

function BedtimeCard({
  hasReflectionToday,
  activeSleepStartedAtMs,
}: {
  hasReflectionToday: boolean;
  activeSleepStartedAtMs: number | null;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function goToBed() {
    if (pending) return;
    setPending(true);
    try {
      await fetch("/api/rhythms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "start", type: "sleep" }),
      });
    } finally {
      router.refresh();
    }
  }

  // Sleep already running → minimal "rest well" state.
  if (activeSleepStartedAtMs !== null) {
    const startLabel = new Date(activeSleepStartedAtMs).toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit",
    });
    return (
      <CardShell accent="#6366f1">
        <div className="flex items-start gap-3">
          <span aria-hidden className="text-[1.375rem] leading-none">
            🌙
          </span>
          <div className="min-w-0">
            <p className="text-[0.875rem] font-semibold" style={{ color: "var(--text)" }}>
              Sleep started. Rest well.
            </p>
            <p className="mt-0.5 text-[0.8125rem]" style={{ color: "var(--text-muted)" }}>
              Since {startLabel}
            </p>
          </div>
        </div>
      </CardShell>
    );
  }

  return (
    <CardShell accent="#6366f1">
      <div className="flex items-start gap-3">
        <span aria-hidden className="text-[1.375rem] leading-none">
          🌇
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[0.875rem] font-semibold" style={{ color: "var(--text)" }}>
            Time to wind down.
          </p>
          {hasReflectionToday ? (
            <p
              className="mt-0.5 text-[0.8125rem] font-medium"
              style={{ color: "#10b981" }}
            >
              Reflection done ✓
            </p>
          ) : (
            <Link
              href="/app/reflect"
              className="mt-0.5 inline-block text-[0.8125rem] underline-offset-2 hover:underline"
              style={{ color: "var(--accent-strong)" }}
            >
              Daily reflection not done →
            </Link>
          )}
        </div>
      </div>

      <div className="mt-3">
        <button type="button" onClick={goToBed} disabled={pending} className="btn-ink">
          {pending ? "…" : "Going to bed"}
        </button>
      </div>
    </CardShell>
  );
}

/* ── Time-of-day router ──────────────────────────────────────────── */

export function RhythmHubCard({
  morning,
  morningHabits,
  hasReflectionToday,
  hasRecentSleep,
  activeSleepStartedAtMs,
}: {
  morning: MorningCardState | null;
  morningHabits: MorningHabit[];
  hasReflectionToday: boolean;
  /** Whether a sleep session was logged since ~6pm yesterday. */
  hasRecentSleep: boolean;
  /** Start time (ms) of a running sleep session, or null. */
  activeSleepStartedAtMs: number | null;
}) {
  const [hour, setHour] = useState<number | null>(null);

  useEffect(() => {
    const sync = () => setHour(new Date().getHours());
    const raf = requestAnimationFrame(sync);
    // Follow hour rollovers without a reload (e.g. left open across a window).
    const interval = setInterval(sync, 60_000);
    return () => {
      cancelAnimationFrame(raf);
      clearInterval(interval);
    };
  }, []);

  if (hour === null) return null;

  const inMorning = hour >= 5 && hour < 10;
  const inBedtime = hour >= 21 || hour < 5;

  if (inMorning) {
    if (morning?.completed) return null; // State C — wrapped up, gone for the day
    if (morning?.started) {
      return <MorningInProgress morning={morning} habits={morningHabits} />;
    }
    const start = <MorningStart />;
    // Forgot to log sleep last night → offer a backfill first, then the
    // wake-time prompt (reuses the existing card's fallback composition).
    return hasRecentSleep ? start : <SleepBackfillCard fallback={start} />;
  }

  if (inBedtime) {
    return (
      <BedtimeCard
        hasReflectionToday={hasReflectionToday}
        activeSleepStartedAtMs={activeSleepStartedAtMs}
      />
    );
  }

  return null; // 10:00–21:00 → normal work-mode hub
}
