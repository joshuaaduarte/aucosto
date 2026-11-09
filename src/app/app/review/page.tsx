import Link from "next/link";
import { redirect } from "next/navigation";
import { PARTNER_HOME_PATH } from "@/lib/household-access";
import { classifyUsageEvent, usageAreaKey } from "@/lib/insights";
import { listExecutedAuditTimes } from "@/lib/services/assistant-audit";
import { listDoItems, listSuggestedDoItems } from "@/lib/services/do";
import { listUsageEvents } from "@/lib/services/events";
import { listTransactions } from "@/lib/services/finance";
import { listHabitEntriesBetween, listHabits } from "@/lib/services/habits";
import { listSavedReviews } from "@/lib/services/review";
import { listEntriesBetween } from "@/lib/services/time";
import { categoryColor, categoryLabel } from "@/lib/time-categories";
import { requireViewerContext } from "@/lib/viewer-context";
import {
  elapsedDayCount,
  latestReviewFor,
  nextWeekLabel,
  priorityOutcomes,
  reviewCompletedTasks,
  reviewHabits,
  reviewHeadline,
  reviewMoney,
  reviewTime,
  reviewWeekFor,
  weekKey,
  type HabitReview,
  type MoneyReview,
  type PriorityOutcome,
  type TimeReview,
} from "@/lib/weekly-review";
import { formatCents, formatHoursMs } from "../_components/hub-format";
import { EmptyNote, SectionCard } from "../insights/_components/charts";
import { ReviewForm, type ReviewCandidate } from "./review-form";

export const dynamic = "force-dynamic";

function plural(count: number, one: string, many = `${one}s`): string {
  return `${count} ${count === 1 ? one : many}`;
}

function minutesLabel(minutes: number): string {
  return formatHoursMs(minutes * 60_000);
}

