import { homeDaysUntil, homeDueLabel } from "@/lib/home";
import { listHomeLists, listHomeTasks } from "@/lib/services/home";
import { requireViewerContext } from "@/lib/viewer-context";
import { WidgetCard } from "./widget-card";

function readNow(): Date {
  return new Date();
}

export async function HomeWidget() {
  const context = await requireViewerContext();
  const userId = context.homeUserId;
  const [tasks, lists] = await Promise.all([listHomeTasks(userId), listHomeLists(userId)]);
  const now = readNow();
  const due = tasks
    .map((task) => ({ task, days: homeDaysUntil(task.nextDueAt, now) }))
    .filter((t) => t.days <= 2)
    .slice(0, 4);
  const open = lists
    .map((list) => ({ name: list.name, count: list.items.filter((i) => !i.checkedAt).length }))
    .filter((l) => l.count > 0);

  return (
    <WidgetCard name="Home" href="/app/home">
      {due.length === 0 && open.length === 0 ? (
        <div className="space-y-2">
          <p className="text-[0.9375rem] font-semibold tracking-tight" style={{ color: "var(--text)" }}>
            {tasks.length || lists.length ? "Nothing due at home." : "Home"}
          </p>
          <p className="text-[0.8125rem] leading-relaxed" style={{ color: "var(--text-muted)" }}>
            {tasks.length || lists.length
              ? "Lists are empty and no chores are due."
              : "Shared grocery lists, chores and home maintenance."}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {due.length ? (
            <ul className="space-y-0.5">
              {due.map(({ task, days }) => (
                <li key={task.id} className="flex items-baseline justify-between gap-2">
                  <span className="truncate text-[0.8125rem]" style={{ color: "var(--text)" }}>
                    {task.title}
                  </span>
                  <span
                    className="shrink-0 text-[0.6875rem]"
                    style={{ color: days < 0 ? "var(--accent-strong)" : "var(--text-faint)" }}
                  >
                    {homeDueLabel(days)}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
          {open.length ? (
            <p className="text-[0.75rem]" style={{ color: "var(--text-faint)" }}>
              {open.map((l) => `${l.name}: ${l.count}`).join(" · ")}
            </p>
          ) : null}
        </div>
      )}
    </WidgetCard>
  );
}
