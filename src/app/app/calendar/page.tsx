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
} from "./actions";

export const dynamic = "force-dynamic";

function itemTone(kind: string, status: string) {
  if (status === "done") return "var(--text-faint)";
  if (kind === "suggestion") return "var(--accent)";
  if (kind === "external") return "var(--text-faint)";
  return "var(--text)";
}

function groupForDay(items: CalendarItem[], day: Date) {
  return items.filter((item) => isSameDay(item.startsAt, day));
}

export default async function CalendarPage() {
  const userId = await resolveActiveUserId();
  const context = await requireViewerContext();

  const weekStart = startOfCalendarWeek();
  const weekEnd = addDays(weekStart, 7);
  const todayStart = startOfDay(new Date());
  const todayEnd = endOfDay(new Date());

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

  const todayDateValue = new Date().toLocaleDateString("en-CA");

  return (
    <div className="space-y-10">
      {/* Page header */}
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
          className="mt-2 text-[0.9375rem]"
          style={{ color: "var(--text-muted)" }}
        >
          Fixed commitments, intentional blocks, and the signals aucosto can
          already see from the rest of your system.
        </p>
      </header>

      {/* Signals */}
      {signals.length > 0 && (
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
      )}

      {/* Add a block + today's agenda */}
      <section className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr] lg:gap-10">
        <div
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
            Add a block
          </p>
          <h2
            className="mt-1 text-[1rem] font-semibold tracking-tight"
            style={{ color: "var(--text)" }}
          >
            Carve out the next hour you mean to keep.
          </h2>

          <form action={createCalendarBlockAction} className="mt-4 space-y-4">
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
                placeholder="Deep work, long run, wedding planning…"
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
                  Location <span style={{ color: "var(--text-faint)" }}>(optional)</span>
                </label>
                <input id="location" name="location" className="field" />
              </div>
              <div className="space-y-1.5">
                <label
                  className="block text-[0.75rem] font-medium"
                  style={{ color: "var(--text-muted)" }}
                  htmlFor="notes"
                >
                  Notes <span style={{ color: "var(--text-faint)" }}>(optional)</span>
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
        </div>

        <div
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
            Today&apos;s agenda
          </p>

          {todayItems.length === 0 ? (
            <p
              className="mt-4 text-[0.875rem]"
              style={{ color: "var(--text-muted)" }}
            >
              No blocks yet. Add one so the day has a shape.
            </p>
          ) : (
            <ol className="mt-3 space-y-1.5">
              {todayItems.map((item) => (
                <li
                  key={item.id}
                  className="group rounded-md px-3 py-2.5 transition-colors hover:bg-bg-hover"
                  style={{ border: "1px solid var(--border-faint)" }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span
                          className="h-1.5 w-1.5 rounded-full"
                          style={{ background: itemTone(item.kind, item.status) }}
                        />
                        <p
                          className="truncate text-[0.875rem] font-medium"
                          style={{ color: "var(--text)" }}
                        >
                          {item.title}
                        </p>
                      </div>
                      <p
                        className="mt-1 text-[0.75rem]"
                        style={{ color: "var(--text-faint)" }}
                      >
                        {formatCalendarTimeRange(item)} · {item.kind}
                      </p>
                      {item.notes && (
                        <p
                          className="mt-1.5 text-[0.8125rem]"
                          style={{ color: "var(--text-muted)" }}
                        >
                          {item.notes}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                      {item.status !== "done" && (
                        <form action={completeCalendarItemAction}>
                          <input type="hidden" name="id" value={item.id} />
                          <button
                            className="btn-icon"
                            title="Mark done"
                            aria-label="Mark done"
                          >
                            <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                              <path d="m3 7 3 3 5-6" />
                            </svg>
                          </button>
                        </form>
                      )}
                      <form action={deleteCalendarItemAction}>
                        <input type="hidden" name="id" value={item.id} />
                        <button
                          className="btn-icon"
                          title="Delete"
                          aria-label="Delete"
                        >
                          <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" aria-hidden>
                            <path d="M3.5 3.5l6 6M9.5 3.5l-6 6" />
                          </svg>
                        </button>
                      </form>
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </div>
      </section>

      {/* The week */}
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

        <div className="mt-5 grid gap-2 lg:grid-cols-7">
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
                        style={{
                          background: "var(--bg-tint)",
                        }}
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
