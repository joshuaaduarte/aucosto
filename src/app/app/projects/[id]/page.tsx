import Link from "next/link";
import { notFound } from "next/navigation";
import { resolveActiveUserId } from "@/lib/viewer-context";
import { boardStatusMeta, energyTypeMeta, formatBudgetMinutes } from "@/lib/projects";
import {
  ensureProjectBoardTables,
  getBoardProject,
  listAreas,
} from "@/lib/services/projects";
import { AreaBadge } from "../_components/area-badge";
import { MomentumBadge } from "../_components/momentum-badge";
import { HealthPanel } from "../_components/health-panel";
import { TaskList } from "../_components/task-list";
import { EditProjectSheet, type ProjectEditView } from "../_components/edit-project-sheet";
import { StartProjectTimerButton } from "../_components/start-project-timer-button";
import type { ProjectTimeRow } from "@/lib/services/projects";

export const dynamic = "force-dynamic";

function targetCountdown(days: number | null): string | null {
  if (days === null) return null;
  if (days < 0) {
    const abs = Math.abs(days);
    return `${abs} day${abs === 1 ? "" : "s"} overdue`;
  }
  if (days === 0) return "Due today";
  if (days === 1) return "1 day left";
  return `${days} days left`;
}

function formatEntryTime(start: Date, end: Date | null): string {
  const date = start.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  const time = start.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  if (!end) return `${date} · ${time} · running`;
  return `${date} · ${time}`;
}

function TimeRow({ entry }: { entry: ProjectTimeRow }) {
  return (
    <li className="flex items-baseline justify-between gap-3 border-t py-2 text-[0.8125rem]" style={{ borderColor: "var(--border-faint)" }}>
      <div className="min-w-0">
        <p className="truncate" style={{ color: "var(--text)" }}>
          {entry.label}
        </p>
        <p className="mt-0.5 text-[0.75rem]" style={{ color: "var(--text-faint)" }}>
          {formatEntryTime(entry.startedAt, entry.endedAt)}
          {entry.notes ? ` · ${entry.notes.slice(0, 60)}` : ""}
        </p>
      </div>
      <span
        className="shrink-0 tabular font-mono text-[0.75rem]"
        style={{ color: entry.endedAt ? "var(--text-muted)" : "var(--accent-strong)" }}
      >
        {entry.endedAt ? formatBudgetMinutes(entry.minutes) : "•"}
      </span>
    </li>
  );
}

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await ensureProjectBoardTables();
  const { id } = await params;
  const userId = await resolveActiveUserId();
  const now = new Date();

  const [detail, areas] = await Promise.all([
    getBoardProject(userId, id),
    listAreas(userId),
  ]);
  if (!detail) notFound();

  const { project, tasks, timeEntries, health } = detail;
  const status = boardStatusMeta(project.status);
  const energy = energyTypeMeta(project.energyType);
  const countdown = targetCountdown(project.daysUntilTarget);
  const running = timeEntries.length > 0 && timeEntries[0]?.endedAt === null;

  const editView: ProjectEditView = {
    id: project.id,
    name: project.name,
    intent: project.intent,
    areaId: project.area?.id ?? null,
    status: project.status,
    energyType: project.energyType,
    timeBudgetHours: project.timeBudgetMinutes ? String(project.timeBudgetMinutes / 60) : "",
    targetDateValue: project.targetDate ? project.targetDate.toLocaleDateString("en-CA") : "",
  };

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
                className="inline-flex items-center rounded-full px-2 py-0.5 text-[0.625rem] font-semibold uppercase tracking-wider"
                style={{ background: status.bg, color: status.color }}
              >
                {status.label}
              </span>
              <MomentumBadge momentum={project.momentum} />
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[0.8125rem]" style={{ color: "var(--text-muted)" }}>
              {project.area ? <AreaBadge area={project.area} /> : null}
              <span className="inline-flex items-center gap-1.5">
                <span aria-hidden>{energy.emoji}</span>
                {energy.label}
              </span>
              {countdown ? (
                <span
                  className="font-medium"
                  style={{ color: project.daysUntilTarget !== null && project.daysUntilTarget <= 7 ? "var(--accent-strong)" : "var(--text-muted)" }}
                >
                  {countdown}
                </span>
              ) : null}
              <span>
                {project.openTaskCount} open · {project.doneTaskCount} done
              </span>
            </div>
            {project.intent ? (
              <p className="mt-2 text-[0.875rem] italic" style={{ color: "var(--text-muted)" }}>
                “{project.intent}”
              </p>
            ) : null}
          </div>
          <EditProjectSheet project={editView} areas={areas} />
        </header>
      </div>

      <div className="fade-in-delay-1">
        <HealthPanel health={health} now={now} />
      </div>

      <section className="fade-in-delay-2 grid gap-5 lg:grid-cols-[1.2fr_1fr]">
        <div
          className="rounded-lg border p-4"
          style={{ borderColor: "var(--border-soft)", background: "var(--bg-page)" }}
        >
          <p className="text-[0.6875rem] font-semibold uppercase tracking-wider" style={{ color: "var(--text-faint)" }}>
            Tasks
          </p>
          <div className="mt-3">
            <TaskList projectId={project.id} tasks={tasks} />
          </div>
        </div>

        <div
          className="rounded-lg border p-4"
          style={{ borderColor: "var(--border-soft)", background: "var(--bg-page)" }}
        >
          <div className="flex items-center justify-between gap-2">
            <p className="text-[0.6875rem] font-semibold uppercase tracking-wider" style={{ color: "var(--text-faint)" }}>
              Time
            </p>
            <StartProjectTimerButton projectId={project.id} running={running} />
          </div>
          {timeEntries.length === 0 ? (
            <p className="mt-3 text-[0.8125rem]" style={{ color: "var(--text-muted)" }}>
              No time tracked for this project yet. Start a timer to begin.
            </p>
          ) : (
            <ul className="mt-2">
              {timeEntries.map((entry) => (
                <TimeRow key={entry.id} entry={entry} />
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}
