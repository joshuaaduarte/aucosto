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
      <WidgetCard name="The Dispatch" href="/app/time" folio="I.">
        <div className="space-y-5">
          <div className="flex items-center gap-3">
            <span className="ink-pulse h-1.5 w-1.5 rounded-full bg-oxblood" aria-hidden />
            <span className="font-mono text-[0.6875rem] uppercase tracking-[0.24em] text-oxblood">
              Filed in progress
            </span>
          </div>
          <div className="space-y-2">
            <p className="font-display text-[1.65rem] leading-[1.05] tracking-[-0.02em] text-ink">
              {running.label}
            </p>
            <p className="font-serif text-sm italic text-ink-fade">
              opened at{" "}
              <span className="not-italic font-mono tabular text-ink-soft">
                {running.startedAt.toLocaleTimeString([], {
                  hour: "numeric",
                  minute: "2-digit",
                })}
              </span>
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
    <WidgetCard name="The Dispatch" href="/app/time" folio="I.">
      <div className="space-y-6">
        <div>
          <p className="font-display text-[3rem] font-medium leading-none tracking-[-0.035em] tabular text-ink">
            {formatHM(totalMsToday)}
          </p>
          <p className="mt-2 font-serif text-sm italic text-ink-fade">
            filed today
          </p>
        </div>
        <div className="flex items-baseline justify-between rule-soft-t border-rule pt-3">
          <span className="font-mono text-[0.6875rem] uppercase tracking-[0.22em] text-ink-fade">
            Week to date
          </span>
          <span className="font-mono text-sm tabular text-ink">{formatHM(totalMsWeek)}</span>
        </div>
      </div>
    </WidgetCard>
  );
}
