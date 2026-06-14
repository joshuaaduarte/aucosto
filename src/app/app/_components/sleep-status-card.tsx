"use client";

// The hub's always-on sleep card. Unlike the morning/bedtime rhythm flows,
// this is NEVER gated behind a time-of-day window — sleep state is always
// present on the hub, the way the running-timer bar always is. It reflects one
// of three states for the current night:
//
//   • running  → a live sleep session ("Sleeping since 11:30pm" + I'm awake)
//   • logged   → last night's completed sleep ("Slept 7h 20m")
//   • none     → no session for the cycle yet. The prompt copy depends on the
//                hour (decided on the server, LA-pinned): "Going to bed" from
//                6pm on, or a backfill form for last night before 6pm.
//
// The cycle/state/mode are derived on the server (src/app/app/page.tsx) so the
// card renders fully on first paint — no SSR flash, no client-hour gate.

import { useState } from "react";
import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { formatRhythmDuration } from "@/lib/rhythms";
import { SleepBackfillCard } from "./sleep-backfill-card";

const SLEEP_ACCENT = "#6366f1";

function Shell({ children }: { children: ReactNode }) {
  return (
    <div
      className="rounded-md border px-4 py-3.5"
      style={{
        borderColor: "var(--border-faint)",
        borderLeft: `3px solid ${SLEEP_ACCENT}`,
        background: "var(--bg-page)",
      }}
    >
      {children}
    </div>
  );
}

export function SleepStatusCard({
  state,
  mode,
  startedAtMs,
  sleepMinutes,
  sessionId,
}: {
  state: "running" | "logged" | "none";
  /** When state === "none": "bedtime" → going to bed; "backfill" → log last night. */
  mode: "bedtime" | "backfill";
  /** Start (ms) of a running session, for "Sleeping since …". */
  startedAtMs: number | null;
  /** Duration (minutes) of a completed session, for "Slept …". */
  sleepMinutes: number | null;
  /** Running session id, so "I'm awake" can end it. */
  sessionId: string | null;
}) {
  if (state === "running") {
    return <SleepRunning startedAtMs={startedAtMs} sessionId={sessionId} />;
  }
  if (state === "logged") {
    return <SleepLogged sleepMinutes={sleepMinutes} />;
  }
  if (mode === "backfill") {
    // Awake but never logged → offer to backfill last night (persistent: no
    // skip, the prompt stays until a session exists).
    return <SleepBackfillCard />;
  }
  return <SleepBedtime />;
}

/* ── Running: a live sleep session ───────────────────────────────── */

function SleepRunning({
  startedAtMs,
  sessionId,
}: {
  startedAtMs: number | null;
  sessionId: string | null;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  // new Date(number) is deterministic → safe in a client render body.
  const since =
    startedAtMs !== null
      ? new Date(startedAtMs).toLocaleTimeString([], {
          hour: "numeric",
          minute: "2-digit",
        })
      : null;

  async function wake() {
    if (pending || !sessionId) return;
    setPending(true);
    try {
      await fetch("/api/rhythms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "end", sessionId }),
      });
    } finally {
      router.refresh();
    }
  }

  return (
    <Shell>
      <div className="flex items-start gap-3">
        <span aria-hidden className="text-[1.375rem] leading-none">
          🌙
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[0.875rem] font-semibold" style={{ color: "var(--text)" }}>
            Sleeping
          </p>
          <p className="mt-0.5 text-[0.8125rem]" style={{ color: "var(--text-muted)" }}>
            {since ? `Since ${since}` : "In progress"}
          </p>
        </div>
        <button
          type="button"
          onClick={wake}
          disabled={pending || !sessionId}
          className="btn-ghost text-[0.8125rem]"
          style={{ color: "var(--text-faint)" }}
        >
          {pending ? "…" : "I'm awake"}
        </button>
      </div>
    </Shell>
  );
}

/* ── Logged: last night's completed sleep ────────────────────────── */

function SleepLogged({ sleepMinutes }: { sleepMinutes: number | null }) {
  return (
    <Shell>
      <div className="flex items-start gap-3">
        <span aria-hidden className="text-[1.375rem] leading-none">
          😴
        </span>
        <div className="min-w-0">
          <p className="text-[0.875rem] font-semibold" style={{ color: "var(--text)" }}>
            {sleepMinutes && sleepMinutes > 0
              ? `Slept ${formatRhythmDuration(sleepMinutes)}`
              : "Sleep logged"}
          </p>
          <p className="mt-0.5 text-[0.8125rem]" style={{ color: "var(--text-muted)" }}>
            Last night
          </p>
        </div>
      </div>
    </Shell>
  );
}

/* ── None / bedtime: start a live sleep session ──────────────────── */

function SleepBedtime() {
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

  return (
    <Shell>
      <div className="flex items-start gap-3">
        <span aria-hidden className="text-[1.375rem] leading-none">
          🌙
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[0.875rem] font-semibold" style={{ color: "var(--text)" }}>
            Track your sleep
          </p>
          <p className="mt-0.5 text-[0.8125rem]" style={{ color: "var(--text-muted)" }}>
            Start a sleep session when you head to bed.
          </p>
        </div>
      </div>
      <div className="mt-3">
        <button type="button" onClick={goToBed} disabled={pending} className="btn-ink">
          {pending ? "…" : "Going to bed"}
        </button>
      </div>
    </Shell>
  );
}
