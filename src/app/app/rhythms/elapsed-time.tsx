"use client";

import { useEffect, useState } from "react";

function format(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  if (hours > 0) return `${hours}:${pad(minutes)}:${pad(seconds)}`;
  return `${minutes}:${pad(seconds)}`;
}

/** Live "time since started" counter for a running rhythm session. */
export function ElapsedTime({ startedAtMs }: { startedAtMs: number }) {
  const [now, setNow] = useState(startedAtMs);

  useEffect(() => {
    // Sync to the real clock after mount (kept out of the effect body itself
    // to satisfy react-hooks/set-state-in-effect), then tick every second.
    const raf = requestAnimationFrame(() => setNow(Date.now()));
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      cancelAnimationFrame(raf);
      clearInterval(id);
    };
  }, []);

  return (
    <span className="font-mono tabular" suppressHydrationWarning>
      {format(now - startedAtMs)}
    </span>
  );
}
