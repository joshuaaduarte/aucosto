"use client";

import { useMemo, useState } from "react";
import { ProjectCard, type ProjectCardView } from "./project-card";
import { TimeAllocationBar, type AllocationSegmentView } from "./time-allocation-bar";
import type { AreaView } from "./area-badge";

export function ProjectList({
  projects,
  areas,
  allocation,
}: {
  projects: ProjectCardView[];
  areas: AreaView[];
  allocation: { totalLabel: string; segments: AllocationSegmentView[] };
}) {
  const [areaFilter, setAreaFilter] = useState<string>("all");
  const [highlightedId, setHighlightedId] = useState<string | null>(null);

  const hasUnassigned = projects.some((project) => !project.areaId);

  const filtered = useMemo(() => {
    if (areaFilter === "all") return projects;
    if (areaFilter === "none") return projects.filter((project) => !project.areaId);
    return projects.filter((project) => project.areaId === areaFilter);
  }, [projects, areaFilter]);

  const active = filtered.filter((project) => project.statusLabel !== "Done");
  const done = filtered.filter((project) => project.statusLabel === "Done");

  return (
    <div className="space-y-6">
      <TimeAllocationBar
        segments={allocation.segments}
        totalLabel={allocation.totalLabel}
        highlightedId={highlightedId}
        onHover={setHighlightedId}
      />

      {areas.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          <FilterPill label="All" active={areaFilter === "all"} onClick={() => setAreaFilter("all")} />
          {areas.map((area) => (
            <FilterPill
              key={area.id}
              label={area.name}
              color={area.color}
              active={areaFilter === area.id}
              onClick={() => setAreaFilter(area.id)}
            />
          ))}
          {hasUnassigned ? (
            <FilterPill label="No area" active={areaFilter === "none"} onClick={() => setAreaFilter("none")} />
          ) : null}
        </div>
      ) : null}

      {active.length === 0 ? (
        <p className="text-[0.875rem]" style={{ color: "var(--text-muted)" }}>
          {projects.length === 0
            ? "No projects yet. Create one when the work needs more than a checklist."
            : "Nothing here for this filter."}
        </p>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {active.map((project) => (
            <ProjectCard
              key={project.id}
              view={project}
              highlighted={highlightedId !== null && highlightedId === project.id}
            />
          ))}
        </div>
      )}

      {done.length > 0 ? (
        <details className="rounded-lg border" style={{ borderColor: "var(--border-soft)" }}>
          <summary
            className="cursor-pointer list-none px-4 py-3 text-[0.75rem] font-semibold uppercase tracking-wider"
            style={{ color: "var(--text-faint)" }}
          >
            Done · {done.length}
          </summary>
          <div className="grid gap-3 px-3 pb-3 lg:grid-cols-2">
            {done.map((project) => (
              <ProjectCard
                key={project.id}
                view={project}
                highlighted={highlightedId !== null && highlightedId === project.id}
              />
            ))}
          </div>
        </details>
      ) : null}
    </div>
  );
}

function FilterPill({
  label,
  color,
  active,
  onClick,
}: {
  label: string;
  color?: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[0.8125rem] font-medium transition-colors"
      style={{
        background: active ? "var(--text)" : "var(--bg-tint)",
        color: active ? "var(--bg-page)" : "var(--text-muted)",
      }}
    >
      {color ? (
        <span className="inline-block h-2 w-2 rounded-full" style={{ background: color }} aria-hidden />
      ) : null}
      {label}
    </button>
  );
}
