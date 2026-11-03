"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

// Shared "start a timer from X" button. The caller passes the tool-specific
// server action (e.g. startDoItemTimerAction, startHabitTimerAction). The
// timer starts in place — no navigation — and shows up in the global
// running-timer bar; starting auto-stops any previous timer.
export function StartTimerButton({
  id,
  action,
  compact = false,
  label,
}: {
  id: string;
  action: (formData: FormData) => Promise<unknown>;
  /** Round play icon instead of a "Start timer" button (for dense rows). */
  compact?: boolean;
  /** Accessible name for the compact variant, e.g. "Start a timer for X". */
  label?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const start = () => {
    startTransition(async () => {
      const formData = new FormData();
      formData.set("id", id);
      await action(formData);
      router.refresh();
    });
  };

  if (compact) {
    return (
      <button
        type="button"
        className="btn-icon shrink-0"
        disabled={pending}
        onClick={start}
        aria-label={label ?? "Start timer"}
        title="Start timer"
      >
        {pending ? (
          "…"
        ) : (
          <svg width="13" height="13" viewBox="0 0 14 14" fill="currentColor" aria-hidden>
            <path d="M4 2.5v9l7.5-4.5L4 2.5Z" />
          </svg>
        )}
      </button>
    );
  }

  return (
    <button
      className="btn-ghost h-8 w-full px-2.5 text-[0.75rem]"
      type="button"
      disabled={pending}
      onClick={start}
    >
      {pending ? "Starting..." : "Start timer"}
    </button>
  );
}
