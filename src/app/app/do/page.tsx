import type { ReactNode } from "react";
import { resolveActiveUserId } from "@/lib/viewer-context";
import {
  DO_BUCKET_SUGGESTIONS,
  DO_LANE_DESCRIPTIONS,
  DO_LANE_LABELS,
  DO_LANES,
  DO_STATUSES,
  DO_STATUS_LABELS,
  formatMinutes,
} from "@/lib/do";
import { listDoItems, type DoItemSummary } from "@/lib/services/do";
import { listProjects } from "@/lib/services/projects";
import {
  completeDoItemAction,
  deleteDoItemAction,
  reopenDoItemAction,
  startDoItemTimerAction,
  updateDoItemAction,
} from "./actions";
import { DoCreateForm } from "./create-form";

export const dynamic = "force-dynamic";

function SectionCard({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section
      className="rounded-md border p-5"
      style={{
        borderColor: "var(--border-soft)",
        background: "var(--bg-page)",
      }}
    >
      <p
        className="text-[0.6875rem] font-semibold uppercase tracking-wider"
        style={{ color: "var(--text-faint)" }}
      >
        {eyebrow}
      </p>
      <h2
        className="mt-1 text-[1rem] font-semibold tracking-tight"
        style={{ color: "var(--text)" }}
      >
        {title}
      </h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function DoItemCard({
  item,
  projects,
}: {
  item: DoItemSummary;
  projects: Array<{ id: string; name: string }>;
}) {
  return (
    <li
      className="rounded-md border p-3 sm:p-3.5"
      style={{ borderColor: "var(--border-faint)" }}
    >
      <div className="flex flex-col gap-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p
                className="text-[0.9375rem] font-medium"
                style={{ color: "var(--text)" }}
              >
                {item.title}
              </p>
              {item.bucket ? <span className="pill">{item.bucket}</span> : null}
              {item.projectName ? <span className="pill">{item.projectName}</span> : null}
              <span className="pill">
                {DO_LANE_LABELS[item.lane as keyof typeof DO_LANE_LABELS] ?? item.lane}
              </span>
              <span className="pill">{DO_STATUS_LABELS[item.status]}</span>
            </div>
            <p
              className="mt-1 text-[0.75rem]"
              style={{ color: "var(--text-faint)" }}
            >
              Est. {formatMinutes(item.estimatedMinutes)}
              {item.scheduledMinutes > 0
                ? ` · Scheduled ${formatMinutes(item.scheduledMinutes)}`
                : ""}
              {item.trackedMinutes > 0
                ? ` · Tracked ${formatMinutes(item.trackedMinutes)}`
                : ""}
              {item.effectiveActualMinutes
                ? ` · Actual ${formatMinutes(item.effectiveActualMinutes)}`
                : ""}
            </p>
            {item.notes ? (
              <p
                className="mt-1.5 whitespace-pre-line text-[0.8125rem]"
                style={{ color: "var(--text-muted)" }}
              >
                {item.notes}
              </p>
            ) : null}
          </div>

          <div className="flex shrink-0 flex-wrap justify-end gap-1.5">
            {item.status !== "done" ? (
              <form action={startDoItemTimerAction}>
                <input type="hidden" name="id" value={item.id} />
                <button className="btn-ghost h-8 px-2.5 text-[0.75rem]" type="submit">
                  Start timer
                </button>
              </form>
            ) : null}

            {item.status !== "done" ? (
              <details className="rounded-md border" style={{ borderColor: "var(--border-faint)" }}>
                <summary
                  className="cursor-pointer list-none px-3 py-2 text-[0.75rem] font-medium"
                  style={{ color: "var(--text-muted)" }}
                >
                  Done
                </summary>
                <form action={completeDoItemAction} className="space-y-3 px-3 pb-3">
                  <input type="hidden" name="id" value={item.id} />
                  <div className="space-y-1.5">
                    <label
                      className="block text-[0.75rem] font-medium"
                      htmlFor={`actual-${item.id}`}
                      style={{ color: "var(--text-muted)" }}
                    >
                      Actual minutes <span style={{ color: "var(--text-faint)" }}>(optional)</span>
                    </label>
                    <input
                      id={`actual-${item.id}`}
                      name="actualMinutes"
                      type="number"
                      min={5}
                      step={5}
                      defaultValue={item.effectiveActualMinutes ?? ""}
                      className="field"
                    />
                  </div>
                  <div className="flex justify-end">
                    <button className="btn-ink" type="submit">
                      Mark done
                    </button>
                  </div>
                </form>
              </details>
            ) : (
              <form action={reopenDoItemAction}>
                <input type="hidden" name="id" value={item.id} />
                <button className="btn-ghost h-8 px-2.5 text-[0.75rem]" type="submit">
                  Reopen
                </button>
              </form>
            )}

            <form action={deleteDoItemAction}>
              <input type="hidden" name="id" value={item.id} />
              <button className="btn-ghost h-8 px-2.5 text-[0.75rem]" type="submit">
                Delete
              </button>
            </form>
          </div>
        </div>

        <details
          className="rounded-md border"
          style={{ borderColor: "var(--border-faint)" }}
        >
          <summary
            className="cursor-pointer list-none px-3 py-2 text-[0.75rem] font-medium"
            style={{ color: "var(--text-muted)" }}
          >
            Edit and learn
          </summary>
          <form action={updateDoItemAction} className="space-y-3 px-3 pb-3">
            <input type="hidden" name="id" value={item.id} />
            <div className="space-y-1.5">
              <label
                className="block text-[0.75rem] font-medium"
                htmlFor={`title-${item.id}`}
                style={{ color: "var(--text-muted)" }}
              >
                Title
              </label>
              <input
                id={`title-${item.id}`}
                name="title"
                defaultValue={item.title}
                required
                className="field"
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-5">
              <div className="space-y-1.5">
                <label
                  className="block text-[0.75rem] font-medium"
                  htmlFor={`lane-${item.id}`}
                  style={{ color: "var(--text-muted)" }}
                >
                  When
                </label>
                <select id={`lane-${item.id}`} name="lane" defaultValue={item.lane} className="field">
                  {DO_LANES.map((lane) => (
                    <option key={lane} value={lane}>
                      {DO_LANE_LABELS[lane]}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <label
                  className="block text-[0.75rem] font-medium"
                  htmlFor={`status-${item.id}`}
                  style={{ color: "var(--text-muted)" }}
                >
                  Status
                </label>
                <select id={`status-${item.id}`} name="status" defaultValue={item.status} className="field">
                  {DO_STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {DO_STATUS_LABELS[status]}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <label
                  className="block text-[0.75rem] font-medium"
                  htmlFor={`estimate-${item.id}`}
                  style={{ color: "var(--text-muted)" }}
                >
                  Estimate
                </label>
                <input
                  id={`estimate-${item.id}`}
                  name="estimatedMinutes"
                  type="number"
                  min={5}
                  step={5}
                  defaultValue={item.estimatedMinutes ?? ""}
                  className="field"
                />
              </div>
              <div className="space-y-1.5">
                <label
                  className="block text-[0.75rem] font-medium"
                  htmlFor={`bucket-${item.id}`}
                  style={{ color: "var(--text-muted)" }}
                >
                  Bucket
                </label>
                <input
                  id={`bucket-${item.id}`}
                  name="bucket"
                  list={`bucket-suggestions-${item.id}`}
                  defaultValue={item.bucket ?? ""}
                  className="field"
                />
                <datalist id={`bucket-suggestions-${item.id}`}>
                  {DO_BUCKET_SUGGESTIONS.map((suggestion) => (
                    <option key={suggestion} value={suggestion} />
                  ))}
                </datalist>
              </div>
              <div className="space-y-1.5">
                <label
                  className="block text-[0.75rem] font-medium"
                  htmlFor={`learned-${item.id}`}
                  style={{ color: "var(--text-muted)" }}
                >
                  Actual
                </label>
                <input
                  id={`learned-${item.id}`}
                  name="actualMinutes"
                  type="number"
                  min={5}
                  step={5}
                  defaultValue={item.actualMinutes ?? ""}
                  className="field"
                />
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label
                  className="block text-[0.75rem] font-medium"
                  htmlFor={`project-${item.id}`}
                  style={{ color: "var(--text-muted)" }}
                >
                  Project
                </label>
                <select
                  id={`project-${item.id}`}
                  name="projectId"
                  defaultValue={item.projectId ?? ""}
                  className="field"
                >
                  <option value="">No project</option>
                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <label
                  className="block text-[0.75rem] font-medium"
                  htmlFor={`notes-${item.id}`}
                  style={{ color: "var(--text-muted)" }}
                >
                  Notes
                </label>
                <input
                  id={`notes-${item.id}`}
                  name="notes"
                  defaultValue={item.notes ?? ""}
                  className="field"
                />
              </div>
              <div className="rounded-md border px-3 py-2.5" style={{ borderColor: "var(--border-faint)" }}>
                <p
                  className="text-[0.6875rem] font-semibold uppercase tracking-wider"
                  style={{ color: "var(--text-faint)" }}
                >
                  Planned vs actual
                </p>
                <p className="mt-1 text-[0.8125rem]" style={{ color: "var(--text-muted)" }}>
                  {item.scheduledCount > 0
                    ? `${item.scheduledCount} block${item.scheduledCount === 1 ? "" : "s"} scheduled`
                    : "Not on calendar yet"}
                </p>
                <p className="mt-1 text-[0.8125rem]" style={{ color: "var(--text-muted)" }}>
                  {item.trackedMinutes > 0
                    ? `${formatMinutes(item.trackedMinutes)} tracked so far`
                    : "Timer has not touched this yet"}
                </p>
              </div>
            </div>

            <div className="flex justify-end">
              <button type="submit" className="btn-ink">
                Save changes
              </button>
            </div>
          </form>
        </details>
      </div>
    </li>
  );
}

export default async function DoPage() {
  const userId = await resolveActiveUserId();
  const [items, projects] = await Promise.all([
    listDoItems(userId, { includeDone: true }),
    listProjects(userId),
  ]);

  const activeItems = items.filter((item) => item.status !== "done");
  const doneItems = items.filter((item) => item.status === "done").slice(0, 8);
  const byLane = Object.fromEntries(
    DO_LANES.map((lane) => [lane, activeItems.filter((item) => item.lane === lane)]),
  ) as Record<(typeof DO_LANES)[number], DoItemSummary[]>;

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
            (item.effectiveActualMinutes! / Math.max(1, item.estimatedMinutes!)) *
              100
          );
        }, 0) / completedWithLearned.length,
      )
    : null;
  const waitingCount = activeItems.filter((item) => item.status === "waiting").length;
  const inProgressCount = activeItems.filter((item) => item.status === "in_progress").length;
  const scheduledCount = activeItems.filter((item) => item.status === "scheduled").length;
  const unscheduledTodayCount = activeItems.filter(
    (item) => item.lane === "today" && item.scheduledMinutes === 0 && item.status !== "waiting",
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
          {activeItems.length} active
          {unscheduledTodayCount > 0
            ? ` · ${unscheduledTodayCount} unscheduled today`
            : " · today is covered"}
          {activeProjectCount > 0 ? ` · ${activeProjectCount} linked project${activeProjectCount === 1 ? "" : "s"}` : ""}
        </p>
      </header>

      <section
        className="fade-in-delay-1 grid gap-px overflow-hidden rounded-md border sm:grid-cols-2 xl:grid-cols-5"
        style={{
          borderColor: "var(--border-faint)",
          background: "var(--border-faint)",
        }}
      >
        <MetricCard label="Open" value={String(activeItems.length)} hint="tasks still in motion" />
        <MetricCard label="Estimated" value={formatMinutes(estimatedOpenMinutes)} hint="remaining if estimates hold" />
        <MetricCard label="Scheduled" value={formatMinutes(scheduledOpenMinutes)} hint="time already protected" />
        <MetricCard label="Tracked" value={formatMinutes(trackedOpenMinutes)} hint="time already spent" />
        <MetricCard
          label="Learning"
          value={averageAccuracy ? `${averageAccuracy}%` : "Waiting"}
          hint={averageAccuracy ? "actual vs estimate on recent completions" : "complete a few tasks to calibrate"}
        />
      </section>

      <section className="grid gap-3 lg:grid-cols-2">
        <SectionCard eyebrow="Attention" title="Where the loop still needs help.">
          <ul className="space-y-2 text-[0.875rem]" style={{ color: "var(--text-muted)" }}>
            <li>
              {unscheduledTodayCount > 0
                ? `${unscheduledTodayCount} Today task${unscheduledTodayCount === 1 ? "" : "s"} still need calendar time.`
                : "Today tasks are either scheduled, done, or intentionally waiting."}
            </li>
            <li>
              {overEstimateCount > 0
                ? `${overEstimateCount} active task${overEstimateCount === 1 ? "" : "s"} have already run past their estimate.`
                : "No active tasks have blown past their estimate yet."}
            </li>
          </ul>
        </SectionCard>

        <SectionCard eyebrow="States" title="What the work is actually doing.">
          <ul className="space-y-2 text-[0.875rem]" style={{ color: "var(--text-muted)" }}>
            <li>{inProgressCount} in progress right now or recently resumed.</li>
            <li>{scheduledCount} already scheduled before they are done.</li>
            <li>{waitingCount} waiting on someone or something else.</li>
          </ul>
        </SectionCard>
      </section>

      <DoCreateForm projects={projects.map((project) => ({ id: project.id, name: project.name }))} />

      <section className="grid gap-6 lg:grid-cols-2">
        {DO_LANES.map((lane) => (
          <SectionCard
            key={lane}
            eyebrow={DO_LANE_LABELS[lane]}
            title={DO_LANE_DESCRIPTIONS[lane]}
          >
            {byLane[lane].length === 0 ? (
              <p className="text-[0.875rem]" style={{ color: "var(--text-muted)" }}>
                Nothing here yet.
              </p>
            ) : (
              <ol className="space-y-3">
                {byLane[lane].map((item) => (
                  <DoItemCard key={item.id} item={item} projects={projects} />
                ))}
              </ol>
            )}
          </SectionCard>
        ))}
      </section>

      <SectionCard eyebrow="Done" title="Recently closed loops.">
        {doneItems.length === 0 ? (
          <p className="text-[0.875rem]" style={{ color: "var(--text-muted)" }}>
            Nothing completed yet.
          </p>
        ) : (
          <ol className="space-y-3">
            {doneItems.map((item) => (
              <DoItemCard key={item.id} item={item} projects={projects} />
            ))}
          </ol>
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
      <p className="mt-0.5 text-[0.75rem]" style={{ color: "var(--text-faint)" }}>
        {hint}
      </p>
    </div>
  );
}
