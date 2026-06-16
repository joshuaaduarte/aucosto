"use client";

// Floating "now tracking" bar: label, live elapsed time, a note button, Stop,
// and a Switch link to the time page (where the one-tap switch panel lives).
// Hidden on /app/time itself — the running card there already shows all of
// this. Sits above the mobile tab bar; floats at the bottom on desktop.
//
// The note button opens a compact popover above the pill: type freely and it
// saves itself (1s debounce + on close/blur) without stopping the timer. Since
// this bar is always on screen, it's the highest-value place to capture a
// thought mid-task regardless of which page you're on.

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { formatDuration } from "@/lib/time";
import { stopEntry, updateEntryNotes } from "../time/actions";
import {
  BackdatedStopModal,
  ClockRewindIcon,
} from "../time/backdated-stop-modal";
import { PipLaunchButton } from "../time/pip-launch-button";
import type { PipHabit } from "@/components/pip-timer-widget";

export function TimerBarClient({
  entryId,
  entryLabel,
  entryCategory,
  color,
  startedAtIso,
  initialNotes,
  pipHabits,
  pipTotalMsToday,
}: {
  entryId: string;
  entryLabel: string;
  entryCategory: string | null;
  color: string;
  startedAtIso: string;
  initialNotes: string | null;
  pipHabits: PipHabit[];
  pipTotalMsToday: number;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const startedAt = new Date(startedAtIso).getTime();
  const [now, setNow] = useState(() => Date.now());

  const [noteOpen, setNoteOpen] = useState(false);
  const [stopAtOpen, setStopAtOpen] = useState(false);
  const [notes, setNotes] = useState(initialNotes ?? "");
  // notesRef mirrors the latest text so the document-level outside-click
  // listener (bound once per open) always flushes the current value, not the
  // value captured when the popover opened.
  const notesRef = useRef(initialNotes ?? "");
  const lastSaved = useRef(initialNotes ?? "");
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // The bar isn't remounted when you switch timers — it just re-renders with
  // new props. Re-seed the note state (and close the popover) so notes never
  // leak from one entry to the next.
  useEffect(() => {
    setNotes(initialNotes ?? "");
    notesRef.current = initialNotes ?? "";
    lastSaved.current = initialNotes ?? "";
    setNoteOpen(false);
    // entryId is the identity that changes on a switch; initialNotes rides along.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entryId]);

  const save = (value: string) => {
    if (value === lastSaved.current) return;
    lastSaved.current = value;
    void updateEntryNotes(entryId, value);
  };

  const handleChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = event.target.value;
    setNotes(value);
    notesRef.current = value;
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(() => save(value), 800);
  };

  const flush = () => {
    if (debounce.current) clearTimeout(debounce.current);
    save(notesRef.current);
  };

  // Dismiss on outside click (flushing whatever's typed first).
  useEffect(() => {
    if (!noteOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        if (debounce.current) clearTimeout(debounce.current);
        save(notesRef.current);
        setNoteOpen(false);
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
    // Reads happen through refs; save closes over only stable values.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [noteOpen]);

  if (pathname === "/app/time") return null;

  const hasNote = notes.trim().length > 0;

  return (
    <>
      {/* Publish reserved height while visible: FABs and page content read
          --timer-bar-height to shift above the bar (0 when no timer). */}
      <style>{`:root{--timer-bar-height:3.25rem}`}</style>
      <div
        className="pointer-events-none fixed inset-x-0 flex justify-center px-4"
        style={{
          zIndex: 41,
          bottom:
            "calc(var(--mobile-tabbar-height, 0px) + env(safe-area-inset-bottom, 0px) + 0.5rem)",
        }}
      >
      <div ref={wrapperRef} className="pointer-events-auto relative w-full max-w-[26rem]">
        {/* Note popover, anchored above the pill. */}
        {noteOpen ? (
          <div
            className="absolute inset-x-0 bottom-full mb-2 rounded-2xl border p-2 shadow-lg"
            style={{
              background: "var(--bg-page)",
              borderColor: "var(--border-soft)",
              boxShadow: "var(--shadow-pop)",
            }}
          >
            <textarea
              rows={2}
              value={notes}
              onChange={handleChange}
              onBlur={flush}
              placeholder="Add a note…"
              aria-label="Notes for the running session"
              className="field w-full resize-none"
              autoFocus
            />
          </div>
        ) : null}

        <div
          className="flex items-center gap-2.5 rounded-full border py-1.5 pl-3.5 pr-1.5 shadow-lg"
          style={{
            background: "var(--bg-page)",
            borderColor: "var(--border-soft)",
            boxShadow: "var(--shadow-pop)",
          }}
        >
          <span
            className="ink-pulse h-2 w-2 shrink-0 rounded-full"
            style={{ background: color }}
            aria-hidden
          />
          <Link
            href="/app/time"
            className="min-w-0 truncate text-[0.8125rem] font-medium"
            style={{ color: "var(--text)" }}
          >
            {entryLabel}
          </Link>
          <span
            className="tabular ml-auto shrink-0 text-[0.8125rem] font-semibold"
            style={{ color: "var(--text)", fontFeatureSettings: '"tnum" 1' }}
          >
            {formatDuration(now - startedAt)}
          </span>
          <button
            type="button"
            onClick={() => {
              if (noteOpen) flush();
              setNoteOpen((open) => !open);
            }}
            aria-label={hasNote ? "Edit session note" : "Add a session note"}
            aria-pressed={noteOpen}
            className="btn-icon h-8 w-8 shrink-0 rounded-full text-[0.875rem]"
            style={{
              background: noteOpen || hasNote ? "var(--bg-tint)" : "transparent",
              color: hasNote ? "var(--text)" : "var(--text-muted)",
            }}
          >
            <span aria-hidden>📝</span>
          </button>
          {/* Pop the timer into a floating always-on-top window. Desktop only
              (Document PiP is a desktop-Chrome feature) and self-hides where
              unsupported. */}
          <PipLaunchButton
            entry={{
              id: entryId,
              name: entryLabel,
              startedAtMs: startedAt,
              category: entryCategory,
              color,
            }}
            habits={pipHabits}
            totalMsToday={pipTotalMsToday}
            iconOnly
            className="btn-icon hidden h-8 w-8 shrink-0 items-center justify-center rounded-full md:inline-flex"
          />
          <Link
            href="/app/time"
            className="btn-ghost h-8 shrink-0 rounded-full px-2.5 text-[0.75rem]"
          >
            Switch
          </Link>
          {/* Secondary stop: end the entry at an earlier time. Kept as a small
              icon so the primary "Stop now" stays the fast, obvious action. */}
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              flush();
              setStopAtOpen(true);
            }}
            aria-label="Stop at an earlier time"
            className="btn-icon h-8 w-8 shrink-0 rounded-full"
            style={{ color: "var(--text-muted)" }}
          >
            <ClockRewindIcon />
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                flush();
                await stopEntry();
                router.refresh();
              })
            }
            className="btn-ink h-8 shrink-0 rounded-full px-3 text-[0.75rem]"
          >
            {pending ? "..." : "Stop"}
          </button>
        </div>
      </div>
      </div>

      {stopAtOpen ? (
        <BackdatedStopModal
          startedAtIso={startedAtIso}
          onClose={() => setStopAtOpen(false)}
          onStopped={() => {
            setStopAtOpen(false);
            // Off the time page here — send Josh to it so the gap-backfill card
            // for the freshly opened gap is right in front of him.
            router.push("/app/time");
          }}
        />
      ) : null}
    </>
  );
}
