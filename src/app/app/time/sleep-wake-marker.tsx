"use client";

// The time tracker's wake-up bookend, made editable. The wake time shown is the
// sleep session's `endedAt` (stopping the sleep timer is the wake event), so
// correcting it moves `endedAt` and re-derives the duration server-side. The
// wall-clock → ISO conversion happens here in the browser (lessons #10): we
// keep the picked time on the original wake day and hand the server an absolute
// instant, so the LA-pinned runtime never reinterprets it.
//
// Only completed sessions (endedAt set) expose the pencil — a still-running
// sleep is ended via the hub's "I'm awake", not corrected here.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatRhythmDuration, rhythmDurationMinutes } from "@/lib/rhythms";
import { updateSleepWakeTimeAction } from "./actions";

const THEME = {
  emoji: "🌅",
  background:
    "linear-gradient(to right, rgba(120,53,15,0.35), rgba(180,83,9,0.15))",
  border: "1px solid rgba(251,191,36,0.25)",
  primary: "#fde68a", // amber-200
  secondary: "#d97706", // amber-600
};

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

/** "06:17" → "6:17 AM" using a throwaway date (module fn, not a render body). */
function formatClockString(hhmm: string | null): string | null {
  if (!hhmm) return null;
  const [h, m] = hhmm.split(":").map(Number);
  if (h === undefined || m === undefined || !Number.isFinite(h) || !Number.isFinite(m)) {
    return null;
  }
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
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

export function SleepWakeMarker({
  sessionId,
  startedAtMs,
  endedAtMs,
  durationMinutes,
  wakeTime,
}: {
  sessionId: string;
  startedAtMs: number;
  endedAtMs: number | null;
  durationMinutes: number | null;
  wakeTime: string | null;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(
    endedAtMs !== null ? toTimeValue(endedAtMs) : (wakeTime ?? "07:00"),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // A concrete wake time to correct only exists once the session ended.
  const editable = endedAtMs !== null;

  const wakeLabel =
    endedAtMs !== null ? formatShortTime(endedAtMs) : formatClockString(wakeTime);
  const minutes =
    durationMinutes && durationMinutes > 0
      ? durationMinutes
      : endedAtMs !== null
        ? rhythmDurationMinutes(new Date(startedAtMs), new Date(endedAtMs))
        : null;
  const durLabel = minutes ? formatRhythmDuration(minutes) : null;

  function openEditor() {
    if (endedAtMs !== null) setDraft(toTimeValue(endedAtMs));
    setError(null);
    setEditing(true);
  }

  async function save() {
    if (saving || endedAtMs === null) return;
    const iso = wakeIso(endedAtMs, draft);
    if (!iso) {
      setError("Enter a valid time.");
      return;
    }
    setSaving(true);
    setError(null);
    const res = await updateSleepWakeTimeAction(sessionId, iso);
    if (res.ok) {
      setEditing(false);
      // The page re-reads the sleep session on refresh → marker updates.
      router.refresh();
    } else {
      setError(res.error);
      setSaving(false);
    }
  }

  const dot = (
    <span aria-hidden className="px-2" style={{ color: THEME.secondary, opacity: 0.6 }}>
      ·
    </span>
  );

  return (
    <li className="list-none">
      <div
        className="my-2 flex items-center gap-3 rounded-xl px-4 py-3"
        style={{ background: THEME.background, border: THEME.border }}
      >
        <span aria-hidden className="shrink-0 text-xl leading-none">
          {THEME.emoji}
        </span>
        {editing ? (
          <div className="flex flex-1 flex-wrap items-end gap-2">
            <label className="flex flex-col gap-1">
              <span
                className="text-[0.6875rem] font-medium"
                style={{ color: THEME.secondary }}
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
            {error ? (
              <span className="text-[0.75rem]" style={{ color: "var(--accent-strong)" }}>
                {error}
              </span>
            ) : null}
          </div>
        ) : (
          <span className="flex flex-1 items-center text-[0.8125rem] leading-snug">
            {durLabel ? (
              <>
                <span className="font-medium" style={{ color: THEME.primary }}>
                  Slept {durLabel}
                </span>
                {wakeLabel ? (
                  <>
                    {dot}
                    <span className="text-[0.75rem]" style={{ color: THEME.secondary }}>
                      woke up {wakeLabel}
                    </span>
                  </>
                ) : null}
              </>
            ) : (
              <span className="font-medium" style={{ color: THEME.primary }}>
                {wakeLabel ? `Woke up ${wakeLabel}` : "Woke up"}
              </span>
            )}
            {editable ? (
              <button
                type="button"
                onClick={openEditor}
                className="btn-icon ml-1.5"
                aria-label="Edit wake time"
                title="Edit wake time"
                style={{ color: THEME.secondary }}
              >
                ✏️
              </button>
            ) : null}
          </span>
        )}
      </div>
    </li>
  );
}
