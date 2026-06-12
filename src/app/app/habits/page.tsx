import type { ReactNode } from "react";
import { HABIT_DAY_PARTS, HABIT_DAY_PART_LABELS, type HabitDayPart } from "@/lib/habits";
import { splitLeadingEmoji } from "@/lib/habit-templates";
import { listHabits, type HabitSummary } from "@/lib/services/habits";
import { resolveActiveUserId } from "@/lib/viewer-context";
import { HabitCreateForm } from "./create-form";
import { HabitCard } from "./habit-card";
import { TemplatePicker } from "./_components/template-picker";

export const dynamic = "force-dynamic";

function SectionHeading({ children, count }: { children: ReactNode; count?: number }) {
  return (
    <p
      className="mb-2.5 text-[0.6875rem] font-semibold uppercase tracking-wider"
      style={{ color: "var(--text-faint)" }}
    >
      {children}
      {count !== undefined ? ` · ${count}` : ""}
    </p>
  );
}

export default async function HabitsPage() {
  const userId = await resolveActiveUserId();
  const habits = await listHabits(userId, { includeArchived: true });

  const activeHabits = habits.filter((habit) => !habit.archivedAt);
  const archivedHabits = habits.filter((habit) => habit.archivedAt);

  // Today's board: due habits, pending first (rescue-mode bubbles to the
  // top inside each day-part group via the service's display ordering).
  const dueToday = activeHabits.filter((habit) => habit.dueToday);
  const pendingToday = dueToday.filter((habit) => !habit.completedToday);
  const doneToday = dueToday.filter((habit) => habit.completedToday);
  const notDueToday = activeHabits.filter((habit) => !habit.dueToday);

  const pendingByPart = new Map<HabitDayPart, HabitSummary[]>();
  for (const part of HABIT_DAY_PARTS) pendingByPart.set(part, []);
  for (const habit of pendingToday) {
    const part = (HABIT_DAY_PARTS as readonly string[]).includes(habit.dayPart)
      ? (habit.dayPart as HabitDayPart)
      : "anytime";
    pendingByPart.get(part)!.push(habit);
  }
  const partOrder: HabitDayPart[] = ["morning", "day", "anytime", "evening"];

  const bestStreak = activeHabits.reduce(
    (best, habit) => Math.max(best, habit.currentStreak, habit.keptAliveStreak),
    0,
  );
  const needsSaveCount = activeHabits.filter((habit) => habit.needsSaveToday).length;

  return (
    <div className="space-y-8">
      <header className="fade-in flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p
            className="text-[0.75rem] font-medium uppercase tracking-wider"
            style={{ color: "var(--text-faint)" }}
          >
            Habits
          </p>
          <h1
            className="mt-1 text-[1.5rem] font-bold tracking-tight sm:text-[1.875rem]"
            style={{ color: "var(--text)", letterSpacing: "-0.025em" }}
          >
            {dueToday.length > 0
              ? `${doneToday.length} of ${dueToday.length} today`
              : "Habits"}
          </h1>
        </div>
        <p
          className="text-[0.8125rem] sm:text-right"
          style={{ color: "var(--text-muted)" }}
        >
          {activeHabits.length === 0
            ? "Pick a couple below to get rolling."
            : [
                bestStreak > 0 ? `🔥 best streak ${bestStreak}` : null,
                needsSaveCount > 0
                  ? `${needsSaveCount} need${needsSaveCount === 1 ? "s" : ""} a save`
                  : "nothing slipping",
              ]
                .filter(Boolean)
                .join(" · ")}
        </p>
      </header>

      {/* Empty state IS the template picker. */}
      {activeHabits.length === 0 ? (
        <section className="fade-in-delay-1 space-y-4">
          <TemplatePicker
            existingTitles={habits.map((habit) => habit.title)}
            forceOpen
          />
        </section>
      ) : (
        <>
          {/* Today, grouped by time of day. */}
          <section className="fade-in-delay-1 space-y-5">
            {pendingToday.length === 0 && dueToday.length > 0 ? (
              <div
                className="habit-pop rounded-[1rem] border px-4 py-4 text-center"
                style={{
                  borderColor: "var(--accent-tint-strong)",
                  background: "var(--accent-tint)",
                }}
              >
                <p className="text-[1rem] font-semibold" style={{ color: "var(--text)" }}>
                  ✓ All {dueToday.length} habits done today
                </p>
                <p className="mt-0.5 text-[0.8125rem]" style={{ color: "var(--text-muted)" }}>
                  Nothing left on the board. Nice.
                </p>
              </div>
            ) : null}

            {partOrder.map((part) => {
              const group = pendingByPart.get(part)!;
              if (group.length === 0) return null;
              return (
                <div key={part}>
                  <SectionHeading count={group.length}>
                    {HABIT_DAY_PART_LABELS[part]}
                  </SectionHeading>
                  <ol className="space-y-2.5">
                    {group.map((habit) => (
                      <HabitCard key={habit.id} habit={habit} />
                    ))}
                  </ol>
                </div>
              );
            })}

            {doneToday.length > 0 && pendingToday.length > 0 ? (
              <div>
                <SectionHeading count={doneToday.length}>Done today</SectionHeading>
                <div className="flex flex-wrap gap-1.5">
                  {doneToday.map((habit) => {
                    const { emoji, rest } = splitLeadingEmoji(habit.title);
                    return (
                      <span
                        key={habit.id}
                        className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[0.75rem] font-medium"
                        style={{ background: "var(--bg-tint)", color: "var(--text-muted)" }}
                      >
                        {emoji ? `${emoji} ` : ""}
                        {rest} ✓
                      </span>
                    );
                  })}
                </div>
              </div>
            ) : null}

            {pendingToday.length === 0 && doneToday.length > 0 ? (
              <ol className="space-y-2.5">
                {doneToday.map((habit) => (
                  <HabitCard key={habit.id} habit={habit} />
                ))}
              </ol>
            ) : null}
          </section>

          {/* Not due today (weekly targets met, off-days, custom cadences). */}
          {notDueToday.length > 0 ? (
            <details className="fade-in-delay-2 group">
              <summary
                className="cursor-pointer list-none text-[0.6875rem] font-semibold uppercase tracking-wider"
                style={{ color: "var(--text-faint)" }}
              >
                Not due today · {notDueToday.length}{" "}
                <span className="inline-block transition-transform group-open:rotate-180">v</span>
              </summary>
              <ol className="mt-3 space-y-2.5">
                {notDueToday.map((habit) => (
                  <HabitCard key={habit.id} habit={habit} />
                ))}
              </ol>
            </details>
          ) : null}

          <section className="fade-in-delay-2">
            <TemplatePicker existingTitles={habits.map((habit) => habit.title)} />
          </section>
        </>
      )}

      <HabitCreateForm />

      {archivedHabits.length > 0 ? (
        <details className="group">
          <summary
            className="cursor-pointer list-none text-[0.6875rem] font-semibold uppercase tracking-wider"
            style={{ color: "var(--text-faint)" }}
          >
            Archived · {archivedHabits.length}{" "}
            <span className="inline-block transition-transform group-open:rotate-180">v</span>
          </summary>
          <ol className="mt-3 space-y-2.5">
            {archivedHabits.map((habit) => (
              <HabitCard key={habit.id} habit={habit} />
            ))}
          </ol>
        </details>
      ) : null}
    </div>
  );
}
