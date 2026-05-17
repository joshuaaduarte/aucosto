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

function statLine({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rule-t border-ink/30 py-4">
      <p className="font-mono text-[0.6875rem] uppercase tracking-[0.22em] text-ink-fade">
        {label}
      </p>
      <p className="mt-3 font-display text-[2.4rem] font-medium leading-none tracking-[-0.03em] tabular text-ink">
        {value}
      </p>
      <p className="mt-1.5 font-serif text-sm italic text-ink-fade">{hint}</p>
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
  return target.toLocaleDateString([], { weekday: "long", month: "short", day: "numeric" });
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
    Array<{ label: string; items: typeof recent }>
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
    <div className="space-y-12 lg:space-y-16">
      {/* Section header */}
      <header className="fade-in grid gap-10 lg:grid-cols-[1.6fr_1fr] lg:gap-14">
        <div className="lg:rule-r lg:border-rule lg:pr-14">
          <p className="font-mono text-[0.6875rem] uppercase tracking-[0.28em] text-ink-fade">
            Section II · The Dispatch
          </p>
          <h1 className="mt-5 font-display font-medium leading-[0.9] tracking-[-0.045em] text-ink text-[2.6rem] sm:text-[3.6rem] lg:text-[4.4rem]">
            Hours,{" "}
            <span className="italic text-oxblood">filed in order</span>
            <br />
            of their occurrence.
          </h1>
          <p className="mt-6 max-w-xl font-serif text-[1.05rem] leading-[1.75] italic text-ink-soft">
            One press at a time. Open the day’s record, set the column for what
            you intend to work on, and the clock will keep faithful count until
            you close it.
          </p>
        </div>

        <div className="space-y-0">
          {statLine({
            label: "Filed today",
            value: formatHM(todayTotalMs),
            hint: "completed in this column",
          })}
          {statLine({
            label: "Week to date",
            value: formatHM(weekTotalMs),
            hint: "from Monday's first dispatch",
          })}
        </div>
      </header>

      <div className="fleuron text-ink-fade">
        <span aria-hidden>❧</span>
      </div>

      {running ? (
        <RunningCard
          label={running.label}
          category={running.category}
          startedAtIso={running.startedAt.toISOString()}
        />
      ) : (
        <StartForm suggestedCategories={suggestedCategories} />
      )}

      <section className="grid gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:gap-14">
        {/* Weekly split */}
        <div>
          <header className="rule-b border-ink pb-3">
            <p className="font-mono text-[0.6875rem] uppercase tracking-[0.26em] text-ink-fade">
              The Week in Columns
            </p>
            <h2 className="mt-1.5 font-display text-2xl font-medium italic tracking-[-0.02em] text-ink">
              Where the hours went.
            </h2>
          </header>

          {topCategories.length === 0 ? (
            <p className="mt-6 font-serif italic text-ink-fade">
              Nothing filed yet this week.
            </p>
          ) : (
            <ul className="mt-2">
              {topCategories.map((item) => {
                const share = weekTotalMs > 0 ? Math.max(6, Math.round((item.totalMs / weekTotalMs) * 100)) : 0;
                return (
                  <li key={item.category} className="rule-soft-b border-rule py-5">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="truncate font-display text-lg italic text-ink">
                        {item.category}
                      </span>
                      <span className="font-mono text-sm tabular text-ink-fade">
                        {formatHM(item.totalMs)}
                      </span>
                    </div>
                    <div className="mt-3 h-[3px] bg-rule-faint">
                      <div
                        className="h-[3px] bg-ink"
                        style={{ width: `${share}%` }}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Recent entries — the daily archive */}
        <div>
          <header className="rule-b border-ink pb-3">
            <p className="font-mono text-[0.6875rem] uppercase tracking-[0.26em] text-ink-fade">
              The Archive
            </p>
            <h2 className="mt-1.5 font-display text-2xl font-medium italic tracking-[-0.02em] text-ink">
              Recently filed dispatches.
            </h2>
          </header>

          {recent.length === 0 ? (
            <p className="mt-6 font-serif italic text-ink-fade">
              The archive is empty. Open a dispatch above.
            </p>
          ) : (
            <div className="mt-2 space-y-6">
              {groupedEntries.map((group) => (
                <div key={group.label}>
                  <h3 className="font-mono text-[0.6875rem] uppercase tracking-[0.22em] text-oxblood py-2 rule-soft-b border-rule">
                    {group.label}
                  </h3>
                  <ul>
                    {group.items.map((entry) => {
                      const duration = (entry.endedAt!.getTime() - entry.startedAt.getTime()) | 0;
                      return (
                        <li
                          key={entry.id}
                          className="grid grid-cols-[1fr_auto] items-baseline gap-4 rule-soft-b border-rule py-3.5"
                        >
                          <div className="min-w-0">
                            <div className="flex items-baseline gap-2 flex-wrap">
                              <p className="truncate font-display text-[1.05rem] text-ink">
                                {entry.label}
                              </p>
                              {entry.category ? (
                                <span className="font-mono text-[0.625rem] uppercase tracking-[0.2em] text-ink-fade">
                                  — {entry.category}
                                </span>
                              ) : null}
                            </div>
                            <p className="mt-1 font-serif text-xs italic text-ink-fade">
                              {entry.startedAt.toLocaleString([], {
                                month: "short",
                                day: "numeric",
                                hour: "numeric",
                                minute: "2-digit",
                              })}
                            </p>
                          </div>
                          <div className="flex items-baseline gap-4">
                            <span className="font-mono text-sm tabular text-ink-soft">
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
