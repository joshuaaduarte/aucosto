import { listUpcomingCalendarItems } from "@/lib/services/calendar";
import { resolveActiveUserId } from "@/lib/viewer-context";
import { WidgetCard } from "./widget-card";

function formatWhen(date: Date) {
  return date.toLocaleString([], {
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

export async function CalendarWidget() {
  const userId = await resolveActiveUserId();
  const items = await listUpcomingCalendarItems(userId, { limit: 3 });
  const next = items[0] ?? null;

  return (
    <WidgetCard name="Calendar" href="/app/calendar">
      {!next ? (
        <div className="space-y-2">
          <p
            className="text-[0.9375rem] font-semibold tracking-tight"
            style={{ color: "var(--text)" }}
          >
            Nothing scheduled yet.
          </p>
          <p
            className="text-[0.8125rem] leading-relaxed"
            style={{ color: "var(--text-muted)" }}
          >
            Add one block and the week will have somewhere to begin.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <div>
            <p
              className="text-[0.6875rem] font-medium uppercase tracking-wider"
              style={{ color: "var(--text-faint)" }}
            >
              Next up
            </p>
            <p
              className="mt-0.5 text-[1rem] font-semibold tracking-tight"
              style={{ color: "var(--text)" }}
            >
              {next.title}
            </p>
            <p
              className="mt-0.5 text-[0.75rem]"
              style={{ color: "var(--text-muted)" }}
            >
              {formatWhen(next.startsAt)}
            </p>
          </div>

          {items.length > 1 && (
            <ol
              className="space-y-1.5 pt-2"
              style={{ borderTop: "1px solid var(--border-faint)" }}
            >
              {items.slice(1).map((item) => (
                <li
                  key={item.id}
                  className="flex items-baseline justify-between gap-2"
                >
                  <span
                    className="truncate text-[0.8125rem]"
                    style={{ color: "var(--text)" }}
                  >
                    {item.title}
                  </span>
                  <span
                    className="shrink-0 text-[0.6875rem] tabular"
                    style={{ color: "var(--text-faint)" }}
                  >
                    {formatWhen(item.startsAt)}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </div>
      )}
    </WidgetCard>
  );
}
