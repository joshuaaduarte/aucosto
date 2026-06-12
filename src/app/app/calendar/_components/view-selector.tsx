"use client";

// Segmented 1D · 2D · 3D · W control for the calendar timeline.
//
// The chosen view drives both the URL (so the server can fetch the right span
// of days) and localStorage (so it sticks between visits). The URL is the
// source of truth while a view param is present; on a bare visit we reconcile
// to the saved preference on mount.

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

export const CALENDAR_VIEWS = ["1d", "2d", "3d", "w"] as const;
export type CalendarView = (typeof CALENDAR_VIEWS)[number];

const STORAGE_KEY = "aucosto:calendar-view";
const LABELS: Record<CalendarView, string> = {
  "1d": "1D",
  "2d": "2D",
  "3d": "3D",
  w: "W",
};

export function isCalendarView(value: string | undefined): value is CalendarView {
  return !!value && (CALENDAR_VIEWS as readonly string[]).includes(value);
}

function hrefFor(view: CalendarView, anchorDay: string) {
  return `/app/calendar?view=${view}&day=${anchorDay}`;
}

export function ViewSelector({
  view,
  anchorDay,
  hasExplicitView,
}: {
  view: CalendarView;
  /** YYYY-MM-DD anchor to preserve when switching views. */
  anchorDay: string;
  /** Whether the URL already carried an explicit ?view (skips the sync). */
  hasExplicitView: boolean;
}) {
  const router = useRouter();
  const syncedRef = useRef(false);

  // On a bare visit (no ?view), jump to the saved preference once.
  useEffect(() => {
    if (syncedRef.current) return;
    syncedRef.current = true;
    if (hasExplicitView) return;
    let saved: string | null = null;
    try {
      saved = window.localStorage.getItem(STORAGE_KEY);
    } catch {
      saved = null;
    }
    if (isCalendarView(saved ?? undefined) && saved !== view) {
      router.replace(hrefFor(saved as CalendarView, anchorDay));
    }
  }, [hasExplicitView, view, anchorDay, router]);

  const choose = (next: CalendarView) => {
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Private mode / disabled storage — URL still carries the view.
    }
    if (next !== view) router.push(hrefFor(next, anchorDay));
  };

  return (
    <div
      className="inline-flex items-center rounded-md border p-0.5"
      role="group"
      aria-label="Calendar view"
      style={{ borderColor: "var(--border-faint)", background: "var(--bg-page)" }}
    >
      {CALENDAR_VIEWS.map((option) => {
        const active = option === view;
        return (
          <button
            key={option}
            type="button"
            aria-pressed={active}
            onClick={() => choose(option)}
            className="rounded px-2 py-1 text-[0.75rem] font-semibold tabular transition-colors min-w-[2rem] [@media(pointer:coarse)]:min-h-[2.25rem]"
            style={{
              background: active ? "var(--bg-tint-strong)" : "transparent",
              color: active ? "var(--text)" : "var(--text-muted)",
            }}
          >
            {LABELS[option]}
          </button>
        );
      })}
    </div>
  );
}
