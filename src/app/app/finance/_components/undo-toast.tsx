"use client";

// A short-lived "Logged $12 at Trader Joe's · Undo" bar. Sits above the
// mobile tab bar / timer bar (z-index ladder: FABs are 42) and disappears
// after a few seconds. Undo replaces "Are you sure?" dialogs on the finance
// page: act first, take it back if it was a mistake.

import { useEffect, useState } from "react";

export type UndoToastState = {
  id: number;
  message: string;
  onUndo?: () => void | Promise<void>;
} | null;

export function UndoToast({ toast, onClose }: { toast: UndoToastState; onClose: () => void }) {
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(onClose, 6000);
    return () => window.clearTimeout(timer);
  }, [toast, onClose]);

  if (!toast) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed left-1/2 z-[42] flex w-[min(28rem,calc(100vw-2rem))] -translate-x-1/2 items-center justify-between gap-3 rounded-md px-4 py-3 shadow-lg"
      style={{
        bottom:
          "calc(var(--mobile-tabbar-height, 0px) + var(--timer-bar-height, 0px) + var(--safe-area-bottom, 0px) + 0.75rem)",
        background: "var(--text)",
        color: "var(--bg-page)",
      }}
    >
      <span className="min-w-0 truncate text-[0.875rem]">{toast.message}</span>
      <div className="flex shrink-0 items-center gap-1">
        {toast.onUndo ? (
          <button
            type="button"
            disabled={busy}
            className="rounded px-2 py-1 text-[0.875rem] font-semibold underline-offset-4 hover:underline"
            onClick={async () => {
              setBusy(true);
              try {
                await toast.onUndo?.();
              } finally {
                setBusy(false);
                onClose();
              }
            }}
          >
            {busy ? "Undoing…" : "Undo"}
          </button>
        ) : null}
        <button
          type="button"
          aria-label="Dismiss"
          className="rounded px-2 py-1 text-[0.875rem] opacity-70 hover:opacity-100"
          onClick={onClose}
        >
          ✕
        </button>
      </div>
    </div>
  );
}
