import type { ReactNode } from "react";
import {
  HABIT_DAY_PARTS,
  HABIT_DAY_PART_LABELS,
  freshStartLabel,
  suggestFocusHabits,
  type HabitDayPart,
} from "@/lib/habits";
import { habitPreferencesReady, listHabits, type HabitSummary } from "@/lib/services/habits";
import { resolveActiveUserId } from "@/lib/viewer-context";
import { HabitCreateForm } from "./create-form";
import { PageAddButton } from "../_components/page-add-button";
import { DoneHabitChip, HabitCard } from "./habit-card";
import { TemplatePicker } from "./_components/template-picker";
import { FocusPicker } from "./_components/focus-picker";

/** More active habits than this and none marked → offer the focus picker. */
const FOCUS_PICKER_THRESHOLD = 5;

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

function currentTime() {
  return new Date();
}

export default async function HabitsPage() {
  const userId = await resolveActiveUserId();
  const [habits, prefsReady] = await Promise.all([
    listHabits(userId, { includeArchived: true }),
    habitPreferencesReady(userId),
  ]);

  const allActive = habits.filter((habit) => !habit.archivedAt);
  const archivedHabits = habits.filter((habit) => habit.archivedAt);
  // "Later" habits stay listed but collapsed, off today's board.
  const laterHabits = allActive.filter((habit) => habit.focus === "later");
  const activeHabits = allActive.filter((habit) => habit.focus !== "later");
  const anyMarked = allActive.some((habit) => habit.focus !== null);
  const showFocusPicker = prefsReady && !anyMarked && allActive.length >= FOCUS_PICKER_THRESHOLD;
  const pickerHabits = allActive.map(({ id, title, strength }) => ({ id, title, strength }));
  const focusIds = allActive.filter((habit) => habit.focus === "focus").map((habit) => habit.id);
  // Server components can't call new Date() in the body directly (purity
  // lint), but the page is force-dynamic so a module helper is fine.
  const freshStart = freshStartLabel(currentTime());

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
        <div className="flex items-end justify-between gap-3">
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
        <PageAddButton target="habit" label="New habit" />
        </div>
        <p
          className="text-[0.8125rem] sm:text-right"
          style={{ color: "var(--text-muted)" }}
        >
          {allActive.length === 0
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

      {showFocusPicker ? (
        <section className="fade-in-delay-1">
          <FocusPicker habits={pickerHabits} suggested={suggestFocusHabits(allActive)} />
        </section>
      ) : freshStart && activeHabits.length > 0 ? (
        <p
          className="fade-in-delay-1 rounded-[0.9rem] px-4 py-3 text-[0.8125rem]"
          style={{ background: "var(--bg-tint)", color: "var(--text-muted)" }}
        >
          <span className="font-semibold" style={{ color: "var(--text)" }}>
            {freshStart}
          </span>{" "}
          Strength carries over; streaks are only part of the story.
        </p>
      ) : null}

      {/* Empty state IS the template picker. */}
      {allActive.length === 0 ? (
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
                  {doneToday.map((habit) => (
                    <DoneHabitChip key={habit.id} habit={habit} />
                  ))}
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

          {laterHabits.length > 0 ? (
            <details className="fade-in-delay-2 group">
              <summary
                className="cursor-pointer list-none text-[0.6875rem] font-semibold uppercase tracking-wider"
                style={{ color: "var(--text-faint)" }}
              >
                Later · {laterHabits.length}{" "}
                <span className="inline-block transition-transform group-open:rotate-180">v</span>
              </summary>
              <p className="mt-2 text-[0.75rem]" style={{ color: "var(--text-faint)" }}>
                Parked while you focus on the others. Still loggable; left out of the evening
                check-in.
              </p>
              <ol className="mt-3 space-y-2.5">
                {laterHabits.map((habit) => (
                  <HabitCard key={habit.id} habit={habit} />
                ))}
              </ol>
              <div className="mt-3">
                <FocusPicker
                  habits={pickerHabits}
                  suggested={focusIds}
                  title="Change which habits you focus on"
                  defaultOpen={false}
                />
              </div>
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
