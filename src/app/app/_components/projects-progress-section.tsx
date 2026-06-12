import Link from "next/link";
import {
  projectProgress,
  projectStatusStyle,
  type ProjectStatus,
} from "@/lib/projects";

export type HubProject = {
  id: string;
  name: string;
  status: ProjectStatus;
  openTaskCount: number;
  doneTaskCount: number;
};

// Hub module: the few active projects, each with a progress bar. Hidden
// entirely when nothing is in motion.
export function ProjectsProgressSection({ projects }: { projects: HubProject[] }) {
  const active = projects
    .filter((p) => p.status !== "done" && p.status !== "archived")
    .sort((a, b) => {
      // Active-status projects first, then the ones with the most open work.
      if (a.status === "active" && b.status !== "active") return -1;
      if (a.status !== "active" && b.status === "active") return 1;
      return b.openTaskCount - a.openTaskCount;
    })
    .slice(0, 3);

  if (active.length === 0) return null;

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p
          className="text-[0.6875rem] font-semibold uppercase tracking-wider"
          style={{ color: "var(--text-faint)" }}
        >
          Projects in motion
        </p>
        <Link
          href="/app/projects"
          className="text-[0.75rem] font-medium hover:underline"
          style={{ color: "var(--text-muted)" }}
        >
          All projects →
        </Link>
      </div>

      <div className="grid gap-2 sm:grid-cols-3">
        {active.map((project) => {
          const total = project.openTaskCount + project.doneTaskCount;
          const pct = projectProgress(project.doneTaskCount, project.openTaskCount);
          const style = projectStatusStyle(project.status);
          return (
            <Link
              key={project.id}
              href={`/app/projects/${project.id}`}
              className="rounded-md border p-3 transition-colors hover:bg-bg-hover"
              style={{
                borderColor: "var(--border-faint)",
                background: "var(--bg-page)",
              }}
            >
              <div className="flex items-start justify-between gap-2">
                <p
                  className="min-w-0 truncate text-[0.8125rem] font-medium"
                  style={{ color: "var(--text)" }}
                >
                  {project.name}
                </p>
                <span
                  className="shrink-0 rounded-full px-1.5 py-0.5 text-[0.625rem] font-semibold uppercase tracking-wider"
                  style={{ background: style.bg, color: style.color }}
                >
                  {style.label}
                </span>
              </div>
              <div
                className="mt-2.5 h-[5px] overflow-hidden rounded-full"
                style={{ background: "var(--bg-tint-strong)" }}
              >
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${Math.max(total === 0 ? 0 : 3, pct)}%`,
                    background: pct === 100 ? "#3b82f6" : "var(--accent)",
                  }}
                />
              </div>
              <p className="mt-1.5 tabular text-[0.72rem]" style={{ color: "var(--text-faint)" }}>
                {total === 0 ? "No tasks yet" : `${project.doneTaskCount}/${total} done · ${pct}%`}
              </p>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
