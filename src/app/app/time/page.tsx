import { resolveActiveUserId } from "@/lib/viewer-context";
import {
  getRunningEntry,
  listCompletedSince,
  listRecentEntries,
} from "@/lib/services/time";
import {
  formatDuration,
  formatHM,
  startOfToday,
  startOfWeek,
} from "@/lib/time";
import { summarizeCategories, sumDurations } from "@/lib/time-summary";
import { EntryDeleteButton } from "./entry-row";
import { RunningCard } from "./running-card";
import { StartForm } from "./start-form";

export const dynamic = "force-dynamic";

function statCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="rounded-[1.5rem] border border-zinc-200/80 bg-white/90 p-5 shadow-[0_20px_60px_-45px_rgba(24,24,27,0.32)] dark:border-zinc-800/80 dark:bg-zinc-900/90 dark:shadow-none">
      <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-zinc-500">
        {label}
      </p>
      <p className="mt-3 text-3xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
        {value}
      </p>
      <p className="mt-1 text-sm text-zinc-500">{hint}</p>
    </div>
  );
}

function formatDayLabel(date: Date) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const target = new Date(date);
  target.setHours(0, 0, 0, 0);

  const diffDays = Math.round((today.getTime() - target.getTime()) / (24 * 60 * 60 * 1000));

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";

  return target.toLocaleDateString([], {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
}

export default async function TimePage() {
  const userId = await resolveActiveUserId();

  const todayStart = startOfToday();
  const weekStart = startOfWeek();

  const [running, recent, completedToday, completedWeek] = await Promise.all([
    getRunningEntry(userId),
    listRecentEntries(userId, { limit: 30 }),
    listCompletedSince(userId, todayStart),
    listCompletedSince(userId, weekStart),
  ]);

  const todayTotalMs = sumDurations(completedToday);
  const weekTotalMs = sumDurations(completedWeek);
  const topCategories = summarizeCategories(completedWeek, { limit: 4 });
  const suggestedCategories = topCategories
    .map((item) => item.category)
    .filter((category) => category && category.toLowerCase() !== "uncategorized");

  const groupedEntries = recent.reduce<
    Array<{
      label: string;
      items: typeof recent;
    }>
  >((groups, entry) => {
    const label = formatDayLabel(entry.startedAt);
    const existing = groups.find((group) => group.label === label);

    if (existing) {
      existing.items.push(entry);
      return groups;
    }

    groups.push({ label, items: [entry] });
    return groups;
  }, []);

  return (
    <div className="space-y-6 lg:space-y-8">
      <section className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="rounded-[2rem] border border-zinc-200/80 bg-gradient-to-br from-white via-zinc-50 to-violet-50/70 p-5 shadow-[0_24px_80px_-45px_rgba(24,24,27,0.28)] dark:border-zinc-800/80 dark:from-zinc-950 dark:via-zinc-950 dark:to-violet-950/20 dark:shadow-none sm:p-7">
          <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-zinc-500">
            Time tracker
          </p>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50 sm:text-4xl">
            Protect focus before the day gets noisy.
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-zinc-600 dark:text-zinc-300 sm:text-base">
            Keep one timer running, make the important blocks visible, and review the last few sessions without digging.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4 xl:grid-cols-1">
          {statCard({
            label: "Today",
            value: formatHM(todayTotalMs),
            hint: "tracked today",
          })}
          {statCard({
            label: "This week",
            value: formatHM(weekTotalMs),
            hint: "completed since Monday",
          })}
        </div>
      </section>

      {running ? (
        <RunningCard
          label={running.label}
          category={running.category}
          startedAtIso={running.startedAt.toISOString()}
        />
      ) : (
        <StartForm suggestedCategories={suggestedCategories} />
      )}

      <section className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
        <div className="rounded-[1.75rem] border border-zinc-200/80 bg-white/90 p-5 shadow-[0_20px_60px_-45px_rgba(24,24,27,0.32)] dark:border-zinc-800/80 dark:bg-zinc-900/90 dark:shadow-none sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-zinc-500">
                Weekly split
              </p>
              <p className="mt-2 text-sm text-zinc-500">
                The categories taking most of the week so far.
              </p>
            </div>
          </div>

          {topCategories.length === 0 ? (
            <p className="mt-5 text-sm text-zinc-500">No completed entries yet.</p>
          ) : (
            <ul className="mt-5 space-y-3">
              {topCategories.map((item) => {
                const share = weekTotalMs > 0 ? Math.max(6, Math.round((item.totalMs / weekTotalMs) * 100)) : 0;
                return (
                  <li key={item.category} className="rounded-2xl border border-zinc-200/80 bg-zinc-50/80 px-4 py-4 dark:border-zinc-800 dark:bg-zinc-950/60">
                    <div className="flex items-center justify-between gap-3">
                      <span className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">
                        {item.category}
                      </span>
                      <span className="font-mono text-sm tabular-nums text-zinc-500">
                        {formatHM(item.totalMs)}
                      </span>
                    </div>
                    <div className="mt-3 h-2 rounded-full bg-zinc-200 dark:bg-zinc-800">
                      <div
                        className="h-2 rounded-full bg-gradient-to-r from-sky-500 to-violet-500"
                        style={{ width: `${share}%` }}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="rounded-[1.75rem] border border-zinc-200/80 bg-white/90 p-5 shadow-[0_20px_60px_-45px_rgba(24,24,27,0.32)] dark:border-zinc-800/80 dark:bg-zinc-900/90 dark:shadow-none sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-zinc-500">
                Recent entries
              </p>
              <p className="mt-2 text-sm text-zinc-500">
                The last tracked blocks, grouped so the timeline is easier to scan.
              </p>
            </div>
          </div>

          {recent.length === 0 ? (
            <p className="mt-5 text-sm text-zinc-500">Nothing yet. Start a timer above.</p>
          ) : (
            <div className="mt-5 space-y-5">
              {groupedEntries.map((group) => (
                <div key={group.label}>
                  <h2 className="text-xs font-medium uppercase tracking-[0.18em] text-zinc-500">
                    {group.label}
                  </h2>
                  <ul className="mt-3 space-y-3">
                    {group.items.map((entry) => {
                      const duration = (entry.endedAt!.getTime() - entry.startedAt.getTime()) | 0;
                      return (
                        <li
                          key={entry.id}
                          className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 rounded-2xl border border-zinc-200/80 bg-zinc-50/80 px-4 py-4 dark:border-zinc-800 dark:bg-zinc-950/60"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100 sm:text-base">
                                {entry.label}
                              </p>
                              {entry.category ? (
                                <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-medium text-zinc-600 ring-1 ring-zinc-200 dark:bg-zinc-900 dark:text-zinc-300 dark:ring-zinc-700">
                                  {entry.category}
                                </span>
                              ) : null}
                            </div>
                            <p className="mt-1 text-xs text-zinc-500">
                              {entry.startedAt.toLocaleString([], {
                                month: "short",
                                day: "numeric",
                                hour: "numeric",
                                minute: "2-digit",
                              })}
                            </p>
                          </div>
                          <div className="flex items-center gap-3 justify-self-end">
                            <span className="font-mono text-sm tabular-nums text-zinc-700 dark:text-zinc-300 sm:text-base">
                              {formatDuration(duration)}
                            </span>
                            <EntryDeleteButton id={entry.id} />
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
