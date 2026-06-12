// Global running-timer bar (server half).
// Rendered from the app layout on every page so a live timer is always
// visible and stoppable without navigating to /app/time. Server actions
// refresh the layout tree, so starting/stopping anywhere updates the bar.

import { getRunningEntry } from "@/lib/services/time";
import { categoryColor } from "@/lib/time-categories";
import { TimerBarClient } from "./timer-bar-client";

export async function RunningTimerBar({ userId }: { userId: string }) {
  const running = await getRunningEntry(userId);
  if (!running) return null;

  return (
    <TimerBarClient
      entryId={running.id}
      entryLabel={running.label}
      color={categoryColor(running.category)}
      startedAtIso={running.startedAt.toISOString()}
      initialNotes={running.notes}
    />
  );
}
