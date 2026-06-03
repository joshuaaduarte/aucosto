import type { ReactNode } from "react";
import { getRunningEntry, listCompletedSince } from "@/lib/services/time";
import { listAccounts } from "@/lib/services/finance";
import { listSuggestedDoItems } from "@/lib/services/do";
import { listCalendarItems } from "@/lib/services/calendar";
import {
  resolveActiveUserId,
  requireViewerContext,
} from "@/lib/viewer-context";
import { startOfWeek } from "@/lib/time";
import { sumDurations } from "@/lib/time-summary";
import type { CalendarItem } from "@/generated/prisma/client";
import {
  addDays,
  buildWeekDays,
  deriveCalendarSignals,
  deriveGapSuggestions,
  deriveTodayBuckets,
  endOfDay,
  formatCalendarTimeRange,
  isSameDay,
  startOfCalendarWeek,
  startOfDay,
} from "./_lib/derive";
import {
  completeCalendarItemAction,
  deleteCalendarItemAction,
  moveCalendarItemAction,
  startTimerFromCalendarItemAction,
  updateCalendarBlockAction,
} from "./actions";
import { CalendarQuickAddModal } from "./quick-add-modal";

export const dynamic = "force-dynamic";

function itemTone(kind: string, status: string) {
  if (status === "done") return "var(--text-faint)";
  if (kind === "suggestion") return "var(--accent)";
  if (kind === "external") return "var(--text-faint)";
  return "var(--text)";
}

function formatDateValue(date: Date) {
  return date.toLocaleDateString("en-CA");
}

