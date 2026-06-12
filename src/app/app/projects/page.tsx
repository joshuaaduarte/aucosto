import type { ReactNode } from "react";
import Link from "next/link";
import { resolveActiveUserId } from "@/lib/viewer-context";
import { projectProgress, projectStatusStyle } from "@/lib/projects";
import { formatMinutes } from "@/lib/do";
import { listProjects, type ProjectLinkedTaskSummary, type ProjectSummary } from "@/lib/services/projects";
import { ProjectCreateForm } from "./create-form";
import { ProjectEditForm } from "./edit-form";
import { QuickAddTask } from "./quick-add-task";
import { ArchiveProjectButton } from "./archive-button";
import {
  ProjectScheduleForm,
  ProjectTaskCreateForm,
} from "./project-planning-forms";

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
      style={{ borderColor: "var(--border-soft)", background: "var(--bg-page)" }}
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

function formatDate(value: Date | null) {
  if (!value) return "None";
  return value.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function formatDateTime(value: Date) {
  return value.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function StatusBadge({ status }: { status: ProjectSummary["status"] }) {
  const style = projectStatusStyle(status);
  return (
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
  );
}

function ProgressBar({
  doneCount,
  openCount,
}: {
  doneCount: number;
  openCount: number;
}) {
  const total = doneCount + openCount;
  const pct = projectProgress(doneCount, openCount);
  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between gap-2">
        <p
          className="text-[0.6875rem] font-semibold uppercase tracking-wider"
          style={{ color: "var(--text-faint)" }}
        >
          Progress
        </p>
        <p className="tabular text-[0.75rem]" style={{ color: "var(--text-muted)" }}>
          {total === 0 ? "No tasks yet" : `${doneCount}/${total} · ${pct}%`}
        </p>
      </div>
      <div
        className="h-[6px] overflow-hidden rounded-full"
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
  );
}

function TaskChip({ task }: { task: ProjectLinkedTaskSummary }) {
  return (
    <li
      className="rounded-md border px-3 py-2.5"
      style={{ borderColor: "var(--border-faint)" }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[0.8125rem] font-medium" style={{ color: "var(--text)" }}>
            {task.title}
          </p>
          <p className="mt-1 text-[0.75rem]" style={{ color: "var(--text-faint)" }}>
            {task.estimatedMinutes ? `${formatMinutes(task.estimatedMinutes)} estimate` : "N/A estimate"}
            {task.scheduledMinutes > 0 ? ` · ${formatMinutes(task.scheduledMinutes)} scheduled` : ""}
            {task.trackedMinutes > 0 ? ` · ${formatMinutes(task.trackedMinutes)} tracked` : ""}
          </p>
        </div>
        <span className="pill">{task.status.replace("_", " ")}</span>
      </div>
    </li>
  );
}

function TaskLane({
  label,
  tasks,
  empty,
}: {
  label: string;
  tasks: ProjectLinkedTaskSummary[];
  empty: string;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[0.75rem] font-semibold uppercase tracking-wider" style={{ color: "var(--text-faint)" }}>
          {label}
        </p>
        <span className="text-[0.75rem]" style={{ color: "var(--text-faint)" }}>
          {tasks.length}
        </span>
      </div>
      {tasks.length === 0 ? (
        <p className="text-[0.8125rem]" style={{ color: "var(--text-muted)" }}>
          {empty}
        </p>
      ) : (
        <ol className="space-y-2">
          {tasks.map((task) => (
            <TaskChip key={task.id} task={task} />
          ))}
        </ol>
      )}
    </div>
  );
}

function ProjectCard({
  project,
  todayDateValue,
}: {
  project: ProjectSummary;
  todayDateValue: string;
}) {
  const todayTasks = project.linkedTasks.filter(
    (task) => task.status !== "done" && task.status !== "waiting" && task.lane === "today",
  );
  const nextTasks = project.linkedTasks.filter(
    (task) => task.status !== "done" && task.status !== "waiting" && task.lane !== "today",
  );
  const waitingTasks = project.linkedTasks.filter((task) => task.status === "waiting");
  const doneTasks = project.linkedTasks.filter((task) => task.status === "done").slice(0, 3);
  const schedulableTasks = project.linkedTasks
    .filter((task) => task.status !== "done" && task.status !== "waiting")
    .map((task) => ({
      id: task.id,
      title: task.title,
      estimatedMinutes: task.estimatedMinutes,
    }));

  return (
    <li className="rounded-md border p-4" style={{ borderColor: "var(--border-faint)" }}>
      <div className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Link
                href={`/app/projects/${project.id}`}
                className="text-[0.9375rem] font-medium hover:underline"
                style={{ color: "var(--text)" }}
              >
                {project.name}
              </Link>
              <StatusBadge status={project.status} />
              {project.bucket ? <span className="pill">{project.bucket}</span> : null}
            </div>
            {project.summary ? (
              <p className="mt-1 text-[0.8125rem]" style={{ color: "var(--text-muted)" }}>
                {project.summary}
              </p>
            ) : null}
          </div>
          {project.nextMilestone ? (
            <div
              className="rounded-md border px-3 py-2 text-[0.75rem]"
              style={{ borderColor: "var(--border-faint)", color: "var(--text-muted)" }}
            >
              Next milestone: {project.nextMilestone}
            </div>
          ) : null}
        </div>

        <ProgressBar
          doneCount={project.doneTaskCount}
          openCount={project.openTaskCount}
        />

        <section
          className="grid gap-px overflow-hidden rounded-md border sm:grid-cols-2 xl:grid-cols-4"
          style={{ borderColor: "var(--border-faint)", background: "var(--border-faint)" }}
        >
          <MetricCard
            label="Open"
            value={String(project.openTaskCount)}
            hint={project.todayTaskCount > 0 ? `${project.todayTaskCount} marked for today` : "nothing marked for today"}
          />
          <MetricCard
            label="Scheduled"
            value={formatMinutes(project.scheduledThisWeekMinutes)}
            hint={project.nextScheduledAt ? `next ${formatDateTime(project.nextScheduledAt)}` : "nothing booked yet"}
          />
          <MetricCard
            label="Tracked"
            value={formatMinutes(project.trackedMinutes)}
            hint={project.lastWorkedAt ? `last touched ${formatDate(project.lastWorkedAt)}` : "not worked yet"}
          />
          <MetricCard
            label="Target"
            value={formatDate(project.targetDate)}
            hint={project.targetDate ? "finish line if it matters" : "set one when timing matters"}
          />
        </section>

        <section className="grid gap-3 lg:grid-cols-2">
          <div className="rounded-md border p-3" style={{ borderColor: "var(--border-faint)" }}>
            <p className="text-[0.75rem] font-semibold uppercase tracking-wider" style={{ color: "var(--text-faint)" }}>
              Health
            </p>
            {project.healthFlags.length === 0 ? (
              <p className="mt-2 text-[0.8125rem]" style={{ color: "var(--text-muted)" }}>
                No obvious pressure points right now.
              </p>
            ) : (
              <ul className="mt-2 space-y-2 text-[0.8125rem]">
                {project.healthFlags.map((flag) => (
                  <li key={flag.message} style={{ color: flag.tone === "warning" ? "var(--accent-strong)" : "var(--text-muted)" }}>
                    {flag.message}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="rounded-md border p-3" style={{ borderColor: "var(--border-faint)" }}>
            <p className="text-[0.75rem] font-semibold uppercase tracking-wider" style={{ color: "var(--text-faint)" }}>
              Pressure
            </p>
            <ul className="mt-2 space-y-2 text-[0.8125rem]" style={{ color: "var(--text-muted)" }}>
              <li>{project.readyTaskCount} ready or scheduled to move.</li>
              <li>{project.inProgressTaskCount} actively in motion.</li>
              <li>{project.waitingTaskCount} waiting on something else.</li>
              <li>
                {project.scheduledMinutes > 0
                  ? `${formatMinutes(project.scheduledMinutes)} total protected on the calendar.`
                  : "Calendar still has no linked work for this."}
              </li>
            </ul>
          </div>
        </section>

        <section className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
          <div className="rounded-md border p-3" style={{ borderColor: "var(--border-faint)" }}>
            <div className="flex items-center justify-between gap-2">
              <p className="text-[0.75rem] font-semibold uppercase tracking-wider" style={{ color: "var(--text-faint)" }}>
                Linked work
              </p>
              <QuickAddTask projectId={project.id} />
            </div>
            <div className="mt-3 grid gap-4 lg:grid-cols-2">
              <TaskLane label="Today" tasks={todayTasks} empty="Nothing queued for today." />
              <TaskLane label="Next" tasks={nextTasks} empty="No next task is defined yet." />
              <TaskLane label="Waiting" tasks={waitingTasks} empty="Nothing is blocked right now." />
              <TaskLane label="Done" tasks={doneTasks} empty="No linked task has been closed yet." />
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-md border p-3" style={{ borderColor: "var(--border-faint)" }}>
              <p className="text-[0.75rem] font-semibold uppercase tracking-wider" style={{ color: "var(--text-faint)" }}>
                Schedule lane
              </p>
              {project.upcomingBlocks.length === 0 ? (
                <p className="mt-2 text-[0.8125rem]" style={{ color: "var(--text-muted)" }}>
                  No upcoming blocks tied to this project yet.
                </p>
              ) : (
                <ol className="mt-2 space-y-2">
                  {project.upcomingBlocks.map((block) => (
                    <li
                      key={block.id}
                      className="rounded-md border px-3 py-2.5 text-[0.8125rem]"
                      style={{ borderColor: "var(--border-faint)", color: "var(--text-muted)" }}
                    >
                      <p className="font-medium" style={{ color: "var(--text)" }}>
                        {block.title}
                      </p>
                      <p className="mt-1">{formatDateTime(block.startsAt)} to {block.endsAt.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</p>
                    </li>
                  ))}
                </ol>
              )}
            </div>

            <details className="rounded-md border" style={{ borderColor: "var(--border-faint)" }}>
              <summary className="cursor-pointer list-none px-3 py-2 text-[0.75rem] font-medium" style={{ color: "var(--text-muted)" }}>
                Add the next linked task
              </summary>
              <div className="px-3 pb-3">
                <ProjectTaskCreateForm projectId={project.id} />
              </div>
            </details>

            <details className="rounded-md border" style={{ borderColor: "var(--border-faint)" }}>
              <summary className="cursor-pointer list-none px-3 py-2 text-[0.75rem] font-medium" style={{ color: "var(--text-muted)" }}>
                Schedule project work
              </summary>
              <div className="px-3 pb-3">
                <ProjectScheduleForm
                  projectId={project.id}
                  tasks={schedulableTasks}
                  todayDateValue={todayDateValue}
                />
              </div>
            </details>

            <ProjectEditForm project={project} />

            <div className="flex items-center justify-between gap-2 px-1">
              <Link
                href={`/app/projects/${project.id}`}
                className="text-[0.75rem] font-medium hover:underline"
                style={{ color: "var(--text-muted)" }}
              >
                Open detail →
              </Link>
              <ArchiveProjectButton
                projectId={project.id}
                archived={project.status !== "archived"}
              />
            </div>
          </div>
        </section>
      </div>
    </li>
  );
}

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{ archived?: string }>;
}) {
  const userId = await resolveActiveUserId();
  const params = await searchParams;
  const showArchived = params.archived === "1";
  const projects = await listProjects(userId);
  const todayDateValue = new Date().toISOString().slice(0, 10);

  const archived = projects.filter((project) => project.status === "archived");
  const active = projects.filter(
    (project) => project.status !== "done" && project.status !== "archived",
  );
  const done = projects.filter((project) => project.status === "done");
  const waitingCount = active.filter((project) => project.status === "waiting").length;
  const targetingCount = active.filter((project) => project.targetDate).length;
  const attentionCount = active.filter((project) => project.healthFlags.some((flag) => flag.tone === "warning")).length;
  const activeBuckets = new Set(active.map((project) => project.bucket).filter(Boolean)).size;

  return (
    <div className="space-y-10">
      <header className="fade-in flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[0.75rem] font-medium uppercase tracking-wider" style={{ color: "var(--text-faint)" }}>
            Projects
          </p>
          <h1 className="mt-1 text-[1.5rem] font-bold tracking-tight sm:text-[1.875rem]" style={{ color: "var(--text)", letterSpacing: "-0.025em" }}>
            Projects
          </h1>
        </div>
        <p className="text-[0.8125rem] sm:max-w-[38rem] sm:text-right" style={{ color: "var(--text-muted)" }}>
          {active.length} active
          {activeBuckets > 0 ? ` · ${activeBuckets} bucket${activeBuckets === 1 ? "" : "s"}` : ""}
          {attentionCount > 0 ? ` · ${attentionCount} need attention` : " · planning layer is in good shape"}
        </p>
      </header>

      <section className="fade-in-delay-1 grid gap-px overflow-hidden rounded-md border sm:grid-cols-2 xl:grid-cols-5" style={{ borderColor: "var(--border-faint)", background: "var(--border-faint)" }}>
        <MetricCard label="Active" value={String(active.length)} hint="projects still in motion" />
        <MetricCard label="Waiting" value={String(waitingCount)} hint="blocked or dependent on others" />
        <MetricCard label="Target dates" value={String(targetingCount)} hint="projects with a visible finish line" />
        <MetricCard label="Attention" value={String(attentionCount)} hint="warning signals worth acting on" />
        <MetricCard label="Closed" value={String(done.length)} hint="finished loops worth remembering" />
      </section>

      <section className="grid gap-3 lg:grid-cols-2">
        <SectionCard eyebrow="How it works" title="Projects now sit above execution.">
          <ul className="space-y-2 text-[0.875rem]" style={{ color: "var(--text-muted)" }}>
            <li>Projects define the outcome, milestone, and timing pressure.</li>
            <li>Linked Do List tasks carry the real execution work.</li>
            <li>Calendar blocks show whether the project has protected time.</li>
            <li>Tracked time shows whether the project is actually moving.</li>
          </ul>
        </SectionCard>

        <SectionCard eyebrow="What to watch" title="The page now calls out weak spots.">
          <ul className="space-y-2 text-[0.875rem]" style={{ color: "var(--text-muted)" }}>
            <li>Missing next tasks and missing today tasks.</li>
            <li>Target dates with no scheduled work ahead of them.</li>
            <li>Projects that have gone stale or piled up waiting items.</li>
            <li>How much time is scheduled this week versus tracked overall.</li>
          </ul>
        </SectionCard>
      </section>

      <ProjectCreateForm />

      <SectionCard eyebrow="In motion" title="Current project stack.">
        {active.length === 0 ? (
          <p className="text-[0.875rem]" style={{ color: "var(--text-muted)" }}>
            No projects yet. Create one when the work needs more than a checklist.
          </p>
        ) : (
          <ol className="space-y-4">
            {active.map((project) => (
              <ProjectCard key={project.id} project={project} todayDateValue={todayDateValue} />
            ))}
          </ol>
        )}
      </SectionCard>

      <SectionCard eyebrow="Done" title="Finished project loops.">
        {done.length === 0 ? (
          <p className="text-[0.875rem]" style={{ color: "var(--text-muted)" }}>
            Nothing closed here yet.
          </p>
        ) : (
          <ol className="space-y-4">
            {done.map((project) => (
              <ProjectCard key={project.id} project={project} todayDateValue={todayDateValue} />
            ))}
          </ol>
        )}
      </SectionCard>

      {archived.length > 0 ? (
        <section className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <p
              className="text-[0.75rem] font-semibold uppercase tracking-wider"
              style={{ color: "var(--text-faint)" }}
            >
              Archived · {archived.length}
            </p>
            <Link
              href={showArchived ? "/app/projects" : "/app/projects?archived=1"}
              className="text-[0.8125rem] font-medium hover:underline"
              style={{ color: "var(--text-muted)" }}
            >
              {showArchived ? "Hide archived" : "Show archived"}
            </Link>
          </div>
          {showArchived ? (
            <ol className="space-y-4">
              {archived.map((project) => (
                <ProjectCard
                  key={project.id}
                  project={project}
                  todayDateValue={todayDateValue}
                />
              ))}
            </ol>
          ) : null}
        </section>
      ) : null}
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
      <p className="text-[0.6875rem] font-semibold uppercase tracking-wider" style={{ color: "var(--text-faint)" }}>
        {label}
      </p>
      <p className="mt-1 text-[1.5rem] font-semibold tracking-tight" style={{ color: "var(--text)", letterSpacing: "-0.025em" }}>
        {value}
      </p>
      <p className="mt-0.5 text-[0.75rem]" style={{ color: "var(--text-faint)" }}>
        {hint}
      </p>
    </div>
  );
}
