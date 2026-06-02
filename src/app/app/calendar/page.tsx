import type { ReactNode } from "react";
import { getRunningEntry, listCompletedSince } from "@/lib/services/time";
import { listAccounts } from "@/lib/services/finance";
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
  deriveTodayBuckets,
  endOfDay,
  formatCalendarTimeRange,
  isSameDay,
  startOfCalendarWeek,
  startOfDay,
} from "./_lib/derive";
import {
  completeCalendarItemAction,
  createCalendarBlockAction,
  deleteCalendarItemAction,
  moveCalendarItemAction,
  startTimerFromCalendarItemAction,
  updateCalendarBlockAction,
} from "./actions";

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

function EmptyState({ children }: { children: ReactNode }) {
  return (
    <p className="text-[0.875rem]" style={{ color: "var(--text-muted)" }}>
      {children}
    </p>
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

  const [weekItems, runningEntry, completedWeek, accounts] = await Promise.all([
    listCalendarItems(userId, { from: weekStart, to: weekEnd }),
    getRunningEntry(userId),
    listCompletedSince(userId, startOfWeek()),
    context.financeVisible ? listAccounts(userId) : Promise.resolve([]),
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

  return (
    <div className="space-y-8 sm:space-y-10">
      <header className="fade-in">
        <p
          className="text-[0.75rem] font-medium uppercase tracking-wider"
          style={{ color: "var(--text-faint)" }}
        >
          Calendar
        </p>
        <h1
          className="mt-1 text-[2rem] font-bold tracking-tight sm:text-[2.5rem]"
          style={{ color: "var(--text)", letterSpacing: "-0.025em" }}
        >
          The week, shaped on purpose
        </h1>
        <p
          className="mt-2 max-w-2xl text-[0.9375rem]"
          style={{ color: "var(--text-muted)" }}
        >
          Fixed commitments, intentional blocks, and a clearer sense of what
          needs your attention now versus later.
        </p>
      </header>

      {signals.length > 0 ? (
        <section className="fade-in-delay-1">
          <p
            className="mb-2 text-[0.6875rem] font-semibold uppercase tracking-wider"
            style={{ color: "var(--text-faint)" }}
          >
            Today&apos;s signals
          </p>
          <ul className="space-y-1.5">
            {signals.map((signal, i) => (
              <li
                key={`${signal.title}-${i}`}
                className="grid grid-cols-[16px_1fr] items-start gap-3 rounded-md px-2 py-2.5"
              >
                <span
                  className="mt-1.5 inline-block h-1.5 w-1.5 rounded-full"
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
        </section>
      ) : null}

      <section className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <SectionCard eyebrow="Add a block" title="Carve out the next hour you mean to keep.">
          <form action={createCalendarBlockAction} className="space-y-4">
            <div className="space-y-1.5">
              <label
                className="block text-[0.75rem] font-medium"
                style={{ color: "var(--text-muted)" }}
                htmlFor="title"
              >
                Title
              </label>
              <input
                id="title"
                name="title"
                required
                placeholder="Deep work, long run, wedding planning..."
                className="field"
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1.5">
                <label
                  className="block text-[0.75rem] font-medium"
                  style={{ color: "var(--text-muted)" }}
                  htmlFor="date"
                >
                  Date
                </label>
                <input
                  id="date"
                  name="date"
                  type="date"
                  required
                  defaultValue={todayDateValue}
                  className="field"
                />
              </div>
              <div className="space-y-1.5">
                <label
                  className="block text-[0.75rem] font-medium"
                  style={{ color: "var(--text-muted)" }}
                  htmlFor="start"
                >
                  Start
                </label>
                <input
                  id="start"
                  name="start"
                  type="time"
                  required
                  defaultValue="09:00"
                  className="field"
                />
              </div>
              <div className="space-y-1.5">
                <label
                  className="block text-[0.75rem] font-medium"
                  style={{ color: "var(--text-muted)" }}
                  htmlFor="end"
                >
                  End
                </label>
                <input
                  id="end"
                  name="end"
                  type="time"
                  required
                  defaultValue="10:00"
                  className="field"
                />
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label
                  className="block text-[0.75rem] font-medium"
                  style={{ color: "var(--text-muted)" }}
                  htmlFor="location"
                >
                  Location
                </label>
                <input id="location" name="location" className="field" />
              </div>
              <div className="space-y-1.5">
                <label
                  className="block text-[0.75rem] font-medium"
                  style={{ color: "var(--text-muted)" }}
                  htmlFor="notes"
                >
                  Notes
                </label>
                <input id="notes" name="notes" className="field" />
              </div>
            </div>

            <div className="flex justify-end">
              <button type="submit" className="btn-ink">
                Save block
              </button>
            </div>
          </form>
        </SectionCard>

        <div className="grid gap-6">
          <SectionCard eyebrow="Now" title="What the day is asking for first.">
            {buckets.now.length === 0 ? (
              <EmptyState>Nothing is active right now.</EmptyState>
            ) : (
              <ol className="space-y-3">
                {buckets.now.map((item) => (
                  <CalendarItemCard key={item.id} item={item} />
                ))}
              </ol>
            )}
          </SectionCard>

          <SectionCard eyebrow="Next" title="The next commitment worth protecting.">
            {buckets.next.length === 0 ? (
              <EmptyState>No upcoming block yet. Give the rest of the day a shape.</EmptyState>
            ) : (
              <ol className="space-y-3">
                {buckets.next.map((item) => (
                  <CalendarItemCard key={item.id} item={item} />
                ))}
              </ol>
            )}
          </SectionCard>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <SectionCard eyebrow="Needs attention" title="Unfinished blocks you may want to move.">
          {buckets.needsAttention.length === 0 ? (
            <EmptyState>Nothing has slipped yet.</EmptyState>
          ) : (
            <ol className="space-y-3">
              {buckets.needsAttention.map((item) => (
                <CalendarItemCard
                  key={item.id}
                  item={item}
                  showAttentionActions
                />
              ))}
            </ol>
          )}
        </SectionCard>

        <SectionCard eyebrow="Later today" title="Everything else still on deck.">
          {buckets.later.length === 0 ? (
            <EmptyState>The rest of today is still open.</EmptyState>
          ) : (
            <ol className="space-y-3">
              {buckets.later.map((item) => (
                <CalendarItemCard key={item.id} item={item} />
              ))}
            </ol>
          )}
        </SectionCard>
      </section>

      <section>
        <header>
          <p
            className="text-[0.6875rem] font-semibold uppercase tracking-wider"
            style={{ color: "var(--text-faint)" }}
          >
            The week
          </p>
          <h2
            className="mt-1 text-[1.25rem] font-semibold tracking-tight"
            style={{ color: "var(--text)" }}
          >
            Next seven days at a glance
          </h2>
        </header>

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
      </section>
    </div>
  );
}
