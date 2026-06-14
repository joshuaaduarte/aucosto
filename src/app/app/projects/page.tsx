import { resolveActiveUserId } from "@/lib/viewer-context";
import {
  boardStatusMeta,
  energyTypeMeta,
  formatBudgetMinutes,
  formatLastWorked,
} from "@/lib/projects";
import {
  ensureProjectBoardTables,
  getWeekAllocation,
  listAreas,
  listBoardProjects,
} from "@/lib/services/projects";
import { NewProjectSheet } from "./_components/new-project-sheet";
import { ProjectList } from "./_components/project-list";
import type { ProjectCardView } from "./_components/project-card";
import type { AllocationSegmentView } from "./_components/time-allocation-bar";

export const dynamic = "force-dynamic";

export default async function ProjectsPage() {
  await ensureProjectBoardTables();
  const userId = await resolveActiveUserId();
  const now = new Date();

  const [cards, areas, allocation] = await Promise.all([
    listBoardProjects(userId),
    listAreas(userId),
    getWeekAllocation(userId),
  ]);

  const views: ProjectCardView[] = cards.map((card) => {
    const status = boardStatusMeta(card.status);
    const energy = energyTypeMeta(card.energyType);
    return {
      id: card.id,
      name: card.name,
      intent: card.intent,
      statusLabel: status.label,
      statusColor: status.color,
      statusBg: status.bg,
      energyEmoji: energy.emoji,
      energyLabel: energy.label,
      area: card.area,
      areaId: card.area?.id ?? null,
      stripColor: card.area?.color ?? status.color,
      momentum: card.momentum,
      weekMinutesLabel: formatBudgetMinutes(card.weekMinutes),
      lastWorkedLabel: formatLastWorked(card.lastWorkedAt, now),
      nextAction: card.nextAction,
      openTaskCount: card.openTaskCount,
      daysUntilTarget: card.daysUntilTarget,
    };
  });

  const total = allocation.totalMinutes;
  const allocationSegments: AllocationSegmentView[] = allocation.segments.map((segment) => ({
    projectId: segment.projectId,
    name: segment.name,
    color: segment.color,
    minutes: segment.minutes,
    label: formatBudgetMinutes(segment.minutes),
    pct: total > 0 ? (segment.minutes / total) * 100 : 0,
  }));

  const activeCount = cards.filter((card) => card.status !== "done").length;
  const attentionCount = cards.filter((card) => card.momentum && card.momentum.level !== "alive").length;
  const weekTotalLabel = formatBudgetMinutes(total);

  return (
    <div className="space-y-8">
      <header className="fade-in flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[0.75rem] font-medium uppercase tracking-wider" style={{ color: "var(--text-faint)" }}>
            Projects
          </p>
          <h1
            className="mt-1 text-[1.5rem] font-bold tracking-tight sm:text-[1.875rem]"
            style={{ color: "var(--text)", letterSpacing: "-0.025em" }}
          >
            Command center
          </h1>
          <p className="mt-1 text-[0.8125rem]" style={{ color: "var(--text-muted)" }}>
            {activeCount} active · {weekTotalLabel} logged this week
            {attentionCount > 0 ? ` · ${attentionCount} need attention` : " · all moving"}
          </p>
        </div>
        <NewProjectSheet areas={areas} />
      </header>

      <div className="fade-in-delay-1">
        <ProjectList
          projects={views}
          areas={areas}
          allocation={{ totalLabel: weekTotalLabel, segments: allocationSegments }}
        />
      </div>
    </div>
  );
}
