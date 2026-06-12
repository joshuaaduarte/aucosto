import type { CalendarItem } from "@/generated/prisma/client";
import {
  type buildWeekDays,
  formatCalendarTimeRange,
  groupForDay,
  calendarItemColor,
} from "../_lib/derive";

export function WeekOverview({
  weekDays,
  weekItems,
}: {
  weekDays: ReturnType<typeof buildWeekDays>;
  weekItems: CalendarItem[];
}) {
  return (
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
                            background: calendarItemColor(item),
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
  );
}
