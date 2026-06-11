"use client";

// Live "now" line for the day timeline. Client-rendered from the browser's
// own clock (epoch math against the window bounds, so server timezone can't
// shift it) and re-positioned every 30s so it never goes stale in an open tab.

import { useSyncExternalStore } from "react";

const TICK_MS = 30_000;

function subscribe(onTick: () => void) {
  const id = setInterval(onTick, TICK_MS);
  return () => clearInterval(id);
}

// Snapshot is bucketed to the tick size so it's referentially stable between
// intervals; the server snapshot is null so nothing renders until hydration.
function getSnapshot() {
  return Math.floor(Date.now() / TICK_MS);
}

function getServerSnapshot() {
  return null;
}

export function TimelineNowLine({
  windowStartIso,
  windowEndIso,
}: {
  windowStartIso: string;
  windowEndIso: string;
}) {
  const tick = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  if (tick === null) return null;

  const now = tick * TICK_MS;
  const start = new Date(windowStartIso).getTime();
  const end = new Date(windowEndIso).getTime();
  if (now < start || now > end || end <= start) return null;

  const topPct = ((now - start) / (end - start)) * 100;

  return (
    <div
      className="absolute inset-x-0 z-10"
      style={{ top: `${topPct}%`, borderTop: "1px dashed var(--accent)" }}
      aria-hidden
    />
  );
}
