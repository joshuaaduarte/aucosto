import { listSuggestedHabits } from "@/lib/services/habits";
import { resolveActiveUserId } from "@/lib/viewer-context";
import { WidgetCard } from "./widget-card";

export async function HabitsWidget() {
  const userId = await resolveActiveUserId();
  const habits = await listSuggestedHabits(userId, { limit: 3 });
  const next = habits[0] ?? null;

  return (
    <WidgetCard name="Habits" href="/app/habits">
      {!next ? (
        <div className="space-y-2">
          <p className="text-[0.9375rem] font-semibold tracking-tight" style={{ color: "var(--text)" }}>
            Nothing tracked yet.
          </p>
          <p className="text-[0.8125rem] leading-relaxed" style={{ color: "var(--text-muted)" }}>
            Add a habit and the calendar and timer can start supporting it.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <div>
            <p className="text-[0.6875rem] font-medium uppercase tracking-wider" style={{ color: "var(--text-faint)" }}>
              {next.needsSaveToday
                ? "Needs a save"
                : next.completedToday
                  ? "Already hit"
                  : next.keptAliveToday
                    ? "Kept alive"
                    : next.dueToday
                      ? "Still due today"
                      : "Worth keeping warm"}
            </p>
            <p className="mt-0.5 text-[1rem] font-semibold tracking-tight" style={{ color: "var(--text)" }}>
              {next.title}
            </p>
            <p className="mt-0.5 text-[0.75rem]" style={{ color: "var(--text-muted)" }}>
              {next.targetLabel}
              {Math.max(next.currentStreak, next.keptAliveStreak) > 0
                ? ` · 🔥 ${Math.max(next.currentStreak, next.keptAliveStreak)} day streak`
                : ""}
            </p>
          </div>

          {habits.length > 1 ? (
            <ol className="space-y-1.5 pt-2" style={{ borderTop: "1px solid var(--border-faint)" }}>
              {habits.slice(1).map((habit) => (
                <li key={habit.id} className="flex items-baseline justify-between gap-2">
                  <span className="truncate text-[0.8125rem]" style={{ color: "var(--text)" }}>
                    {habit.title}
                  </span>
                  <span className="shrink-0 text-[0.6875rem] tabular" style={{ color: "var(--text-faint)" }}>
                    {Math.max(habit.currentStreak, habit.keptAliveStreak) > 0
                      ? `${Math.max(habit.currentStreak, habit.keptAliveStreak)}d streak`
                      : habit.completedToday
                        ? "done today"
                        : "no streak yet"}
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
