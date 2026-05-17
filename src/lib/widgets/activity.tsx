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
    <WidgetCard name="Marginalia" href="/app" folio="III.">
      {events.length === 0 ? (
        <div className="space-y-3">
          <p className="font-display text-[1.5rem] leading-tight tracking-[-0.02em] text-ink">
            A quiet morning.
          </p>
          <p className="font-serif text-sm italic leading-relaxed text-ink-fade">
            Notes from the day will be set in the margin once you begin filing.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="font-serif text-sm italic text-ink-fade">
            Notes filed in the margin, most recent first.
          </p>
          <ol className="rule-soft-t border-rule">
            {events.map((event, i) => (
              <li
                key={event.id}
                className="grid grid-cols-[auto_1fr_auto] items-baseline gap-3 rule-soft-b border-rule py-3 last:border-b-0"
              >
                <span className="font-mono text-[0.6875rem] uppercase tracking-[0.18em] text-ink-ghost tabular">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="font-serif text-sm leading-snug text-ink">
                  {describeEventType(event.type)}
                  <span className="ml-1.5 font-serif italic text-ink-fade">
                    in {event.tool}
                  </span>
                </span>
                <span className="font-mono text-[0.6875rem] tabular text-ink-fade">
                  {formatWhen(event.at)}
                </span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </WidgetCard>
  );
}
