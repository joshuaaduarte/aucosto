// Global running-timer bar (server half).
// Rendered from the app layout on every page so a live timer is always
// visible and stoppable without navigating to /app/time. Server actions
// refresh the layout tree, so starting/stopping anywhere updates the bar.

import { getRunningEntry } from "@/lib/services/time";
import { categoryColor } from "@/lib/time-categories";
import { TimerBarClient } from "./timer-bar-client";
import { loadPipState } from "./pip-data";

export async function RunningTimerBar({ userId }: { userId: string }) {
  const running = await getRunningEntry(userId);
  if (!running) return null;

  // Full PiP mini-app snapshot. Only fetched when a timer is actually running
  // (this component returns null otherwise), so idle pages pay nothing.
  const pipState = await loadPipState(userId);

  // Keyed by entry id so switching timers remounts the bar — note state and
  // the popover are seeded from props once per entry and can't leak across.
  return (
    <TimerBarClient
      key={running.id}
      entryId={running.id}
      entryLabel={running.label}
      color={categoryColor(running.category)}
      startedAtIso={running.startedAt.toISOString()}
      initialNotes={running.notes}
      pipState={pipState}
    />
  );
}