export default async function WeeklyReviewPage() {
  const context = await requireViewerContext();
  // Owner-only: it looks back over personal tools a partner never sees.
  if (context.role !== "owner") redirect(PARTNER_HOME_PATH);

  const userId = context.effectiveUserId;
  const now = new Date();
  const week = reviewWeekFor(now);
  const range = { from: week.start, to: week.through };
  const reviewsSince = new Date(week.start);
  reviewsSince.setDate(reviewsSince.getDate() - 14);

  const [
    timeEntries,
    habits,
    habitEntries,
    allTasks,
    suggested,
    transactions,
    usageEvents,
    auditTimes,
    savedReviews,
  ] = await Promise.all([
    listEntriesBetween(userId, range),
    listHabits(userId),
    listHabitEntriesBetween(userId, range),
    listDoItems(userId, { includeDone: true }),
    listSuggestedDoItems(userId, { limit: 8, now }),
    context.financeVisible
      ? listTransactions(context.financeUserId, { since: week.start, limit: 2000 })
      : Promise.resolve([]),
    listUsageEvents([userId], week.start, week.through),
    listExecutedAuditTimes(userId, week.start),
    listSavedReviews(userId, reviewsSince),
  ]);

  const usedDays = new Set<string>();
  const agentActionTimes = auditTimes.map((time) => time.getTime());
  for (const event of usageEvents) {
    if (!usageAreaKey(event.type)) continue;
    if (classifyUsageEvent(event, { viewerUserId: userId, agentActionTimes }) !== "you") continue;
    usedDays.add(event.at.toLocaleDateString("en-CA"));
  }

  const time = reviewTime(timeEntries, week);
  const habitReview = reviewHabits(habits, habitEntries, week);
  const tasks = reviewCompletedTasks(allTasks, week);
  const money = context.financeVisible ? reviewMoney(transactions, week) : null;
  const headline = reviewHeadline({
    week,
    daysUsed: usedDays.size,
    time,
    habits: habitReview,
    tasks,
  });

  const saved = latestReviewFor(savedReviews, "reviewedWeek", weekKey(week.start));
  const previous = latestReviewFor(savedReviews, "forWeek", weekKey(week.start));
  const outcomes = previous ? priorityOutcomes(previous, allTasks) : [];

  // Picks to offer: last time's unfinished ones first, then the Do List's own
  // suggestions, then everything else open (searchable in the form).
  const open = allTasks.filter((task) => task.status !== "done" && task.status !== "waiting");
  const openById = new Map(open.map((task) => [task.id, task]));
  const leadIds = [
    ...outcomes.filter((outcome) => !outcome.done && openById.has(outcome.id)).map((o) => o.id),
    ...suggested.map((task) => task.id),
  ];
  const ordered = [
    ...new Set([...leadIds.filter((id) => openById.has(id)), ...open.map((task) => task.id)]),
  ];
  const carriedIds = new Set(outcomes.filter((outcome) => !outcome.done).map((o) => o.id));
  const candidates: ReviewCandidate[] = ordered.map((id) => {
    const task = openById.get(id)!;
    return {
      id,
      title: task.title,
      detail: [
        carriedIds.has(id) ? "Carried over" : null,
        task.projectName,
        task.lane === "today" ? "Today" : null,
      ]
        .filter(Boolean)
        .join(" · "),
    };
  });
  const suggestedCount = Math.min(ordered.length, Math.max(8, leadIds.length));

  return (
    <div className="space-y-6">
      <header className="fade-in">
        <p
          className="text-[0.75rem] font-medium uppercase tracking-wider"
          style={{ color: "var(--text-faint)" }}
        >
          Weekly review{week.isCurrent ? " · this week so far" : ""}
        </p>
        <h1
          className="mt-1 text-[1.5rem] font-bold tracking-tight sm:text-[1.875rem]"
          style={{ color: "var(--text)", letterSpacing: "-0.025em" }}
        >
          {week.label}
        </h1>
        <p
          className="mt-2 max-w-[38rem] text-[0.95rem] leading-[1.5]"
          style={{ color: "var(--text-muted)" }}
        >
          {headline}
        </p>
      </header>

      <section className="fade-in-delay-1 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile
          label="Days used"
          value={`${usedDays.size}`}
          unit={`of ${elapsedDayCount(week)}`}
          note="Days you logged something"
        />
        <StatTile
          label="Time tracked"
          value={time.totalMinutes > 0 ? minutesLabel(time.totalMinutes) : "None"}
          note={time.daysTracked > 0 ? `Across ${plural(time.daysTracked, "day")}` : "No timers ran"}
        />
        <StatTile
          label="Habit check-ins"
          value={`${habitReview.done}`}
          unit={habitReview.due > 0 ? `of ${habitReview.due}` : undefined}
          note={habitReview.focusOnly ? "Focus habits" : "Active habits"}
        />
        <StatTile
          label="Tasks finished"
          value={`${tasks.count}`}
          note={tasks.count > 0 ? "From the Do List" : "None marked done"}
        />
      </section>

      {previous && outcomes.length > 0 ? (
        <div className="fade-in-delay-1">
          <SectionCard eyebrow="Last time you picked" title={lastTimeTitle(outcomes)}>
            <OutcomeList outcomes={outcomes} />
          </SectionCard>
        </div>
      ) : null}

      <div className="fade-in-delay-2 grid gap-6 lg:grid-cols-2">
        <SectionCard eyebrow="Time" title="Where the hours went">
          <TimeBreakdown time={time} />
        </SectionCard>
        <SectionCard
          eyebrow="Habits"
          title={habitReview.focusOnly ? "Your focus habits" : "Your habits"}
        >
          <HabitRows review={habitReview} />
        </SectionCard>
        <SectionCard eyebrow="Done" title={tasks.count > 0 ? plural(tasks.count, "task") + " finished" : "Finished tasks"}>
          {tasks.count > 0 ? (
            <ul className="space-y-1.5">
              {tasks.titles.map((title, index) => (
                <li
                  key={`${title}-${index}`}
                  className="flex gap-2 text-[0.875rem]"
                  style={{ color: "var(--text)" }}
                >
                  <span aria-hidden style={{ color: "var(--positive)" }}>
                    ✓
                  </span>
                  <span className="min-w-0">{title}</span>
                </li>
              ))}
              {tasks.count > tasks.titles.length ? (
                <li className="pl-5 text-[0.8rem]" style={{ color: "var(--text-faint)" }}>
                  and {tasks.count - tasks.titles.length} more
                </li>
              ) : null}
            </ul>
          ) : (
            <EmptyNote>Nothing was marked done on the Do List this week.</EmptyNote>
          )}
        </SectionCard>
        {money ? (
          <SectionCard eyebrow="Money" title="What went out">
            <MoneyBreakdown money={money} />
          </SectionCard>
        ) : null}
      </div>

      <div className="fade-in-delay-3">
        <ReviewForm
          nextWeekLabel={nextWeekLabel(week)}
          candidates={candidates}
          suggestedCount={suggestedCount}
          initialIds={saved?.priorities.map((pick) => pick.id).filter((id) => openById.has(id)) ?? []}
          initialNote={saved?.note ?? ""}
          savedAt={saved ? saved.at.toISOString() : null}
        />
      </div>

      <p className="text-[0.75rem] leading-[1.6]" style={{ color: "var(--text-faint)" }}>
        {week.isCurrent
          ? "On the weekend this looks at the week now ending. From Monday it looks at the week before, so a late review still sees a whole week."
          : "Monday to Friday this looks at last week, so a late review still sees a whole week."}{" "}
        Days used counts entries you made yourself, not agents or syncs. See{" "}
        <Link href="/app/insights/usage" className="underline underline-offset-2">
          Usage
        </Link>{" "}
        for the longer view.
      </p>
    </div>
  );
}