function formatTimeValue(date: Date) {
  return date.toLocaleTimeString("en-CA", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function formatShortTime(date: Date) {
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

function groupForDay(items: CalendarItem[], day: Date) {
  return items.filter((item) => isSameDay(item.startsAt, day));
}

function SectionCard({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title?: string;
  children: ReactNode;
}) {
  return (
    <section
      className="rounded-md p-5"
      style={{
        background: "var(--bg-page)",
        border: "1px solid var(--border-soft)",
      }}
    >
      <p
        className="text-[0.6875rem] font-semibold uppercase tracking-wider"
        style={{ color: "var(--text-faint)" }}
      >
        {eyebrow}
      </p>
      {title ? (
        <h2
          className="mt-1 text-[1rem] font-semibold tracking-tight"
          style={{ color: "var(--text)" }}
        >
          {title}
        </h2>
      ) : null}
      <div className={title ? "mt-4" : "mt-3"}>{children}</div>
    </section>
  );
}

function CompactMoveForm({
  item,
  label,
  shiftDays = 0,
}: {
  item: CalendarItem;
  label: string;
  shiftDays?: number;
}) {
  const startsAt = addDays(item.startsAt, shiftDays);
  const endsAt = addDays(item.endsAt, shiftDays);
  return (
    <form action={moveCalendarItemAction}>
      <input type="hidden" name="id" value={item.id} />
      <input type="hidden" name="date" value={formatDateValue(startsAt)} />
      <input type="hidden" name="start" value={formatTimeValue(startsAt)} />
      <input type="hidden" name="end" value={formatTimeValue(endsAt)} />
      <button className="btn-ghost h-8 px-2.5 text-[0.75rem]" type="submit">
        {label}
      </button>
    </form>
  );
}

function CalendarItemCard({
  item,
  showAttentionActions = false,
}: {
  item: CalendarItem;
  showAttentionActions?: boolean;
}) {
  return (
    <li
      className="rounded-md p-3 sm:p-3.5"
      style={{ border: "1px solid var(--border-faint)" }}
    >
      <div className="flex flex-col gap-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className="h-1.5 w-1.5 rounded-full"
                style={{ background: itemTone(item.kind, item.status) }}
              />
              <p
                className="text-[0.9375rem] font-medium"
                style={{ color: "var(--text)" }}
              >
                {item.title}
              </p>
              {item.status === "done" ? (
                <span className="pill">done</span>
              ) : null}
            </div>
            <p
              className="mt-1 text-[0.75rem]"
              style={{ color: "var(--text-faint)" }}
            >
              {formatCalendarTimeRange(item)}
              {item.location ? ` · ${item.location}` : ""}
            </p>
            {item.notes ? (
              <p
                className="mt-1.5 text-[0.8125rem]"
                style={{ color: "var(--text-muted)" }}
              >
                {item.notes}
              </p>
            ) : null}
          </div>

          <div className="flex shrink-0 flex-wrap justify-end gap-1.5">
            {item.status !== "done" ? (
              <form action={startTimerFromCalendarItemAction}>
                <input type="hidden" name="id" value={item.id} />
                <input type="hidden" name="title" value={item.title} />
                <input
                  type="hidden"
                  name="doItemId"
                  value={item.sourceTool === "do" ? (item.sourceRefId ?? "") : ""}
                />
                <button
                  className="btn-ghost h-8 px-2.5 text-[0.75rem]"
                  type="submit"
                >
                  Start timer
                </button>
              </form>
            ) : null}
            {item.status !== "done" ? (
              <form action={completeCalendarItemAction}>
                <input type="hidden" name="id" value={item.id} />
                <button
                  className="btn-ghost h-8 px-2.5 text-[0.75rem]"
                  type="submit"
                >
                  Done
                </button>
              </form>
            ) : null}
            <form action={deleteCalendarItemAction}>
              <input type="hidden" name="id" value={item.id} />
              <button
                className="btn-ghost h-8 px-2.5 text-[0.75rem]"
                type="submit"
              >
                Delete
              </button>
            </form>
          </div>
        </div>

        {showAttentionActions ? (
          <div className="flex flex-wrap gap-2">
            <CompactMoveForm item={item} label="Later today" />
            <CompactMoveForm item={item} label="Tomorrow" shiftDays={1} />
          </div>
        ) : null}

        <details
          className="rounded-md border"
          style={{ borderColor: "var(--border-faint)" }}
        >
          <summary
            className="cursor-pointer list-none px-3 py-2 text-[0.75rem] font-medium"
            style={{ color: "var(--text-muted)" }}
          >
            Edit or reschedule
          </summary>
          <form action={updateCalendarBlockAction} className="space-y-3 px-3 pb-3">
            <input type="hidden" name="id" value={item.id} />
            <div className="space-y-1.5">
              <label
                className="block text-[0.75rem] font-medium"
                htmlFor={`title-${item.id}`}
                style={{ color: "var(--text-muted)" }}
              >
                Title
              </label>
              <input
                id={`title-${item.id}`}
                name="title"
                defaultValue={item.title}
                required
                className="field"
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1.5">
                <label
                  className="block text-[0.75rem] font-medium"
                  htmlFor={`date-${item.id}`}
                  style={{ color: "var(--text-muted)" }}
                >
                  Date
                </label>
                <input
                  id={`date-${item.id}`}
                  name="date"
                  type="date"
                  defaultValue={formatDateValue(item.startsAt)}
                  required
                  className="field"
                />
              </div>
              <div className="space-y-1.5">
                <label
                  className="block text-[0.75rem] font-medium"
                  htmlFor={`start-${item.id}`}
                  style={{ color: "var(--text-muted)" }}
                >
                  Start
                </label>
                <input
                  id={`start-${item.id}`}
                  name="start"
                  type="time"
                  defaultValue={formatTimeValue(item.startsAt)}
                  required
                  className="field"
                />
              </div>
              <div className="space-y-1.5">
                <label
                  className="block text-[0.75rem] font-medium"
                  htmlFor={`end-${item.id}`}
                  style={{ color: "var(--text-muted)" }}
                >
                  End
                </label>
                <input
                  id={`end-${item.id}`}
                  name="end"
                  type="time"
                  defaultValue={formatTimeValue(item.endsAt)}
                  required
                  className="field"
                />
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label
                  className="block text-[0.75rem] font-medium"
                  htmlFor={`location-${item.id}`}
                  style={{ color: "var(--text-muted)" }}
                >
                  Location
                </label>
                <input
                  id={`location-${item.id}`}
                  name="location"
                  defaultValue={item.location ?? ""}
                  className="field"
                />
              </div>
              <div className="space-y-1.5">
                <label
                  className="block text-[0.75rem] font-medium"
                  htmlFor={`notes-${item.id}`}
                  style={{ color: "var(--text-muted)" }}
                >
                  Notes
                </label>
                <input
                  id={`notes-${item.id}`}
                  name="notes"
                  defaultValue={item.notes ?? ""}
                  className="field"
                />
              </div>
            </div>

            <div className="flex justify-end">
              <button type="submit" className="btn-ink">
                Save changes
              </button>
            </div>
          </form>
        </details>
      </div>
    </li>
  );
}

export default async function CalendarPage() {
  const userId = await resolveActiveUserId();
  const context = await requireViewerContext();

  const weekStart = startOfCalendarWeek();
  const weekEnd = addDays(weekStart, 7);
  const now = new Date();
  const todayStart = startOfDay(now);
  const todayEnd = endOfDay(now);

  const [weekItems, runningEntry, completedWeek, accounts, suggestedTasks] = await Promise.all([
    listCalendarItems(userId, { from: weekStart, to: weekEnd }),
    getRunningEntry(userId),
    listCompletedSince(userId, startOfWeek()),
    context.financeVisible ? listAccounts(userId) : Promise.resolve([]),
    listSuggestedDoItems(userId, { limit: 5 }),
  ]);

  const todayItems = weekItems.filter(
    (item) => item.startsAt < todayEnd && item.endsAt > todayStart,
  );
  const weekDays = buildWeekDays();
  const signals = deriveCalendarSignals({
    todayItems,
    runningEntry,
    weekTotalMs: sumDurations(completedWeek),
    accounts,
  });
  const buckets = deriveTodayBuckets(todayItems, now);
  const todayDateValue = formatDateValue(now);
  const nextItem = buckets.now[0] ?? buckets.next[0] ?? null;
  const totalTodayCount = todayItems.length;
  const slippedCount = buckets.needsAttention.length;
  const todayFocusLabel =
    totalTodayCount === 0
      ? "Open day"
      : `${totalTodayCount} ${totalTodayCount === 1 ? "block" : "blocks"}`;
  const nextLabel = nextItem
    ? `${nextItem.title} at ${formatShortTime(nextItem.startsAt)}`
    : "Nothing lined up";
  const slippedLabel =
    slippedCount === 0
      ? "Nothing slipping"
      : `${slippedCount} ${slippedCount === 1 ? "block needs" : "blocks need"} attention`;
  const showNowSection = buckets.now.length > 0;
  const showNextSection = buckets.next.length > 0;
  const showAttentionSection = buckets.needsAttention.length > 0;
  const showLaterSection = buckets.later.length > 0;
  const gapSuggestions = deriveGapSuggestions({
    now,
    todayItems,
    suggestedTasks,
    limit: 3,
  });

  return (
    <div className="space-y-8 pb-28 sm:space-y-10 sm:pb-8">
      <header className="fade-in">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p
              className="text-[0.75rem] font-medium uppercase tracking-wider"
              style={{ color: "var(--text-faint)" }}
            >
              Calendar
            </p>
            <h1
              className="mt-1 text-[1.5rem] font-bold tracking-tight sm:text-[1.875rem]"
              style={{ color: "var(--text)", letterSpacing: "-0.025em" }}
            >
              Today
            </h1>
          </div>
          <p
            className="text-[0.8125rem] sm:max-w-[38rem] sm:text-right"
            style={{ color: "var(--text-muted)" }}
          >
            {todayItems.length} item{todayItems.length === 1 ? "" : "s"} today
            {gapSuggestions.length > 0 ? ` · ${gapSuggestions.length} open-slot suggestion${gapSuggestions.length === 1 ? "" : "s"}` : ""}
            {slippedCount > 0 ? ` · ${slippedCount} need attention` : ""}
          </p>
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-3">
          <div className="rounded-md border px-3 py-2.5" style={{ borderColor: "var(--border-faint)", background: "var(--bg-page)" }}>
            <p className="text-[0.6875rem] font-semibold uppercase tracking-wider" style={{ color: "var(--text-faint)" }}>
              Today
            </p>
            <p className="mt-1 text-[0.9375rem] font-medium" style={{ color: "var(--text)" }}>
              {todayFocusLabel}
            </p>
          </div>
          <div className="rounded-md border px-3 py-2.5" style={{ borderColor: "var(--border-faint)", background: "var(--bg-page)" }}>
            <p className="text-[0.6875rem] font-semibold uppercase tracking-wider" style={{ color: "var(--text-faint)" }}>
              Next up
            </p>
            <p className="mt-1 text-[0.9375rem] font-medium" style={{ color: "var(--text)" }}>
              {nextLabel}
            </p>
          </div>
          <div className="rounded-md border px-3 py-2.5" style={{ borderColor: "var(--border-faint)", background: "var(--bg-page)" }}>
            <p className="text-[0.6875rem] font-semibold uppercase tracking-wider" style={{ color: "var(--text-faint)" }}>
              Attention
            </p>
            <p className="mt-1 text-[0.9375rem] font-medium" style={{ color: "var(--text)" }}>
              {slippedLabel}
            </p>
          </div>
        </div>
      </header>

      {signals.length > 0 ? (
        <section className="fade-in-delay-1 rounded-md border p-4 sm:p-5" style={{ borderColor: "var(--border-soft)", background: "var(--bg-page)" }}>
          <div className="flex items-center justify-between gap-3">
            <p
              className="text-[0.6875rem] font-semibold uppercase tracking-wider"
              style={{ color: "var(--text-faint)" }}
            >
              Today&apos;s signals
            </p>
            <p className="text-[0.75rem]" style={{ color: "var(--text-faint)" }}>
              {signals.length} {signals.length === 1 ? "note" : "notes"}
            </p>
          </div>
          <ul className="mt-3 space-y-1.5">
            {signals.slice(0, 2).map((signal, i) => (
              <li
                key={`${signal.title}-${i}`}
                className="grid grid-cols-[16px_1fr] items-start gap-3 rounded-md px-2 py-2"
              >
                <span
                  className="mt-1.25 inline-block h-1.5 w-1.5 rounded-full"
                  style={{ background: "var(--text)" }}
                />
                <div>
                  <p
                    className="text-[0.875rem] font-medium"
                    style={{ color: "var(--text)" }}
                  >
                    {signal.title}
                  </p>
                  <p
                    className="mt-0.5 text-[0.8125rem]"
                    style={{ color: "var(--text-muted)" }}
                  >
                    {signal.detail}
                  </p>
                </div>
              </li>
            ))}
          </ul>
          {signals.length > 2 ? (
            <p className="mt-2 px-2 text-[0.75rem]" style={{ color: "var(--text-faint)" }}>
              +{signals.length - 2} more inferences. Keep this section short and useful.
            </p>
          ) : null}
        </section>
      ) : null}

      {gapSuggestions.length > 0 ? (
        <section
          className="rounded-md border p-4 sm:p-5"
          style={{ borderColor: "var(--border-soft)", background: "var(--bg-page)" }}
        >
          <div className="flex items-center justify-between gap-3">
            <div>
              <p
                className="text-[0.6875rem] font-semibold uppercase tracking-wider"
                style={{ color: "var(--text-faint)" }}
              >
                Open time
              </p>
              <h2
                className="mt-1 text-[1rem] font-semibold tracking-tight"
                style={{ color: "var(--text)" }}
              >
                Tasks that fit the day you already have
              </h2>
            </div>
            <p className="text-[0.75rem]" style={{ color: "var(--text-faint)" }}>
              {gapSuggestions.length} suggestion{gapSuggestions.length === 1 ? "" : "s"}
            </p>
          </div>
          <ol className="mt-4 space-y-3">
            {gapSuggestions.map((suggestion) => (
              <li
                key={`${suggestion.taskId}-${suggestion.gapStart.toISOString()}`}
                className="rounded-md border p-3"
                style={{ borderColor: "var(--border-faint)" }}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-[0.9375rem] font-medium" style={{ color: "var(--text)" }}>
                    {suggestion.title}
                  </p>
                  <span className="pill">
                    {suggestion.fit === "tight" ? "tight fit" : "comfortable fit"}
                  </span>
                </div>
                <p className="mt-1 text-[0.75rem]" style={{ color: "var(--text-faint)" }}>
                  {`${formatShortTime(suggestion.gapStart)}-${formatShortTime(suggestion.gapEnd)} open`}
                  {suggestion.estimateMinutes
                    ? ` · estimate ${suggestion.estimateMinutes}m`
                    : ""}
                </p>
                <p className="mt-1.5 text-[0.8125rem]" style={{ color: "var(--text-muted)" }}>
                  {suggestion.reason}
                </p>
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      <section className="grid gap-6">
        {(showNowSection || showNextSection) ? (
          <div className="grid gap-6 xl:grid-cols-2">
            {showNowSection ? (
              <SectionCard eyebrow="Now" title="What matters first.">
                <ol className="space-y-3">
                  {buckets.now.map((item) => (
                    <CalendarItemCard key={item.id} item={item} />
                  ))}
                </ol>
              </SectionCard>
            ) : null}

            {showNextSection ? (
              <SectionCard eyebrow="Next" title="What you should protect next.">
                <ol className="space-y-3">
                  {buckets.next.map((item) => (
                    <CalendarItemCard key={item.id} item={item} />
                  ))}
                </ol>
              </SectionCard>
            ) : null}
          </div>
        ) : (
          <section
            className="rounded-md border px-4 py-4"
            style={{
              borderColor: "var(--border-soft)",
              background: "var(--bg-page)",
            }}
          >
            <p
              className="text-[0.6875rem] font-semibold uppercase tracking-wider"
              style={{ color: "var(--text-faint)" }}
            >
              Open space
            </p>
            <p
              className="mt-1 text-[1rem] font-semibold tracking-tight"
              style={{ color: "var(--text)" }}
            >
              The day is still open.
            </p>
            <p className="mt-2 text-[0.875rem]" style={{ color: "var(--text-muted)" }}>
              Use the add button when you know the next block worth protecting.
            </p>
          </section>
        )}
      </section>

      {(showAttentionSection || showLaterSection) ? (
        <section className="grid gap-6 lg:grid-cols-2">
          {showAttentionSection ? (
            <SectionCard eyebrow="Needs attention" title="Unfinished blocks you may want to move.">
              <ol className="space-y-3">
                {buckets.needsAttention.map((item) => (
                  <CalendarItemCard
                    key={item.id}
                    item={item}
                    showAttentionActions
                  />
                ))}
              </ol>
            </SectionCard>
          ) : null}

          {showLaterSection ? (
            <SectionCard eyebrow="Later today" title="Everything else still on deck.">
              <ol className="space-y-3">
                {buckets.later.map((item) => (
                  <CalendarItemCard key={item.id} item={item} />
                ))}
              </ol>
            </SectionCard>
          ) : null}
        </section>
      ) : null}

      <details className="group rounded-md border p-4 sm:p-5" style={{ borderColor: "var(--border-soft)", background: "var(--bg-page)" }}>
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
          <div>
            <p
              className="text-[0.6875rem] font-semibold uppercase tracking-wider"
              style={{ color: "var(--text-faint)" }}
            >
              The week
            </p>
            <h2
              className="mt-1 text-[1.0625rem] font-semibold tracking-tight"
              style={{ color: "var(--text)" }}
            >
              Next seven days at a glance
            </h2>
          </div>
          <p className="text-[0.75rem] transition-transform group-open:rotate-180" style={{ color: "var(--text-faint)" }}>
            v
          </p>
        </summary>

        <div className="mt-5 grid gap-2 sm:grid-cols-2 xl:grid-cols-7">
          {weekDays.map((day) => {
            const items = groupForDay(weekItems, day.date);
            return (
              <section
                key={day.key}
                className="rounded-md p-3"
                style={{
                  background: "var(--bg-page)",
                  border: "1px solid var(--border-faint)",
                }}
              >
                <div
                  className="pb-2"
                  style={{ borderBottom: "1px solid var(--border-faint)" }}
                >
                  <p
                    className="text-[0.625rem] font-semibold uppercase tracking-wider"
                    style={{ color: "var(--text-faint)" }}
                  >
                    {day.label}
                  </p>
                  <p
                    className="mt-0.5 text-[0.8125rem] font-semibold tracking-tight"
                    style={{ color: "var(--text)" }}
                  >
                    {day.monthDay}
                  </p>
                </div>

                <div className="mt-2 space-y-1.5">
                  {items.length === 0 ? (
                    <p
                      className="text-[0.75rem]"
                      style={{ color: "var(--text-faint)" }}
                    >
                      Open
                    </p>
                  ) : (
                    items.map((item) => (
                      <article
                        key={item.id}
                        className="rounded px-2 py-1.5"
                        style={{ background: "var(--bg-tint)" }}
                      >
                        <div className="flex items-center gap-1.5">
                          <span
                            className="h-1.5 w-1.5 shrink-0 rounded-full"
                            style={{
                              background: itemTone(item.kind, item.status),
                            }}
                          />
                          <p
                            className="truncate text-[0.75rem] font-medium leading-snug"
                            style={{ color: "var(--text)" }}
                          >
                            {item.title}
                          </p>
                        </div>
                        <p
                          className="mt-0.5 pl-3 text-[0.6875rem]"
                          style={{ color: "var(--text-faint)" }}
                        >
                          {formatCalendarTimeRange(item)}
                        </p>
                      </article>
                    ))
                  )}
                </div>
              </section>
            );
          })}
        </div>
      </details>

      <CalendarQuickAddModal
        todayDateValue={todayDateValue}
        suggestedTasks={suggestedTasks.map((task) => ({
          id: task.id,
          title: task.title,
          estimatedMinutes: task.estimatedMinutes,
        }))}
        gapSuggestions={gapSuggestions.map((suggestion) => ({
          taskId: suggestion.taskId,
          title: suggestion.title,
          estimateMinutes: suggestion.estimateMinutes,
          gapLabel: `${formatShortTime(suggestion.gapStart)}-${formatShortTime(suggestion.gapEnd)}`,
          start: formatTimeValue(suggestion.gapStart),
          end: formatTimeValue(
            suggestion.estimateMinutes
              ? new Date(
                  suggestion.gapStart.getTime() +
                    suggestion.estimateMinutes * 60000,
                )
              : suggestion.gapEnd,
          ),
        }))}
      />
    </div>
  );
}
