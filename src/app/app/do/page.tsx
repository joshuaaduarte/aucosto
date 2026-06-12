import type { ReactNode } from "react";
import { resolveActiveUserId } from "@/lib/viewer-context";
import {
  DO_LANE_DESCRIPTIONS,
  DO_LANE_LABELS,
  DO_LANES,
  formatMinutes,
} from "@/lib/do";
import { listDoItems, type DoItemSummary } from "@/lib/services/do";
import {
  listHabitTaskItems,
  type HabitTaskSummary,
} from "@/lib/services/habits";
import { listProjects } from "@/lib/services/projects";
import { DoCreateForm } from "./create-form";
import { DoItemCard } from "./do-item-card";
import { HabitTaskCard } from "./habit-task-card";

export const dynamic = "force-dynamic";

function SectionCard({
  eyebrow,
  title,
  children,
  collapsed = false,
  count,
}: {
  eyebrow: string;
  title: string;
  children: ReactNode;
  /** Render as a closed <details> — used for low-priority lanes so the
      page stays scannable, especially on phones. */
  collapsed?: boolean;
  count?: number;
}) {
  const header = (
    <>
      <p
        className="text-[0.6875rem] font-semibold uppercase tracking-wider"
        style={{ color: "var(--text-faint)" }}
      >
        {eyebrow}
        {count !== undefined ? ` · ${count}` : ""}
      </p>
      <h2
        className="mt-1 text-[1rem] font-semibold tracking-tight"
        style={{ color: "var(--text)" }}
      >
        {title}
      </h2>
    </>
  );

  if (collapsed) {
    return (
      <details
        className="group rounded-md border p-5"
        style={{
          borderColor: "var(--border-soft)",
          background: "var(--bg-page)",
        }}
      >
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
          <div>{header}</div>
          <span
            className="text-[0.75rem] transition-transform group-open:rotate-180"
            style={{ color: "var(--text-faint)" }}
            aria-hidden
          >
            v
          </span>
        </summary>
        <div className="mt-4">{children}</div>
      </details>
    );
  }

  return (
    <section
      className="rounded-md border p-5"
      style={{
        borderColor: "var(--border-soft)",
        background: "var(--bg-page)",
      }}
    >
      {header}
      <div className="mt-4">{children}</div>
    </section>
  );
}

function OverflowList<T>({
  items,
  renderItem,
  initialCount = 4,
}: {
  items: T[];
  renderItem: (item: T) => ReactNode;
  initialCount?: number;
}) {
  const visible = items.slice(0, initialCount);
  const overflow = items.slice(initialCount);

  return (
    <div className="space-y-3">
      <ol className="space-y-3">{visible.map(renderItem)}</ol>
      {overflow.length > 0 ? (
        <details
          className="rounded-md border px-3 py-2.5"
          style={{ borderColor: "var(--border-faint)" }}
        >
          <summary
            className="cursor-pointer list-none text-[0.75rem] font-medium"
            style={{ color: "var(--text-muted)" }}
          >
            Show {overflow.length} more
          </summary>
          <ol className="mt-3 space-y-3">{overflow.map(renderItem)}</ol>
        </details>
      ) : null}
    </div>
  );
}

