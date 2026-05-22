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
        <div className="space-y-3">
          <span
            className="inline-flex items-center gap-1.5 rounded px-1.5 py-0.5 text-[0.625rem] font-medium uppercase tracking-wider"
            style={{
              background: "var(--accent-tint)",
              color: "var(--accent-strong)",
            }}
          >
            <span
              className="ink-pulse inline-block h-1 w-1 rounded-full"
              style={{ background: "var(--accent)" }}
            />
            Running
          </span>
          <div>
            <p
              className="truncate text-[1rem] font-semibold tracking-tight"
              style={{ color: "var(--text)" }}
            >
              {running.label}
            </p>
            <p
              className="mt-0.5 text-[0.75rem]"
              style={{ color: "var(--text-faint)" }}
            >
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
      <div className="space-y-3">
        <div>
          <p
            className="text-[1.625rem] font-semibold tracking-tight tabular"
            style={{ color: "var(--text)", letterSpacing: "-0.025em" }}
          >
            {formatHM(totalMsToday)}
          </p>
          <p
            className="mt-0.5 text-[0.75rem]"
            style={{ color: "var(--text-faint)" }}
          >
            logged today
          </p>
        </div>
        <div
          className="flex items-center justify-between pt-2"
          style={{ borderTop: "1px solid var(--border-faint)" }}
        >
          <span
            className="text-[0.6875rem] font-medium uppercase tracking-wider"
            style={{ color: "var(--text-faint)" }}
          >
            Week
          </span>
          <span
            className="text-[0.8125rem] tabular font-medium"
            style={{ color: "var(--text)" }}
          >
            {formatHM(totalMsWeek)}
          </span>
        </div>
      </div>
    </WidgetCard>
  );
}
