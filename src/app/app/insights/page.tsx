import Link from "next/link";
import {
  RANGE_OPTIONS,
  type RangeKey,
  buildDayFacts,
  deriveAllPatterns,
  deriveEstimationAccuracy,
  deriveHabitConsistency,
  derivePlanVsActual,
  deriveRhythmConsistency,
  deriveSpendTrends,
  deriveTimeAllocation,
  deriveWellbeingTrends,
  isRangeKey,
  rangeStart,
} from "@/lib/insights";
import { formatHM } from "@/lib/time";
import { listCalendarItems } from "@/lib/services/calendar";
import { listDoItems } from "@/lib/services/do";
import { listTransactions } from "@/lib/services/finance";
import { listHabitEntriesBetween, listHabits } from "@/lib/services/habits";
import { listReflections } from "@/lib/services/reflect";
import { listRecentRhythms } from "@/lib/services/rhythms";
import { listEntriesBetween } from "@/lib/services/time";
import { requireViewerContext } from "@/lib/viewer-context";
import {
  EmptyNote,
  MiniBars,
  SectionCard,
  SimpleColumns,
  StackedColumns,
} from "./_components/charts";
import { WellbeingChart } from "./_components/wellbeing-chart";

export const dynamic = "force-dynamic";

const ALL_TIME_DAYS = 3 * 365;