export default async function DoPage() {
  const userId = await resolveActiveUserId();
  const [items, habitTasks, projects] = await Promise.all([
    listDoItems(userId, { includeDone: true }),
    listHabitTaskItems(userId),
    listProjects(userId),
  ]);

  const activeItems = items.filter((item) => item.status !== "done");
  const doneItems = items.filter((item) => item.status === "done");
  const activeFeedCount = activeItems.length + habitTasks.length;
  const byLane = Object.fromEntries(
    DO_LANES.map((lane) => [
      lane,
      {
        tasks: activeItems.filter((item) => item.lane === lane),
        habits: habitTasks.filter((habit) => habit.taskLane === lane),
      },
    ]),
  ) as Record<
    (typeof DO_LANES)[number],
    { tasks: DoItemSummary[]; habits: HabitTaskSummary[] }
  >;

  const estimatedOpenMinutes = activeItems.reduce(
    (total, item) => total + (item.estimatedMinutes ?? 0),
    0,
  );
  const scheduledOpenMinutes = activeItems.reduce(
    (total, item) => total + item.scheduledMinutes,
    0,
  );
  const trackedOpenMinutes = activeItems.reduce(
    (total, item) => total + item.trackedMinutes,
    0,
  );
  const completedWithLearned = doneItems.filter(
    (item) => item.effectiveActualMinutes && item.estimatedMinutes,
  );
  const averageAccuracy = completedWithLearned.length
    ? Math.round(
        completedWithLearned.reduce((total, item) => {
          return (
            total +
            (item.effectiveActualMinutes! /
              Math.max(1, item.estimatedMinutes!)) *
              100
          );
        }, 0) / completedWithLearned.length,
      )
    : null;
  const waitingCount = activeItems.filter(
    (item) => item.status === "waiting",
  ).length;
  const inProgressCount = activeItems.filter(
    (item) => item.status === "in_progress",
  ).length;
  const scheduledCount = activeItems.filter(
    (item) => item.status === "scheduled",
  ).length;
  const unscheduledTodayCount = activeItems.filter(
    (item) =>
      item.lane === "today" &&
      item.scheduledMinutes === 0 &&
      item.status !== "waiting",
  ).length;
  const overEstimateCount = activeItems.filter(
    (item) =>
      item.estimatedMinutes !== null &&
      item.estimatedMinutes !== undefined &&
      item.trackedMinutes > item.estimatedMinutes,
  ).length;
  const activeProjectCount = new Set(
    activeItems.map((item) => item.projectId).filter(Boolean),
  ).size;

  return (
    <div className="space-y-10">
      <header className="fade-in flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p
            className="text-[0.75rem] font-medium uppercase tracking-wider"
            style={{ color: "var(--text-faint)" }}
          >
            Do List
          </p>
          <h1
            className="mt-1 text-[1.5rem] font-bold tracking-tight sm:text-[1.875rem]"
            style={{ color: "var(--text)", letterSpacing: "-0.025em" }}
          >
            Do List
          </h1>
        </div>
        <p
          className="text-[0.8125rem] sm:max-w-[38rem] sm:text-right"
          style={{ color: "var(--text-muted)" }}
        >
          {activeFeedCount} active
          {unscheduledTodayCount > 0
            ? ` · ${unscheduledTodayCount} unscheduled today`
            : " · today is covered"}
          {habitTasks.length > 0
            ? ` · ${habitTasks.length} recurring habit task${
                habitTasks.length === 1 ? "" : "s"
              } in the flow`
            : ""}
          {activeProjectCount > 0
            ? ` · ${activeProjectCount} linked project${
                activeProjectCount === 1 ? "" : "s"
              }`
            : ""}
        </p>
      </header>

      <section
        className="fade-in-delay-1 grid gap-px overflow-hidden rounded-md border sm:grid-cols-2 xl:grid-cols-3"
        style={{
          borderColor: "var(--border-faint)",
          background: "var(--border-faint)",
        }}
      >
        <MetricCard
          label="Open"
          value={String(activeItems.length)}
          hint="one-off tasks still in motion"
        />
        <MetricCard
          label="Recurring"
          value={String(habitTasks.length)}
          hint="habit tasks showing up right now"
        />
        <MetricCard
          label="Estimated"
          value={formatMinutes(estimatedOpenMinutes)}
          hint="remaining if estimates hold"
        />
        <MetricCard
          label="Scheduled"
          value={formatMinutes(scheduledOpenMinutes)}
          hint="time already protected"
        />
        <MetricCard
          label="Tracked"
          value={formatMinutes(trackedOpenMinutes)}
          hint="time already spent"
        />
        <MetricCard
          label="Learning"
          value={averageAccuracy ? `${averageAccuracy}%` : "Waiting"}
          hint={
            averageAccuracy
              ? "actual vs estimate on recent completions"
              : "complete a few tasks to calibrate"
          }
        />
      </section>

      <section className="grid gap-3 lg:grid-cols-2">
        <SectionCard eyebrow="Attention" title="Where the loop still needs help.">
          <ul
            className="space-y-2 text-[0.875rem]"
            style={{ color: "var(--text-muted)" }}
          >
            <li>
              {unscheduledTodayCount > 0
                ? `${unscheduledTodayCount} Today task${
                    unscheduledTodayCount === 1 ? "" : "s"
                  } still need calendar time.`
                : "Today tasks are either scheduled, done, or intentionally waiting."}
            </li>
            <li>
              {habitTasks.length > 0
                ? `${habitTasks.length} recurring habit task${
                    habitTasks.length === 1 ? "" : "s"
                  } are now flowing through Do List too.`
                : "No recurring habits are landing in the task flow right now."}
            </li>
            <li>
              {overEstimateCount > 0
                ? `${overEstimateCount} active task${
                    overEstimateCount === 1 ? "" : "s"
                  } have already run past their estimate.`
                : "No active tasks have blown past their estimate yet."}
            </li>
          </ul>
        </SectionCard>

        <SectionCard eyebrow="States" title="What the work is actually doing.">
          <ul
            className="space-y-2 text-[0.875rem]"
            style={{ color: "var(--text-muted)" }}
          >
            <li>{inProgressCount} in progress right now or recently resumed.</li>
            <li>{scheduledCount} already scheduled before they are done.</li>
            <li>{waitingCount} waiting on someone or something else.</li>
          </ul>
        </SectionCard>
      </section>

      <DoCreateForm
        projects={projects.map((project) => ({ id: project.id, name: project.name }))}
      />

      <section className="grid gap-6 lg:grid-cols-2">
        {DO_LANES.map((lane) => (
          <SectionCard
            key={lane}
            eyebrow={DO_LANE_LABELS[lane]}
            title={DO_LANE_DESCRIPTIONS[lane]}
            collapsed={lane === "later" || lane === "someday"}
            count={byLane[lane].tasks.length + byLane[lane].habits.length}
          >
            {byLane[lane].tasks.length === 0 && byLane[lane].habits.length === 0 ? (
              <p
                className="text-[0.875rem]"
                style={{ color: "var(--text-muted)" }}
              >
                Nothing here yet.
              </p>
            ) : (
              <div className="space-y-4">
                {byLane[lane].habits.length > 0 ? (
                  <div className="space-y-3">
                    <p
                      className="text-[0.6875rem] font-semibold uppercase tracking-wider"
                      style={{ color: "var(--text-faint)" }}
                    >
                      Recurring habit tasks
                    </p>
                    <OverflowList
                      items={byLane[lane].habits}
                      renderItem={(habit) => (
                        <HabitTaskCard key={habit.id} habit={habit} />
                      )}
                    />
                  </div>
                ) : null}

                {byLane[lane].tasks.length > 0 ? (
                  <div className="space-y-3">
                    <p
                      className="text-[0.6875rem] font-semibold uppercase tracking-wider"
                      style={{ color: "var(--text-faint)" }}
                    >
                      One-off tasks
                    </p>
                    <OverflowList
                      items={byLane[lane].tasks}
                      renderItem={(item) => (
                        <DoItemCard key={item.id} item={item} projects={projects} />
                      )}
                    />
                  </div>
                ) : null}
              </div>
            )}
          </SectionCard>
        ))}
      </section>

      <SectionCard
        eyebrow="Done"
        title="Recently closed loops."
        collapsed
        count={doneItems.length}
      >
        {doneItems.length === 0 ? (
          <p className="text-[0.875rem]" style={{ color: "var(--text-muted)" }}>
            Nothing completed yet.
          </p>
        ) : (
          <OverflowList
            items={doneItems}
            renderItem={(item) => (
              <DoItemCard key={item.id} item={item} projects={projects} />
            )}
          />
        )}
      </SectionCard>
    </div>
  );
}

function MetricCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="px-4 py-4" style={{ background: "var(--bg-page)" }}>
      <p
        className="text-[0.6875rem] font-semibold uppercase tracking-wider"
        style={{ color: "var(--text-faint)" }}
      >
        {label}
      </p>
      <p
        className="mt-1 text-[1.5rem] font-semibold tracking-tight"
        style={{ color: "var(--text)", letterSpacing: "-0.025em" }}
      >
        {value}
      </p>
      <p
        className="mt-0.5 text-[0.75rem]"
        style={{ color: "var(--text-faint)" }}
      >
        {hint}
      </p>
    </div>
  );
}
