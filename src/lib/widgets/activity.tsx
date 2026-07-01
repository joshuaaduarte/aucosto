import { describeEventType } from "@/lib/event-types";
import { listRecentEvents } from "@/lib/services/events";
import { resolveActiveUserId } from "@/lib/viewer-context";
import { WidgetCard } from "./widget-card";

function formatWhen(at: Date): string {
  return at.toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export async function ActivityWidget() {
  const userId = await resolveActiveUserId();
  const events = await listRecentEvents(userId, { limit: 5 });

  return (
    <WidgetCard name="Activity" href="/app">
      {events.length === 0 ? (
        <div className="space-y-2">
          <p
            className="text-[0.9375rem] font-semibold tracking-tight"
            style={{ color: "var(--text)" }}
          >
            All quiet so far.
          </p>
          <p
            className="text-[0.8125rem] leading-relaxed"
            style={{ color: "var(--text-muted)" }}
          >
            Recent changes across your tools will show up here once you start filing.
          </p>
        </div>
      ) : (
        <ol className="space-y-1.5">
          {events.map((event) => (
            <li
              key={event.id}
              className="grid grid-cols-[1fr_auto] items-baseline gap-2"
            >
              <span
                className="truncate text-[0.8125rem]"
                style={{ color: "var(--text)" }}
              >
                {describeEventType(event.type)}
                <span
                  className="ml-1 text-[0.75rem]"
                  style={{ color: "var(--text-faint)" }}
                >
                  · {event.tool}
                </span>
              </span>
              <span
                className="shrink-0 text-[0.6875rem] tabular"
                style={{ color: "var(--text-faint)" }}
              >
                {formatWhen(event.at)}
              </span>
            </li>
          ))}
        </ol>
      )}
    </WidgetCard>
  );
}