export default async function InsightsPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const context = await requireViewerContext();
  const userId = context.effectiveUserId;
  const params = await searchParams;
  const range: RangeKey = isRangeKey(params.range) ? params.range : "30d";

  const now = new Date();
  const from =
    rangeStart(range, now) ??
    (() => {
      const start = new Date(now);
      start.setDate(start.getDate() - ALL_TIME_DAYS);
      start.setHours(0, 0, 0, 0);
      return start;
    })();
  const to = new Date(now);
  to.setHours(23, 59, 59, 999);
  const sinceKey = from.toLocaleDateString("en-CA");

  const [
    entries,
    reflections,
    habits,
    habitEntries,
    tasks,
    calendarItems,
    transactions,
    rhythmSessions,
  ] = await Promise.all([
    listEntriesBetween(userId, { from, to }),
    listReflections(userId, { sinceKey, limit: 1100 }),
    listHabits(userId),
    listHabitEntriesBetween(userId, { from, to }),
    listDoItems(userId, { includeDone: true }),
    listCalendarItems(userId, { from, to }),
    context.financeVisible
      ? listTransactions(userId, { since: from, limit: 5000 })
      : Promise.resolve([]),
    listRecentRhythms(userId, { sinceKey, limit: 2000 }),
  ]);

  const allocation = deriveTimeAllocation(entries, { from, to, now });
  const wellbeing = deriveWellbeingTrends(reflections, { from, to });
  const habitLites = habits.map((habit) => ({
    id: habit.id,
    title: habit.title,
    completionRate30d: habit.completionRate30d,
    currentStreak: habit.currentStreak,
    longestStreak: habit.longestStreak,
  }));
  const estimation = deriveEstimationAccuracy(
    tasks.map((task) => ({
      completedAt: task.completedAt,
      estimatedMinutes: task.estimatedMinutes,
      actualMinutes: task.effectiveActualMinutes,
      bucket: task.bucket,
    })),
    { from, to },
  );
  const plan = derivePlanVsActual(calendarItems, entries, { from, to, now });
  const spend = deriveSpendTrends(transactions);
  const dayFacts = buildDayFacts({ entries, reflections, from, to, now });
  const patterns = deriveAllPatterns(dayFacts);
  const habitWeekly = deriveHabitConsistency(habitLites, habitEntries, {
    from,
    to,
  });
  const rhythmConsistency = deriveRhythmConsistency(
    rhythmSessions.map((session) => ({
      type: session.type,
      startedAt: session.startedAt,
    })),
    { from, to },
  );

  return (
    <div className="space-y-8">
      <header className="fade-in flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p
            className="text-[0.75rem] font-medium uppercase tracking-wider"
            style={{ color: "var(--text-faint)" }}
          >
            Insights
          </p>
          <h1
            className="mt-1 text-[1.5rem] font-bold tracking-tight sm:text-[1.875rem]"
            style={{ color: "var(--text)", letterSpacing: "-0.025em" }}
          >
            Trends
          </h1>
        </div>
        <nav className="flex flex-wrap gap-1.5" aria-label="Time range">
          {RANGE_OPTIONS.map((option) => (
            <Link
              key={option.key}
              href={`/app/insights?range=${option.key}`}
              aria-current={option.key === range ? "page" : undefined}
              className="rounded px-2.5 py-1.5 text-[0.78rem] font-medium transition-colors"
              style={{
                background:
                  option.key === range ? "var(--bg-tint-strong)" : "var(--bg-tint)",
                color: option.key === range ? "var(--text)" : "var(--text-muted)",
              }}
            >
              {option.label}
            </Link>
          ))}
        </nav>
      </header>

      {/* Patterns first — the findings are the payoff. */}
      {patterns.length > 0 ? (
        <section className="fade-in-delay-1">
          <p
            className="mb-3 text-[0.6875rem] font-semibold uppercase tracking-wider"
            style={{ color: "var(--text-faint)" }}
          >
            Patterns
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            {patterns.map((pattern) => (
              <article
                key={pattern.key}
                className="rounded-md border p-4"
                style={{
                  borderColor: "var(--border-faint)",
                  background: "var(--bg-page)",
                  borderLeft: "3px solid var(--accent)",
                }}
              >
                <p
                  className="text-[0.9rem] font-semibold leading-snug"
                  style={{ color: "var(--text)" }}
                >
                  {pattern.finding}
                </p>
                <p
                  className="mt-1 text-[0.78rem] leading-[1.5]"
                  style={{ color: "var(--text-muted)" }}
                >
                  {pattern.detail}
                </p>
                <div className="mt-3">
                  <MiniBars bars={pattern.bars} unit={pattern.unit} />
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      <div className="fade-in-delay-2 grid gap-4">
        <SectionCard
          eyebrow="Time allocation"
          title="Where your time actually goes"
          aside={
            allocation.topCategory ? (
              <p className="text-[0.78rem]" style={{ color: "var(--text-muted)" }}>
                Most: <strong style={{ color: allocation.topCategory.color }}>{allocation.topCategory.label}</strong>{" "}
                ({formatHM(allocation.topCategory.ms)})
                {allocation.leastCategory
                  ? ` · least: ${allocation.leastCategory.label} (${formatHM(allocation.leastCategory.ms)})`
                  : ""}
              </p>
            ) : undefined
          }
        >
          {allocation.totalMs === 0 ? (
            <EmptyNote>No tracked time in this range yet.</EmptyNote>
          ) : (
            <StackedColumns
              columns={allocation.weeks.map((week) => ({
                key: week.weekKey,
                label: week.label,
                total: week.totalMs,
                segments: week.segments.map((segment) => ({
                  key: segment.category,
                  value: segment.ms,
                  color: segment.color,
                })),
              }))}
              formatTotal={(total) => formatHM(total)}
            />
          )}
        </SectionCard>

        <SectionCard
          eyebrow="Mood & wellbeing"
          title="How the days have felt"
          aside={
            wellbeing.bestWeek && wellbeing.worstWeek ? (
              <p className="text-[0.78rem]" style={{ color: "var(--text-muted)" }}>
                Best week of {wellbeing.bestWeek.label} ({wellbeing.bestWeek.avg.toFixed(1)}) · toughest{" "}
                {wellbeing.worstWeek.label} ({wellbeing.worstWeek.avg.toFixed(1)})
              </p>
            ) : undefined
          }
        >
          {wellbeing.sampleCount < 3 ? (
            <EmptyNote>
              Not enough reflections yet — save a few evening reflections and
              the trend lines appear here.
            </EmptyNote>
          ) : (
            <WellbeingChart series={wellbeing.series} />
          )}
        </SectionCard>

        <SectionCard eyebrow="Habits" title="Consistency over time">
          {habitLites.length === 0 ? (
            <EmptyNote>No habits set up yet.</EmptyNote>
          ) : (
            <div className="space-y-5">
              {habitWeekly.weekly.length > 1 ? (
                <SimpleColumns
                  columns={habitWeekly.weekly.map((week) => ({
                    key: week.weekKey,
                    label: week.label,
                    value: Math.round(week.rate * 100),
                  }))}
                  suffix="%"
                  color="#14b8a6"
                />
              ) : null}
              <div className="grid gap-2 sm:grid-cols-2">
                {habitWeekly.perHabit.map((habit) => (
                  <div
                    key={habit.id}
                    className="rounded-md border px-3 py-2.5"
                    style={{ borderColor: "var(--border-faint)" }}
                  >
                    <div className="flex items-baseline justify-between gap-2">
                      <p
                        className="truncate text-[0.85rem] font-medium"
                        style={{ color: "var(--text)" }}
                      >
                        {habit.title}
                      </p>
                      <p className="tabular text-[0.72rem]" style={{ color: "var(--text-muted)" }}>
                        {Math.min(100, Math.round(habit.completionRate30d))}% · 30d
                      </p>
                    </div>
                    <div
                      className="mt-1.5 h-[4px] rounded-full"
                      style={{ background: "var(--bg-tint-strong)" }}
                    >
                      <div
                        className="h-[4px] rounded-full"
                        style={{
                          width: `${Math.min(100, Math.max(2, Math.round(habit.completionRate30d)))}%`,
                          background: "#14b8a6",
                        }}
                      />
                    </div>
                    <p className="mt-1 text-[0.7rem]" style={{ color: "var(--text-faint)" }}>
                      streak {habit.currentStreak} · longest {habit.longestStreak}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </SectionCard>

        <SectionCard
          eyebrow="Rhythms"
          title="Daily rhythm consistency"
          aside={
            rhythmConsistency.totalSessions > 0 ? (
              <p className="text-[0.78rem]" style={{ color: "var(--text-muted)" }}>
                {rhythmConsistency.activeDays} of {rhythmConsistency.rangeDays} days had a rhythm
                {rhythmConsistency.busiestType
                  ? ` · most run: ${rhythmConsistency.busiestType.name}`
                  : ""}
              </p>
            ) : undefined
          }
        >
          {rhythmConsistency.totalSessions === 0 ? (
            <EmptyNote>
              No rhythm sessions in this range yet — start a wake-up, work, or
              wind-down flow on the Rhythms page and consistency shows up here.
            </EmptyNote>
          ) : (
            <div className="space-y-4">
              {rhythmConsistency.weekly.length > 1 ? (
                <SimpleColumns
                  columns={rhythmConsistency.weekly.map((week) => ({
                    key: week.weekKey,
                    label: week.label,
                    value: week.count,
                  }))}
                  suffix=" sessions"
                  color="#f59e0b"
                />
              ) : null}
              <div className="flex flex-wrap gap-2">
                {rhythmConsistency.perType
                  .filter((entry) => entry.count > 0)
                  .map((entry) => (
                    <span
                      key={entry.type}
                      className="inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[0.78rem]"
                      style={{
                        borderColor: "var(--border-faint)",
                        color: "var(--text-muted)",
                      }}
                    >
                      <span aria-hidden>{entry.icon}</span>
                      {entry.name}
                      <span className="tabular" style={{ color: "var(--text)" }}>
                        {entry.count}
                      </span>
                    </span>
                  ))}
              </div>
            </div>
          )}
        </SectionCard>

        <SectionCard
          eyebrow="Estimation accuracy"
          title="Is the gap between estimate and actual closing?"
          aside={
            estimation.trend ? (
              <span
                className="rounded px-2 py-0.5 text-[0.72rem] font-semibold uppercase tracking-wider"
                style={{
                  background: "var(--bg-tint)",
                  color:
                    estimation.trend === "improving"
                      ? "#10b981"
                      : estimation.trend === "getting worse"
                        ? "var(--accent-strong)"
                        : "var(--text-muted)",
                }}
              >
                {estimation.trend}
              </span>
            ) : undefined
          }
        >
          {estimation.sampleCount < 3 ? (
            <EmptyNote>
              Complete a few estimated tasks (with actual minutes) and accuracy
              trends show up here.
            </EmptyNote>
          ) : (
            <div className="space-y-4">
              <SimpleColumns
                columns={estimation.weekly.map((week) => ({
                  key: week.weekKey,
                  label: week.label,
                  value: week.accuracy,
                }))}
                suffix="% accurate"
                color="#8b5cf6"
              />
              {estimation.best && estimation.worst ? (
                <p className="text-[0.8rem]" style={{ color: "var(--text-muted)" }}>
                  You estimate <strong style={{ color: "var(--text)" }}>{estimation.best.bucket}</strong> work
                  best ({estimation.best.accuracy}%) and{" "}
                  <strong style={{ color: "var(--text)" }}>{estimation.worst.bucket}</strong> worst (
                  {estimation.worst.accuracy}%).
                </p>
              ) : null}
            </div>
          )}
        </SectionCard>

        <SectionCard
          eyebrow="Plan vs actual"
          title="How much planned time becomes tracked time"
          aside={
            plan.trend ? (
              <span
                className="rounded px-2 py-0.5 text-[0.72rem] font-semibold uppercase tracking-wider"
                style={{
                  background: "var(--bg-tint)",
                  color:
                    plan.trend === "improving"
                      ? "#10b981"
                      : plan.trend === "getting worse"
                        ? "var(--accent-strong)"
                        : "var(--text-muted)",
                }}
              >
                {plan.trend}
              </span>
            ) : undefined
          }
        >
          {plan.days.length === 0 ? (
            <EmptyNote>
              No days with planned calendar blocks in this range yet.
            </EmptyNote>
          ) : (
            <div className="space-y-2">
              <SimpleColumns
                columns={plan.weekly.map((week) => ({
                  key: week.weekKey,
                  label: week.label,
                  value: week.pct,
                }))}
                suffix="%"
                color="#f43f5e"
              />
              {plan.overallPct !== null ? (
                <p className="text-[0.8rem]" style={{ color: "var(--text-muted)" }}>
                  Across {plan.days.length} planned day{plan.days.length === 1 ? "" : "s"}, you tracked
                  about <strong style={{ color: "var(--text)" }}>{plan.overallPct}%</strong> of the time you planned.
                </p>
              ) : null}
            </div>
          )}
        </SectionCard>

        {context.financeVisible ? (
          <SectionCard
            eyebrow="Spending"
            title="Monthly spend"
            aside={
              spend.momChangePct !== null ? (
                <p className="text-[0.78rem]" style={{ color: "var(--text-muted)" }}>
                  {spend.momChangePct > 0 ? "+" : ""}
                  {Math.round(spend.momChangePct)}% vs previous month
                </p>
              ) : undefined
            }
          >
            {spend.months.length === 0 ? (
              <EmptyNote>No spending recorded in this range.</EmptyNote>
            ) : (
              <SimpleColumns
                columns={spend.months.map((month) => ({
                  key: month.monthKey,
                  label: month.label,
                  value: Math.round(month.totalCents / 100),
                }))}
                color="var(--accent)"
                suffix=" USD"
              />
            )}
          </SectionCard>
        ) : null}
      </div>

      {patterns.length === 0 ? (
        <p
          className="fade-in-delay-2 rounded-md border px-4 py-3 text-[0.85rem]"
          style={{
            borderColor: "var(--border-faint)",
            color: "var(--text-muted)",
          }}
        >
          Keep tracking and reflecting — cross-tool patterns (mood × habits,
          focus × productivity, best days) appear here once there&apos;s enough
          data to be meaningful.
        </p>
      ) : null}
    </div>
  );
}
