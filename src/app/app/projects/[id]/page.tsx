import Link from "next/link";
import { notFound } from "next/navigation";
import { resolveActiveUserId } from "@/lib/viewer-context";
import { projectProgress, projectStatusStyle } from "@/lib/projects";
import { formatMinutes } from "@/lib/do";
import {
  getProjectDetail,
  type ProjectLinkedTaskSummary,
  type ProjectTimeEntry,
} from "@/lib/services/projects";
import { QuickAddTask } from "../quick-add-task";
import { ArchiveProjectButton } from "../archive-button";

export const dynamic = "force-dynamic";

function formatDate(value: Date | null) {
  if (!value) return "—";
  return value.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function formatDateTime(value: Date) {
  return value.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function TaskRow({ task }: { task: ProjectLinkedTaskSummary }) {
  const done = task.status === "done";
  return (
    <li
      className="flex items-start justify-between gap-3 rounded-md border px-3 py-2.5"
      style={{ borderColor: "var(--border-faint)" }}
    >
      <div className="min-w-0">
        <p
          className="text-[0.8125rem] font-medium"
          style={{
            color: done ? "var(--text-faint)" : "var(--text)",
            textDecoration: done ? "line-through" : undefined,
          }}
        >
          {task.title}
        </p>
        <p className="mt-0.5 text-[0.75rem]" style={{ color: "var(--text-faint)" }}>
          {task.lane}
          {task.estimatedMinutes ? ` · ${formatMinutes(task.estimatedMinutes)} est` : ""}
          {task.trackedMinutes > 0 ? ` · ${formatMinutes(task.trackedMinutes)} tracked` : ""}
        </p>
      </div>
      <span className="pill shrink-0">{task.status.replace("_", " ")}</span>
    </li>
  );
}

function TimeEntryRow({ entry }: { entry: ProjectTimeEntry }) {
  return (
    <li
      className="flex items-baseline justify-between gap-3 border-t py-2 text-[0.8125rem]"
      style={{ borderColor: "var(--border-faint)" }}
    >
      <div className="min-w-0">
        <p className="truncate" style={{ color: "var(--text)" }}>
          {entry.label}
        </p>
        <p className="mt-0.5 text-[0.75rem]" style={{ color: "var(--text-faint)" }}>
          {entry.taskTitle ? `${entry.taskTitle} · ` : ""}
          {formatDateTime(entry.startedAt)}
          {!entry.endedAt ? " · running" : ""}
        </p>
      </div>
      <span
        className="shrink-0 tabular font-mono text-[0.75rem]"
        style={{ color: entry.endedAt ? "var(--text-muted)" : "var(--accent-strong)" }}
      >
        {entry.endedAt ? formatMinutes(entry.minutes) : "—"}
      </span>
    </li>
  );
}

function Metric({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="px-4 py-4" style={{ background: "var(--bg-page)" }}>
      <p
        className="text-[0.6875rem] font-semibold uppercase tracking-wider"
        style={{ color: "var(--text-faint)" }}
      >
        {label}
      </p>
      <p
        className="mt-1 text-[1.375rem] font-semibold tracking-tight"
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

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const userId = await resolveActiveUserId();
  const detail = await getProjectDetail(userId, id);
  if (!detail) notFound();

  const { project, timeEntries } = detail;
  const style = projectStatusStyle(project.status);
  const total = project.openTaskCount + project.doneTaskCount;
  const pct = projectProgress(project.doneTaskCount, project.openTaskCount);
  const openTasks = project.linkedTasks.filter((task) => task.status !== "done");
  const doneTasks = project.linkedTasks.filter((task) => task.status === "done");

  return (
    <div className="space-y-7">
      <div className="fade-in space-y-4">
        <Link
          href="/app/projects"
          className="inline-flex items-center gap-1 text-[0.8125rem] font-medium hover:underline"
          style={{ color: "var(--text-muted)" }}
        >
          ← All projects
        </Link>

        <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1
                className="text-[1.5rem] font-bold tracking-tight sm:text-[1.875rem]"
                style={{ color: "var(--text)", letterSpacing: "-0.025em" }}
              >
                {project.name}
              </h1>
              <span
                className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[0.6875rem] font-semibold uppercase tracking-wider"
                style={{ background: style.bg, color: style.color }}
              >
                <span
                  className="inline-block h-1.5 w-1.5 rounded-full"
                  style={{ background: style.color }}
                />
                {style.label}
              </span>
              {project.bucket ? <span className="pill">{project.bucket}</span> : null}
            </div>
            {project.summary ? (
              <p className="mt-2 text-[0.875rem]" style={{ color: "var(--text-muted)" }}>
                {project.summary}
              </p>
            ) : null}
          </div>
          <ArchiveProjectButton
            projectId={project.id}
            archived={project.status !== "archived"}
          />
        </header>

        <div className="space-y-1.5">
          <div className="flex items-baseline justify-between gap-2">
            <p
              className="text-[0.6875rem] font-semibold uppercase tracking-wider"
              style={{ color: "var(--text-faint)" }}
            >
              Progress
            </p>
            <p className="tabular text-[0.8125rem]" style={{ color: "var(--text-muted)" }}>
              {total === 0 ? "No tasks yet" : `${project.doneTaskCount}/${total} · ${pct}%`}
            </p>
          </div>
          <div
            className="h-[8px] overflow-hidden rounded-full"
            style={{ background: "var(--bg-tint-strong)" }}
          >
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${Math.max(total === 0 ? 0 : 3, pct)}%`,
                background: pct === 100 ? "#3b82f6" : "var(--accent)",
              }}
            />
          </div>
        </div>
      </div>

      <section
        className="fade-in-delay-1 grid gap-px overflow-hidden rounded-md border sm:grid-cols-2 xl:grid-cols-4"
        style={{ borderColor: "var(--border-faint)", background: "var(--border-faint)" }}
      >
        <Metric label="Open" value={String(project.openTaskCount)} hint={`${project.doneTaskCount} done`} />
        <Metric label="Tracked" value={formatMinutes(project.trackedMinutes)} hint={project.lastWorkedAt ? `last ${formatDate(project.lastWorkedAt)}` : "not worked yet"} />
        <Metric label="Scheduled" value={formatMinutes(project.scheduledThisWeekMinutes)} hint={project.nextScheduledAt ? `next ${formatDate(project.nextScheduledAt)}` : "nothing booked"} />
        <Metric label="Target" value={formatDate(project.targetDate)} hint={project.targetDate ? "finish line" : "none set"} />
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
        <div
          className="rounded-md border p-4"
          style={{ borderColor: "var(--border-faint)", background: "var(--bg-page)" }}
        >
          <div className="flex items-center justify-between gap-2">
            <p
              className="text-[0.75rem] font-semibold uppercase tracking-wider"
              style={{ color: "var(--text-faint)" }}
            >
              Tasks
            </p>
            <QuickAddTask projectId={project.id} />
          </div>
          {project.linkedTasks.length === 0 ? (
            <p className="mt-3 text-[0.8125rem]" style={{ color: "var(--text-muted)" }}>
              No linked tasks yet. Add one above to start moving.
            </p>
          ) : (
            <div className="mt-3 space-y-4">
              {openTasks.length > 0 ? (
                <ol className="space-y-2">
                  {openTasks.map((task) => (
                    <TaskRow key={task.id} task={task} />
                  ))}
                </ol>
              ) : null}
              {doneTasks.length > 0 ? (
                <details>
                  <summary
                    className="cursor-pointer list-none text-[0.75rem] font-medium"
                    style={{ color: "var(--text-faint)" }}
                  >
                    {doneTasks.length} completed
                  </summary>
                  <ol className="mt-2 space-y-2">
                    {doneTasks.map((task) => (
                      <TaskRow key={task.id} task={task} />
                    ))}
                  </ol>
                </details>
              ) : null}
            </div>
          )}
        </div>

        <div
          className="rounded-md border p-4"
          style={{ borderColor: "var(--border-faint)", background: "var(--bg-page)" }}
        >
          <p
            className="text-[0.75rem] font-semibold uppercase tracking-wider"
            style={{ color: "var(--text-faint)" }}
          >
            Linked time entries
          </p>
          {timeEntries.length === 0 ? (
            <p className="mt-3 text-[0.8125rem]" style={{ color: "var(--text-muted)" }}>
              No time has been tracked against this project&apos;s tasks yet.
            </p>
          ) : (
            <ul className="mt-1">
              {timeEntries.map((entry) => (
                <TimeEntryRow key={entry.id} entry={entry} />
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}
