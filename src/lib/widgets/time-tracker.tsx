import { getRunningEntry, listCompletedSince } from "@/lib/services/time";
import { formatHM, startOfToday, startOfWeek } from "@/lib/time";
import { sumDurations } from "@/lib/time-summary";
import { resolveActiveUserId } from "@/lib/viewer-context";
import { WidgetCard } from "./widget-card";

export async function TimeTrackerWidget() {
  const userId = await resolveActiveUserId();

  const running = await getRunningEntry(userId);

  if (running) {
    return (
      <WidgetCard name="Time tracker" href="/app/time">
        <div className="space-y-3">
          <div className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
            Running now
          </div>
          <div className="space-y-1">
            <p className="text-2xl font-semibold tracking-tight text-zinc-950">
              {running.label}
            </p>
            <p className="text-sm text-zinc-500">
              running since{" "}
              {running.startedAt.toLocaleTimeString([], {
                hour: "numeric",
                minute: "2-digit",
              })}
            </p>
          </div>
        </div>
      </WidgetCard>
    );
  }

  const [completedToday, completedWeek] = await Promise.all([
    listCompletedSince(userId, startOfToday()),
    listCompletedSince(userId, startOfWeek()),
  ]);

  const totalMsToday = sumDurations(completedToday);
  const totalMsWeek = sumDurations(completedWeek);

  return (
    <WidgetCard name="Time tracker" href="/app/time">
      <div className="space-y-4">
        <div>
          <p className="text-3xl font-semibold tracking-tight text-zinc-950">
            {formatHM(totalMsToday)}
          </p>
          <p className="mt-1 text-sm text-zinc-500">tracked today</p>
        </div>
        <div className="flex items-center justify-between rounded-2xl border border-zinc-200/80 bg-zinc-50/90 px-4 py-3 text-sm">
          <span className="text-zinc-500">This week</span>
          <span className="font-medium text-zinc-900">{formatHM(totalMsWeek)}</span>
        </div>
      </div>
    </WidgetCard>
  );
}
