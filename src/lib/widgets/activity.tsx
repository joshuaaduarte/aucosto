import { auth } from "@/auth";
import { listRecentEvents } from "@/lib/services/events";
import { WidgetCard } from "./widget-card";

function describeEvent(type: string): string {
  switch (type) {
    case "time.started":
      return "started a timer";
    case "time.stopped":
      return "stopped a timer";
    case "time.deleted":
      return "deleted a time entry";
    case "finance.imported":
      return "imported transactions";
    case "finance.cleared":
      return "cleared finance data";
    default:
      return type;
  }
}

function formatWhen(at: Date): string {
  return at.toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export async function ActivityWidget() {
  const session = await auth();
  if (!session?.user?.id) return null;

  const events = await listRecentEvents(session.user.id, { limit: 5 });

  return (
    <WidgetCard name="Activity" href="/app">
      {events.length === 0 ? (
        <div className="space-y-1">
          <p className="text-2xl font-semibold tracking-tight">Quiet start</p>
          <p className="text-sm text-zinc-500">activity will show up here</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {events.map((event) => (
            <li key={event.id} className="space-y-1">
              <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                {describeEvent(event.type)}
              </p>
              <p className="text-xs text-zinc-500">
                {event.tool} · {formatWhen(event.at)}
              </p>
            </li>
          ))}
        </ul>
      )}
    </WidgetCard>
  );
}
