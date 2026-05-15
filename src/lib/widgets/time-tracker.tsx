import { auth } from "@/auth";
import { getRunningEntry, listCompletedSince } from "@/lib/services/time";
import { formatHM, startOfToday, startOfWeek } from "@/lib/time";
import { sumDurations } from "@/lib/time-summary";
import { WidgetCard } from "./widget-card";

export async function TimeTrackerWidget() {
  const session = await auth();
  if (!session?.user?.id) return null;

  const userId = session.user.id;

  const running = await getRunningEntry(userId);

  if (running) {
    return (
      <WidgetCard name="Time tracker" href="/app/time">
        <div className="space-y-1">
          <p className="text-2xl font-semibold tracking-tight">
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
      <div className="space-y-1">
        <p className="text-2xl font-semibold tracking-tight">
          {formatHM(totalMsToday)}
        </p>
        <p className="text-sm text-zinc-500">tracked today</p>
        <p className="text-xs text-zinc-500">{formatHM(totalMsWeek)} this week</p>
      </div>
    </WidgetCard>
  );
}