function lastTimeTitle(outcomes: PriorityOutcome[]): string {
  const done = outcomes.filter((outcome) => outcome.done).length;
  if (done === outcomes.length) return `All ${outcomes.length} done`;
  return `${done} of ${outcomes.length} done`;
}

function OutcomeList({ outcomes }: { outcomes: PriorityOutcome[] }) {
  return (
    <ul className="space-y-1.5">
      {outcomes.map((outcome) => (
        <li key={outcome.id} className="flex items-baseline gap-2 text-[0.875rem]">
          <span
            aria-hidden
            className="w-4 shrink-0 text-center"
            style={{ color: outcome.done ? "var(--positive)" : "var(--text-faint)" }}
          >
            {outcome.done ? "✓" : "○"}
          </span>
          <span
            className="min-w-0"
            style={{ color: outcome.done ? "var(--text-muted)" : "var(--text)" }}
          >
            {outcome.title}
            <span className="sr-only">{outcome.done ? " (done)" : " (not done)"}</span>
          </span>
          {outcome.missing ? (
            <span className="text-[0.72rem]" style={{ color: "var(--text-faint)" }}>
              deleted
            </span>
          ) : !outcome.done ? (
            <span className="text-[0.72rem]" style={{ color: "var(--text-faint)" }}>
              still open
            </span>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

function StatTile({
  label,
  value,
  unit,
  note,
}: {
  label: string;
  value: string;
  unit?: string;
  note: string;
}) {
  return (
    <div
      className="rounded-md border p-3.5"
      style={{ borderColor: "var(--border-soft)", background: "var(--bg-page)" }}
    >
      <p
        className="text-[0.6875rem] font-semibold uppercase tracking-wider"
        style={{ color: "var(--text-faint)" }}
      >
        {label}
      </p>
      <p className="mt-1.5 flex items-baseline gap-1.5" style={{ color: "var(--text)" }}>
        <span className="text-[1.75rem] font-bold leading-8 tracking-tight tabular-nums">
          {value}
        </span>
        {unit ? (
          <span className="text-[0.78rem]" style={{ color: "var(--text-muted)" }}>
            {unit}
          </span>
        ) : null}
      </p>
      <p className="mt-1 text-[0.75rem]" style={{ color: "var(--text-faint)" }}>
        {note}
      </p>
    </div>
  );
}

/** Share bars: one row per category, its own colour, value in text ink. */
function ShareRows({
  rows,
  total,
  format,
  colorOf,
  labelOf,
}: {
  rows: Array<{ name: string; amount: number }>;
  total: number;
  format: (amount: number) => string;
  colorOf: (name: string) => string;
  labelOf: (name: string) => string;
}) {
  return (
    <ul className="space-y-2.5">
      {rows.map((row) => {
        const share = total > 0 ? row.amount / total : 0;
        return (
          <li key={row.name}>
            <div className="flex items-baseline justify-between gap-3 text-[0.84rem]">
              <span className="min-w-0 truncate" style={{ color: "var(--text)" }}>
                {labelOf(row.name)}
              </span>
              <span className="shrink-0 tabular-nums" style={{ color: "var(--text-muted)" }}>
                {format(row.amount)}
                <span className="ml-1.5" style={{ color: "var(--text-faint)" }}>
                  {Math.round(share * 100)}%
                </span>
              </span>
            </div>
            <div
              className="mt-1 h-[6px] overflow-hidden rounded-full"
              style={{ background: "var(--bg-tint-strong)" }}
            >
              <div
                className="h-full rounded-full"
                style={{ width: `${Math.max(2, share * 100)}%`, background: colorOf(row.name) }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

const NEUTRAL_BAR = "var(--text-muted)";

function TimeBreakdown({ time }: { time: TimeReview }) {
  if (time.totalMinutes === 0) {
    return (
      <EmptyNote>
        No time was tracked. Even one timer a day makes next week&apos;s review worth reading.
      </EmptyNote>
    );
  }
  return (
    <ShareRows
      rows={time.byCategory}
      total={time.totalMinutes}
      format={minutesLabel}
      colorOf={(name) =>
        name === "Other" || name === "Uncategorized" ? NEUTRAL_BAR : categoryColor(name)
      }
      labelOf={(name) =>
        name === "Other" || name === "Uncategorized" ? name : categoryLabel(name)
      }
    />
  );
}

function MoneyBreakdown({ money }: { money: MoneyReview }) {
  if (money.entryCount === 0) {
    return <EmptyNote>No spending was logged this week.</EmptyNote>;
  }
  return (
    <div>
      <p className="mb-3 flex items-baseline gap-2" style={{ color: "var(--text)" }}>
        <span className="text-[1.5rem] font-bold tracking-tight tabular-nums">
          {formatCents(money.spentCents)}
        </span>
        <span className="text-[0.8rem]" style={{ color: "var(--text-muted)" }}>
          across {plural(money.entryCount, "purchase")}
        </span>
      </p>
      <ShareRows
        rows={money.byCategory}
        total={money.spentCents}
        format={formatCents}
        colorOf={(name) => (name === "Other" ? NEUTRAL_BAR : categoryColor(name))}
        labelOf={(name) => name}
      />
    </div>
  );
}

function HabitRows({ review }: { review: HabitReview }) {
  if (review.rows.length === 0) {
    return (
      <EmptyNote>
        No active habits yet.{" "}
        <Link href="/app/habits" className="underline underline-offset-2">
          Add one
        </Link>{" "}
        to see it here next week.
      </EmptyNote>
    );
  }
  return (
    <ul className="space-y-2.5">
      {review.rows.map((row) => {
        const share = row.due > 0 ? row.done / row.due : 0;
        return (
          <li key={row.id}>
            <div className="flex items-baseline justify-between gap-3 text-[0.84rem]">
              <span className="min-w-0 truncate" style={{ color: "var(--text)" }}>
                {row.title}
              </span>
              <span className="shrink-0 tabular-nums" style={{ color: "var(--text-muted)" }}>
                {row.due > 0 ? `${row.done} of ${row.due}` : "Not due"}
              </span>
            </div>
            <div
              className="mt-1 h-[6px] overflow-hidden rounded-full"
              style={{ background: "var(--bg-tint-strong)" }}
            >
              {row.done > 0 ? (
                <div
                  className="h-full rounded-full"
                  style={{ width: `${Math.max(4, share * 100)}%`, background: "var(--text)" , opacity: 0.7 }}
                />
              ) : null}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
