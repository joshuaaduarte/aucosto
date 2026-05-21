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
    <WidgetCard name="Calendar" href="/app/calendar" folio="I.">
      {!next ? (
        <div className="space-y-3">
          <p className="font-display text-[1.5rem] leading-tight tracking-[-0.02em] text-ink">
            Nothing scheduled yet.
          </p>
          <p className="font-serif text-sm italic leading-relaxed text-ink-fade">
            Add one deliberate block and the week will have somewhere to begin.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <div>
            <p className="font-mono text-[0.6875rem] uppercase tracking-[0.18em] text-ink-ghost">
              Next up
            </p>
            <p className="mt-2 font-display text-[1.5rem] leading-tight tracking-[-0.02em] text-ink">
              {next.title}
            </p>
            <p className="mt-2 font-serif text-sm italic text-ink-fade">
              {formatWhen(next.startsAt)}
            </p>
          </div>

          {items.length > 1 ? (
            <ol className="rule-soft-t border-rule">
              {items.slice(1).map((item) => (
                <li
                  key={item.id}
                  className="flex items-baseline justify-between gap-3 rule-soft-b border-rule py-3 last:border-b-0"
                >
                  <span className="text-sm text-ink">{item.title}</span>
                  <span className="font-mono text-[0.6875rem] text-ink-fade">
                    {formatWhen(item.startsAt)}
                  </span>
                </li>
              ))}
            </ol>
          ) : null}
        </div>
      )}
    </WidgetCard>
  );
}
