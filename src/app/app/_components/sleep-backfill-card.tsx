"use client";

// Shown on the hub on a morning where no sleep session was logged the night
// before. Two wall-clock inputs (bed time, wake time) backfill a completed
// sleep RhythmSession via POST /api/rhythms. Wall-clock → absolute conversion
// happens here in the browser (lessons #10): the server must not reinterpret
// naive times. Skip or a successful log hands off to `fallback` — the normal
// morning nudge — without a full navigation.

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";

/** Default "HH:mm" for an input, from a Date in the browser's local zone. */
function toTimeValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** Parse an "HH:mm" input into numeric parts, or null when malformed. */
function parseTime(value: string): { h: number; m: number } | null {
  const [hStr, mStr] = value.split(":");
  const h = Number(hStr);
  const m = Number(mStr);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  return { h, m };
}

/**
 * Resolve bed/wake "HH:mm" into absolute ISO timestamps. Wake is assumed to
 * be this morning (today, unless that lands in the future → yesterday). Bed
 * is the same calendar day as wake, or the day before when the bed time of
 * day is at/after the wake time of day (the normal overnight case).
 */
function resolveWindow(bed: string, wake: string): { startedAt: string; endedAt: string } | null {
  const b = parseTime(bed);
  const w = parseTime(wake);
  if (!b || !w) return null;

  const now = new Date();
  const wakeDate = new Date(now);
  wakeDate.setHours(w.h, w.m, 0, 0);
  if (wakeDate.getTime() > now.getTime()) {
    wakeDate.setDate(wakeDate.getDate() - 1);
  }

  const bedDate = new Date(wakeDate);
  bedDate.setHours(b.h, b.m, 0, 0);
  if (bedDate.getTime() >= wakeDate.getTime()) {
    bedDate.setDate(bedDate.getDate() - 1);
  }

  return { startedAt: bedDate.toISOString(), endedAt: wakeDate.toISOString() };
}

export function SleepBackfillCard({ fallback }: { fallback: ReactNode }) {
  const router = useRouter();
  const [dismissed, setDismissed] = useState(false);
  const [bed, setBed] = useState("23:00");
  // Static default keeps render pure; the real wake time is filled after mount.
  const [wake, setWake] = useState("07:00");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const raf = requestAnimationFrame(() => setWake(toTimeValue(new Date())));
    return () => cancelAnimationFrame(raf);
  }, []);

  if (dismissed) return <>{fallback}</>;

  async function logIt() {
    if (pending) return;
    const window = resolveWindow(bed, wake);
    if (!window) {
      setError("Enter both times.");
      return;
    }
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/rhythms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "start",
          type: "sleep",
          startedAt: window.startedAt,
          endedAt: window.endedAt,
        }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error ?? "Couldn't save the sleep log.");
      }
      // The hub re-derives hasRecentSleep on refresh → falls back to the nudge.
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save the sleep log.");
      setPending(false);
    }
  }

  return (
    <div
      className="rounded-md border px-4 py-3.5"
      style={{
        borderColor: "var(--border-faint)",
        borderLeft: "3px solid var(--accent)",
        background: "var(--bg-page)",
      }}
    >
      <div className="flex items-start gap-3">
        <span aria-hidden className="text-[1.375rem] leading-none">
          🌙
        </span>
        <div className="min-w-0">
          <p className="text-[0.875rem] font-semibold" style={{ color: "var(--text)" }}>
            Looks like you skipped your sleep log
          </p>
          <p className="mt-0.5 text-[0.8125rem]" style={{ color: "var(--text-muted)" }}>
            Backfill last night so your rhythm streak stays honest.
          </p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-[0.6875rem] font-medium" style={{ color: "var(--text-muted)" }}>
            Went to bed
          </span>
          <input
            type="time"
            value={bed}
            onChange={(event) => setBed(event.target.value)}
            className="field"
            style={{ width: "8rem" }}
            aria-label="Bed time"
          />
        </label>
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
        <div className="flex items-center gap-2">
          <button type="button" onClick={logIt} disabled={pending} className="btn-ink">
            {pending ? "Logging…" : "Log it"}
          </button>
          <button
            type="button"
            onClick={() => setDismissed(true)}
            disabled={pending}
            className="btn-ghost"
            style={{ color: "var(--text-faint)" }}
          >
            Skip
          </button>
        </div>
      </div>

      {error ? (
        <p
          className="mt-2 rounded-md px-3 py-2 text-[0.8125rem]"
          style={{ background: "var(--accent-tint)", color: "var(--accent-strong)" }}
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}
