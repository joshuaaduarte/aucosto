"use client";

// "Log spending" on the Finance page: opens the same quick-capture sheet as
// the "+" tab. `autoOpen` (from ?add=1, used by the iPhone home-screen
// shortcut and old links) opens it once on arrival.

import { useEffect, useRef } from "react";
import { openQuickCapture } from "../../_components/quick-capture";

export function LogButton({ autoOpen = false, className = "btn-ink" }: { autoOpen?: boolean; className?: string }) {
  const opened = useRef(false);
  useEffect(() => {
    if (!autoOpen || opened.current) return;
    opened.current = true;
    // Let the host mount its listener first.
    const t = window.setTimeout(() => openQuickCapture("spend"), 50);
    return () => window.clearTimeout(t);
  }, [autoOpen]);
  return (
    <button type="button" onClick={() => openQuickCapture("spend")} className={className}>
      <span aria-hidden className="mr-1.5">
        +
      </span>
      Log spending
    </button>
  );
}
