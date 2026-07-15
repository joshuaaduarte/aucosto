import { resolveActiveUserId } from "@/lib/viewer-context";
import {
  boardStatusMeta,
  defaultProjectColor,
  formatBudgetMinutes,
  formatLastWorkedShort,
} from "@/lib/projects";
import {
  ensureProjectBoardTables,
  getWeekAllocation,
  listAreas,
  listBoardProjects,
} from "@/lib/services/projects";
import { getWorkspaceNamesByProjectId } from "@/lib/services/work";
import { NewProjectSheet } from "./_components/new-project-sheet";
import { ProjectList } from "./_components/project-list";
import type { ProjectCardView } from "./_components/project-card";
import type { AllocationSegmentView } from "./_components/time-allocation-bar";

export const dynamic = "force-dynamic";

export default async function ProjectsPage() {
  await ensureProjectBoardTables();
  const userId = await resolveActiveUserId();
  const now = new Date();

  const [cards, areas, allocation, workNames] = await Promise.all([
    listBoardProjects(userId),
    listAreas(userId),
    getWeekAllocation(userId),
    getWorkspaceNamesByProjectId(userId),
  ]);

  const views: ProjectCardView[] = cards.map((card, index) => ({
    id: card.id,
    name: card.name,
    stripColor: card.area?.color ?? defaultProjectColor(index),
    momentum: card.momentum,
    weekMinutes: card.weekMinutes,
    weekMinutesLabel: formatBudgetMinutes(card.weekMinutes),
    lastWorkedShort: formatLastWorkedShort(card.lastWorkedAt, now),
    lastWorkedMs: card.lastWorkedAt ? card.lastWorkedAt.getTime() : 0,
    nextAction: card.nextAction,
    openTaskCount: card.openTaskCount,
    status: card.status,
    statusLabel: boardStatusMeta(card.status).label,
    dimmed: card.status === "paused" || card.status === "done",
    intent: card.intent,
    areaId: card.area?.id ?? null,
    area: card.area,
    energyType: card.energyType,
    timeBudgetHours: card.timeBudgetMinutes ? String(card.timeBudgetMinutes / 60) : "",
    targetDateValue: card.targetDate ? card.targetDate.toLocaleDateString("en-CA") : "",
    workLabel: workNames.get(card.id) ?? null,
  }));

  const total = allocation.totalMinutes;
  const allocationSegments: AllocationSegmentView[] = allocation.segments.map((segment) => ({
    projectId: segment.projectId,
    name: segment.name,
    color: segment.color,
    minutes: segment.minutes,
    label: formatBudgetMinutes(segment.minutes),
    pct: total > 0 ? (segment.minutes / total) * 100 : 0,
  }));

  const weekTotalLabel = formatBudgetMinutes(total);

  return (
    <div className="space-y-6">
      <header className="fade-in">
        <h1
          className="text-[1.5rem] font-bold tracking-tight sm:text-[1.875rem]"
          style={{ color: "var(--text)", letterSpacing: "-0.025em" }}
        >
          Projects
        </h1>
      </header>

      <div className="fade-in-delay-1">
        <ProjectList
          projects={views}
          areas={areas}
          allocation={{ totalLabel: weekTotalLabel, segments: allocationSegments }}
        />
      </div>

      <NewProjectSheet areas={areas} />
    </div>
  );
}
