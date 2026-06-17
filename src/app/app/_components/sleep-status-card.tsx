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

/** new Date(number) is deterministic → safe in a client render body. */
function formatShortTime(ms: number): string {
  return new Date(ms).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

function toTimeValue(ms: number): string {
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Build an absolute ISO from the picked "HH:mm" on the original wake day. */
function wakeIso(endedAtMs: number, hhmm: string): string | null {
  const [h, m] = hhmm.split(":").map(Number);
  if (h === undefined || m === undefined || !Number.isFinite(h) || !Number.isFinite(m)) {
    return null;
  }
  const d = new Date(endedAtMs);
  d.setHours(h, m, 0, 0);
  return d.toISOString();
}

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
  endedAtMs,
  sleepMinutes,
  sessionId,
}: {
  state: "running" | "logged" | "none";
  /** When state === "none": "bedtime" → going to bed; "backfill" → log last night. */
  mode: "bedtime" | "backfill";
  /** Start (ms) of a running session, for "Sleeping since …". */
  startedAtMs: number | null;
  /** End (ms) of a completed session — the wake time, editable via the pencil. */
  endedAtMs: number | null;
  /** Duration (minutes) of a completed session, for "Slept …". */
  sleepMinutes: number | null;
  /** Session id — ends a running session, or targets the wake-time edit. */
  sessionId: string | null;
}) {
  if (state === "running") {
    return <SleepRunning startedAtMs={startedAtMs} sessionId={sessionId} />;
  }
  if (state === "logged") {
    return (
      <SleepLogged
        sleepMinutes={sleepMinutes}
        sessionId={sessionId}
        endedAtMs={endedAtMs}
      />
    );
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

function SleepLogged({
  sleepMinutes,
  sessionId,
  endedAtMs,
}: {
  sleepMinutes: number | null;
  sessionId: string | null;
  endedAtMs: number | null;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(
    endedAtMs !== null ? toTimeValue(endedAtMs) : "07:00",
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Editing the wake time means moving the session's endedAt — only possible
  // when we have both the session id and a concrete end time.
  const editable = sessionId !== null && endedAtMs !== null;
  const wokeLabel = endedAtMs !== null ? formatShortTime(endedAtMs) : null;

  function openEditor() {
    if (endedAtMs !== null) setDraft(toTimeValue(endedAtMs));
    setError(null);
    setEditing(true);
  }

  async function save() {
    if (saving || sessionId === null || endedAtMs === null) return;
    const iso = wakeIso(endedAtMs, draft);
    if (!iso) {
      setError("Enter a valid time.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/rhythms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update-sleep-wake",
          sessionId,
          wakeAt: iso,
        }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error ?? "Couldn't update your wake time.");
      }
      setEditing(false);
      // The hub re-derives the sleep cycle on refresh → the line updates.
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't update your wake time.");
      setSaving(false);
    }
  }

  return (
    <Shell>
      <div className="flex items-start gap-3">
        <span aria-hidden className="text-[1.375rem] leading-none">
          😴
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[0.875rem] font-semibold" style={{ color: "var(--text)" }}>
            {sleepMinutes && sleepMinutes > 0
              ? `Slept ${formatRhythmDuration(sleepMinutes)}`
              : "Sleep logged"}
          </p>
          {editing ? (
            <div className="mt-1.5 flex flex-wrap items-end gap-2">
              <label className="flex flex-col gap-1">
                <span
                  className="text-[0.6875rem] font-medium"
                  style={{ color: "var(--text-muted)" }}
                >
                  Woke up
                </span>
                <input
                  type="time"
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  className="field"
                  style={{ width: "8rem" }}
                  aria-label="Wake time"
                  autoFocus
                />
              </label>
              <button type="button" onClick={save} disabled={saving} className="btn-ink">
                {saving ? "Saving…" : "Save"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditing(false);
                  setError(null);
                }}
                disabled={saving}
                className="btn-ghost"
                style={{ color: "var(--text-faint)" }}
              >
                Cancel
              </button>
            </div>
          ) : (
            <p
              className="mt-0.5 flex items-center gap-1.5 text-[0.8125rem]"
              style={{ color: "var(--text-muted)" }}
            >
              <span>{wokeLabel ? `Woke up ${wokeLabel} · last night` : "Last night"}</span>
              {editable ? (
                <button
                  type="button"
                  onClick={openEditor}
                  className="btn-icon"
                  aria-label="Edit wake time"
                  title="Edit wake time"
                  style={{ color: "var(--text-faint)" }}
                >
                  ✏️
                </button>
              ) : null}
            </p>
          )}
          {error ? (
            <p
              className="mt-2 rounded-md px-3 py-2 text-[0.8125rem]"
              style={{ background: "var(--accent-tint)", color: "var(--accent-strong)" }}
            >
              {error}
            </p>
          ) : null}
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
