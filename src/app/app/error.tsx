"use client";

// Error boundary for tool pages — degrade, don't die (docs/lessons.md #2–#4).
// Keeps the sidebar/tab bar alive and offers a retry instead of Next's raw
// crash screen.
import { useEffect } from "react";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[app] page render failed", error);
  }, [error]);

  return (
    <div className="fade-in flex flex-col items-start gap-4 py-10">
      <p
        className="text-[0.6875rem] font-semibold uppercase tracking-wider"
        style={{ color: "var(--text-faint)" }}
      >
        Something broke
      </p>
      <h1
        className="text-[1.25rem] font-semibold tracking-tight"
        style={{ color: "var(--text)" }}
      >
        This page hit an error.
      </h1>
      <p className="text-[0.875rem]" style={{ color: "var(--text-muted)" }}>
        Your data is fine — the page just failed to render.
        {error.digest ? ` (ref ${error.digest})` : ""}
      </p>
      <button type="button" className="btn-ink" onClick={reset}>
        Try again
      </button>
    </div>
  );
}
