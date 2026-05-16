import { listRecentEvents } from "@/lib/services/events";
import { resolveActiveUserId } from "@/lib/viewer-context";
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
  const userId = await resolveActiveUserId();
  const events = await listRecentEvents(userId, { limit: 5 });

  return (
    <WidgetCard name="Activity" href="/app">
      {events.length === 0 ? (
        <div className="space-y-3">
          <p className="text-2xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">Quiet start</p>
          <p className="text-sm text-zinc-500">Recent actions will collect here once you start tracking or importing.</p>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-zinc-500">Recent activity across the workspace.</p>
          <ul className="space-y-3">
            {events.map((event) => (
              <li key={event.id} className="rounded-2xl border border-zinc-200/80 bg-zinc-50/80 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-950/60">
                <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                  {describeEvent(event.type)}
                </p>
                <p className="mt-1 text-xs text-zinc-500">
                  {event.tool} · {formatWhen(event.at)}
                </p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </WidgetCard>
  );
}
