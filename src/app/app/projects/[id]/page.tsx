import Link from "next/link";
import { notFound } from "next/navigation";
import { resolveActiveUserId } from "@/lib/viewer-context";
import { boardStatusMeta, energyTypeMeta, momentumDotColor } from "@/lib/projects";
import {
  ensureProjectBoardTables,
  getBoardProject,
  listAreas,
} from "@/lib/services/projects";
import {
  ensureProjectPlanningColumns,
  getProjectPlan,
} from "@/lib/services/project-planning";
import { EditProjectSheet, type ProjectEditView } from "../_components/edit-project-sheet";
import { ProjectDetailBody } from "../_components/health-panel";
import { ProjectPlanSection } from "../_components/project-plan-section";

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

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await Promise.all([
    ensureProjectBoardTables(),
    ensureProjectPlanningColumns().catch(() => {}),
  ]);
  const { id } = await params;
  const userId = await resolveActiveUserId();
  const now = new Date();

  const [detail, areas, plan] = await Promise.all([
    getBoardProject(userId, id),
    listAreas(userId),
    getProjectPlan(userId, id).catch(() => null),
  ]);
  if (!detail) notFound();

  const { project, tasks, timeEntries, health } = detail;
  const status = boardStatusMeta(project.status);
  const energy = energyTypeMeta(project.energyType);
  const countdown = targetCountdown(project.daysUntilTarget);
  const running = timeEntries.length > 0 && timeEntries[0]?.endedAt === null;
  const stripColor = project.area?.color ?? "#6366f1";
  const targetSoon = project.daysUntilTarget !== null && project.daysUntilTarget <= 7;

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
    <div className="space-y-6">
      <div className="fade-in space-y-4">
        <Link
          href="/app/projects"
          className="inline-flex items-center gap-1 text-[0.8125rem] font-medium hover:underline"
          style={{ color: "var(--text-muted)" }}
        >
          ← All projects
        </Link>

        <header className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2.5">
              <span
                className="inline-block h-3 w-3 shrink-0 rounded-full"
                style={{ background: momentumDotColor(project.momentum) }}
                title={project.momentum?.hint ?? status.label}
                aria-hidden
              />
              <h1
                className="min-w-0 text-[1.5rem] font-bold leading-tight tracking-tight"
                style={{ color: "var(--text)", letterSpacing: "-0.025em" }}
              >
                {project.name}
              </h1>
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.8125rem]" style={{ color: "var(--text-muted)" }}>
              <span className="inline-flex items-center gap-1.5">
                <span className="inline-block h-2 w-2 rounded-full" style={{ background: stripColor }} aria-hidden />
                {project.area?.name ?? "No area"}
              </span>
              <span style={{ color: status.color }}>{status.label}</span>
              <span className="inline-flex items-center gap-1">
                <span aria-hidden>{energy.emoji}</span>
                {energy.label}
              </span>
              {countdown ? (
                <span
                  className="font-medium"
                  style={{ color: targetSoon ? "var(--accent-strong)" : "var(--text-muted)" }}
                >
                  {countdown}
                </span>
              ) : null}
            </div>

            {project.intent ? (
              <p className="mt-2 line-clamp-2 text-[0.9375rem] italic" style={{ color: "var(--text-muted)" }}>
                “{project.intent}”
              </p>
            ) : null}
          </div>
          <EditProjectSheet project={editView} areas={areas} />
        </header>
      </div>

      {plan && (
        <div className="fade-in-delay-1">
          <ProjectPlanSection projectId={project.id} plan={plan} />
        </div>
      )}

      <div className={plan ? "fade-in-delay-2" : "fade-in-delay-1"}>
        <ProjectDetailBody
          projectId={project.id}
          projectName={project.name}
          stripColor={stripColor}
          tasks={tasks}
          timeEntries={timeEntries}
          health={health}
          running={running}
          now={now}
        />
      </div>
    </div>
  );
}
