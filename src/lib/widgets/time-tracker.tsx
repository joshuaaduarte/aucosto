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
      <WidgetCard name="Time" href="/app/time">
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <span
              className="ink-pulse h-2 w-2 rounded-full shrink-0"
              style={{ background: "var(--verdigris)" }}
              aria-hidden
            />
            <span className="font-mono text-[0.6875rem] uppercase tracking-[0.14em] text-ink-fade">
              Running
            </span>
          </div>
          <div>
            <p className="text-[1.5rem] font-semibold leading-tight tracking-[-0.02em] text-ink">
              {running.label}
            </p>
            <p className="mt-1 font-mono text-xs text-ink-ghost">
              started{" "}
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
    <WidgetCard name="Time" href="/app/time">
      <div className="space-y-4">
        <div>
          <p
            className="font-mono text-[2.5rem] font-medium leading-none tabular"
            style={{ color: "var(--ink)" }}
          >
            {formatHM(totalMsToday)}
          </p>
          <p className="mt-1.5 text-xs text-ink-fade">filed today</p>
        </div>
        <div
          className="flex items-center justify-between pt-3"
          style={{ borderTop: "1px solid var(--rule-faint)" }}
        >
          <span className="font-mono text-[0.6875rem] uppercase tracking-[0.12em] text-ink-ghost">
            Week
          </span>
          <span className="font-mono text-sm tabular text-ink">
            {formatHM(totalMsWeek)}
          </span>
        </div>
      </div>
    </WidgetCard>
  );
}
