import { getRunningEntry, listCompletedSince } from "@/lib/services/time";
import { listAccounts } from "@/lib/services/finance";
import { listCalendarItems } from "@/lib/services/calendar";
import { resolveActiveUserId, requireViewerContext } from "@/lib/viewer-context";
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
  if (status === "done") return "var(--verdigris)";
  if (kind === "suggestion") return "var(--aged-gold)";
  if (kind === "external") return "var(--ink-ghost)";
  return "var(--oxblood)";
}

function SectionEyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="font-mono text-[0.6875rem] uppercase tracking-[0.26em] text-ink-fade">
      {children}
    </p>
  );
}

function EmptyNote({ children }: { children: React.ReactNode }) {
  return <p className="font-serif italic text-sm text-ink-fade">{children}</p>;
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
    <div className="space-y-12 lg:space-y-16">
      <header className="fade-in grid gap-10 lg:grid-cols-[1.55fr_1fr] lg:gap-14">
        <div className="lg:rule-r lg:border-rule lg:pr-14">
          <SectionEyebrow>Section I · The Calendar</SectionEyebrow>
          <h1 className="mt-5 font-display text-[2.7rem] font-medium leading-[0.9] tracking-[-0.045em] text-ink sm:text-[3.7rem] lg:text-[4.5rem]">
            Turn the week into
            <span className="italic text-oxblood"> deliberate time</span>.
          </h1>
          <p className="mt-6 max-w-xl font-serif text-[1.05rem] leading-[1.75] italic text-ink-soft">
            This is the working calendar: fixed commitments, intentional blocks,
            and the signals aucosto can already see from the rest of your system.
          </p>
        </div>

        <section
          className="rounded-xl px-5 py-5"
          style={{ background: "var(--surface)", boxShadow: "var(--surface-shadow)" }}
        >
          <SectionEyebrow>Today&apos;s signals</SectionEyebrow>
          <ol className="mt-4 space-y-3">
            {signals.map((signal, index) => (
              <li key={`${signal.title}-${index}`} className="flex items-start gap-3">
                <span className="mt-1 font-mono text-[0.6875rem] text-ink-ghost">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <div>
                  <p className="text-sm font-medium text-ink">{signal.title}</p>
                  <p className="mt-1 text-sm leading-relaxed text-ink-fade">{signal.detail}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>
      </header>

      <div className="fleuron text-ink-fade">
        <span aria-hidden>✣</span>
      </div>

      <section className="grid gap-8 lg:grid-cols-[1.25fr_0.85fr] lg:gap-12">
        <div
          className="rounded-xl px-5 py-5 sm:px-6"
          style={{ background: "var(--surface)", boxShadow: "var(--surface-shadow)" }}
        >
          <SectionEyebrow>Add a block</SectionEyebrow>
          <form action={createCalendarBlockAction} className="mt-5 space-y-4">
            <div>
              <label className="font-mono text-[0.6875rem] uppercase tracking-[0.22em] text-ink-fade" htmlFor="title">
                Title
              </label>
              <input
                id="title"
                name="title"
                required
                placeholder="Deep work, wedding planning, long run..."
                className="mt-2 w-full rounded-lg border border-rule bg-paper px-3 py-2.5 text-sm text-ink outline-none focus:border-ink"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <label className="font-mono text-[0.6875rem] uppercase tracking-[0.22em] text-ink-fade" htmlFor="date">
                  Date
                </label>
                <input
                  id="date"
                  name="date"
                  type="date"
                  required
                  defaultValue={todayDateValue}
                  className="mt-2 w-full rounded-lg border border-rule bg-paper px-3 py-2.5 text-sm text-ink outline-none focus:border-ink"
                />
              </div>
              <div>
                <label className="font-mono text-[0.6875rem] uppercase tracking-[0.22em] text-ink-fade" htmlFor="start">
                  Start
                </label>
                <input
                  id="start"
                  name="start"
                  type="time"
                  required
                  defaultValue="09:00"
                  className="mt-2 w-full rounded-lg border border-rule bg-paper px-3 py-2.5 text-sm text-ink outline-none focus:border-ink"
                />
              </div>
              <div>
                <label className="font-mono text-[0.6875rem] uppercase tracking-[0.22em] text-ink-fade" htmlFor="end">
                  End
                </label>
                <input
                  id="end"
                  name="end"
                  type="time"
                  required
                  defaultValue="10:00"
                  className="mt-2 w-full rounded-lg border border-rule bg-paper px-3 py-2.5 text-sm text-ink outline-none focus:border-ink"
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="font-mono text-[0.6875rem] uppercase tracking-[0.22em] text-ink-fade" htmlFor="location">
                  Location
                </label>
                <input
                  id="location"
                  name="location"
                  placeholder="Optional"
                  className="mt-2 w-full rounded-lg border border-rule bg-paper px-3 py-2.5 text-sm text-ink outline-none focus:border-ink"
                />
              </div>
              <div>
                <label className="font-mono text-[0.6875rem] uppercase tracking-[0.22em] text-ink-fade" htmlFor="notes">
                  Notes
                </label>
                <input
                  id="notes"
                  name="notes"
                  placeholder="Optional"
                  className="mt-2 w-full rounded-lg border border-rule bg-paper px-3 py-2.5 text-sm text-ink outline-none focus:border-ink"
                />
              </div>
            </div>

            <button
              type="submit"
              className="rounded-lg bg-ink px-4 py-2.5 text-sm font-medium text-paper transition-opacity hover:opacity-90"
            >
              Save block
            </button>
          </form>
        </div>

        <div
          className="rounded-xl px-5 py-5 sm:px-6"
          style={{ background: "var(--surface)", boxShadow: "var(--surface-shadow)" }}
        >
          <SectionEyebrow>Today&apos;s agenda</SectionEyebrow>
          {todayItems.length === 0 ? (
            <div className="mt-5">
              <EmptyNote>No blocks yet. Add one above so the day has a shape.</EmptyNote>
            </div>
          ) : (
            <ol className="mt-4 space-y-3">
              {todayItems.map((item) => (
                <li
                  key={item.id}
                  className="rounded-lg border border-rule px-4 py-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span
                          className="h-2 w-2 rounded-full"
                          style={{ background: itemTone(item.kind, item.status) }}
                        />
                        <p className="text-sm font-medium text-ink">{item.title}</p>
                      </div>
                      <p className="mt-1 font-mono text-[0.6875rem] uppercase tracking-[0.18em] text-ink-fade">
                        {formatCalendarTimeRange(item)} · {item.kind}
                      </p>
                      {item.notes ? (
                        <p className="mt-2 text-sm text-ink-fade">{item.notes}</p>
                      ) : null}
                    </div>
                    <div className="flex items-center gap-2">
                      {item.status !== "done" && (
                        <form action={completeCalendarItemAction}>
                          <input type="hidden" name="id" value={item.id} />
                          <button className="rounded-md border border-rule px-2.5 py-1.5 text-xs text-ink-fade hover:text-ink">
                            Done
                          </button>
                        </form>
                      )}
                      <form action={deleteCalendarItemAction}>
                        <input type="hidden" name="id" value={item.id} />
                        <button className="rounded-md border border-rule px-2.5 py-1.5 text-xs text-ink-fade hover:text-ink">
                          Delete
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

      <section>
        <header className="rule-b border-ink pb-3">
          <SectionEyebrow>The week</SectionEyebrow>
          <h2 className="mt-1.5 font-display text-2xl font-medium italic tracking-[-0.02em] text-ink">
            A rough working view of the next seven days.
          </h2>
        </header>

        <div className="mt-6 grid gap-4 lg:grid-cols-7">
          {weekDays.map((day) => {
            const items = groupForDay(weekItems, day.date);
            return (
              <section
                key={day.key}
                className="rounded-xl px-4 py-4"
                style={{ background: "var(--surface)", boxShadow: "var(--surface-shadow)" }}
              >
                <div className="rule-soft-b border-rule pb-3">
                  <p className="font-mono text-[0.6875rem] uppercase tracking-[0.18em] text-ink-fade">
                    {day.label}
                  </p>
                  <p className="mt-1 text-sm font-medium text-ink">{day.monthDay}</p>
                </div>

                <div className="mt-4 space-y-3">
                  {items.length === 0 ? (
                    <EmptyNote>Open space.</EmptyNote>
                  ) : (
                    items.map((item) => (
                      <article
                        key={item.id}
                        className="rounded-lg border border-rule px-3 py-3"
                      >
                        <div className="flex items-center gap-2">
                          <span
                            className="h-2 w-2 rounded-full"
                            style={{ background: itemTone(item.kind, item.status) }}
                          />
                          <p className="text-sm font-medium leading-snug text-ink">{item.title}</p>
                        </div>
                        <p className="mt-2 font-mono text-[0.6875rem] uppercase tracking-[0.16em] text-ink-fade">
                          {formatCalendarTimeRange(item)}
                        </p>
                        {item.location ? (
                          <p className="mt-2 text-xs text-ink-fade">{item.location}</p>
                        ) : null}
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
