"use client";

// The hub's contextual rhythm card. The time-of-day decision MUST happen in
// the browser: the server runtime is pinned to America/Los_Angeles, so a
// server-derived hour mislabels anyone in another timezone (Eastern 5:51am
// reads as Pacific 2:51am → "sleep"). We read the visitor's real local hour
// here and pick the rhythm from that. This mirrors the lessons.md rule that
// wall-clock time is resolved on the client, not the server.
//
// SSR/first-render is null (hour unknown) so there's no hydration mismatch and
// no flash of the wrong rhythm; the card appears once mounted.

import { useEffect, useState } from "react";
import { suggestedRhythmForHour, type RhythmType } from "@/lib/rhythms";
import { RhythmNudge } from "./rhythm-nudge";
import { SleepBackfillCard } from "./sleep-backfill-card";

export function RhythmHubCard({
  activeTypes,
  hasRecentSleep,
}: {
  /** Rhythm types with a currently-running session. */
  activeTypes: RhythmType[];
  /** Whether a sleep session was logged since ~6pm yesterday (server-derived). */
  hasRecentSleep: boolean;
}) {
  const [hour, setHour] = useState<number | null>(null);

  useEffect(() => {
    // setState kept out of the effect body (react-hooks/set-state-in-effect).
    const sync = () => setHour(new Date().getHours());
    const raf = requestAnimationFrame(sync);
    // Re-check on a slow interval so the card follows hour rollovers without a
    // reload (e.g. someone leaving the hub open through a transition).
    const interval = setInterval(sync, 60_000);
    return () => {
      cancelAnimationFrame(raf);
      clearInterval(interval);
    };
  }, []);

  if (hour === null) return null;

  const suggested = suggestedRhythmForHour(hour);
  const activeType = activeTypes.includes(suggested)
    ? suggested
    : activeTypes[0] ?? null;
  const showSleepBackfill = suggested === "wakeup" && !hasRecentSleep;

  const nudge = <RhythmNudge suggestedType={suggested} activeType={activeType} />;

  return showSleepBackfill ? <SleepBackfillCard fallback={nudge} /> : nudge;
}
