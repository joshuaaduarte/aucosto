import { auth } from "@/auth";
import { getRunningEntry, listCompletedSince, listRecentEntries } from "@/lib/services/time";
import { formatDuration, formatHM, startOfToday, startOfWeek } from "@/lib/time";
import { summarizeCategories, sumDurations } from "@/lib/time-summary";
import { StartForm } from "./start-form";
import { RunningCard } from "./running-card";
import { EntryDeleteButton } from "./entry-row";

export const dynamic = "force-dynamic";

export default async function TimePage() {
  const session = await auth();
  const userId = session!.user.id;

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
  const topCategories = summarizeCategories(completedWeek, { limit: 3 });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Time tracker</h1>
        <p className="mt-2 text-zinc-500">
          One timer at a time. Starting a new one stops the previous.
        </p>
      </div>

      {running ? (
        <RunningCard
          label={running.label}
          category={running.category}
          startedAtIso={running.startedAt.toISOString()}
        />
      ) : (
        <StartForm />
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-zinc-500">Today</p>
          <p className="mt-2 text-2xl font-semibold tracking-tight">{formatHM(todayTotalMs)}</p>
          <p className="mt-1 text-sm text-zinc-500">tracked today</p>
        </div>
        <div className="rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-zinc-500">This week</p>
          <p className="mt-2 text-2xl font-semibold tracking-tight">{formatHM(weekTotalMs)}</p>
          <p className="mt-1 text-sm text-zinc-500">completed since Monday</p>
        </div>
        <div className="rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-zinc-500">Top categories</p>
          {topCategories.length === 0 ? (
            <p className="mt-2 text-sm text-zinc-500">No completed entries yet.</p>
          ) : (
            <ul className="mt-2 space-y-2">
              {topCategories.map((item) => (
                <li key={item.category} className="flex items-center justify-between gap-3 text-sm">
                  <span className="truncate text-zinc-700 dark:text-zinc-300">{item.category}</span>
                  <span className="font-mono tabular-nums text-zinc-500">{formatHM(item.totalMs)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div>
        <h2 className="mb-3 font-mono text-xs uppercase tracking-[0.2em] text-zinc-500">
          Recent entries
        </h2>
        {recent.length === 0 ? (
          <p className="text-sm text-zinc-500">
            Nothing yet. Start a timer above.
          </p>
        ) : (
          <ul className="divide-y divide-zinc-200 rounded-lg border border-zinc-200 bg-white dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-900">
            {recent.map((entry) => {
              const duration =
                (entry.endedAt!.getTime() - entry.startedAt.getTime()) | 0;
              return (
                <li
                  key={entry.id}
                  className="flex items-center justify-between gap-4 px-4 py-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {entry.label}
                    </p>
                    <p className="text-xs text-zinc-500">
                      {entry.startedAt.toLocaleString([], {
                        month: "short",
                        day: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                      {entry.category ? ` · ${entry.category}` : ""}
                    </p>
                  </div>
                  <span className="font-mono text-sm tabular-nums text-zinc-700 dark:text-zinc-300">
                    {formatDuration(duration)}
                  </span>
                  <EntryDeleteButton id={entry.id} />
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
