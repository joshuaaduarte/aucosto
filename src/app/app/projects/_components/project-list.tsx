"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  BOARD_STATUSES,
  boardStatusMeta,
  momentumDotColor,
} from "@/lib/projects";
import {
  archiveProjectAction,
  startProjectTimerAction,
  updateProjectAction,
} from "../actions";
import { useBodyScrollLock } from "../../_components/use-body-scroll-lock";
import { ProjectCard, type ProjectCardView } from "./project-card";
import { TimeAllocationBar, type AllocationSegmentView } from "./time-allocation-bar";
import { EditProjectSheet, type ProjectEditView } from "./edit-project-sheet";
import type { AreaView } from "./area-badge";

function toEditView(view: ProjectCardView): ProjectEditView {
  return {
    id: view.id,
    name: view.name,
    intent: view.intent,
    areaId: view.areaId,
    status: view.status,
    energyType: view.energyType,
    timeBudgetHours: view.timeBudgetHours,
    targetDateValue: view.targetDateValue,
  };
}

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
  const [showDone, setShowDone] = useState(false);
  const [quickProject, setQuickProject] = useState<ProjectCardView | null>(null);
  const [editProject, setEditProject] = useState<ProjectCardView | null>(null);

  const hasUnassigned = projects.some((project) => !project.areaId);

  const filtered = useMemo(() => {
    if (areaFilter === "all") return projects;
    if (areaFilter === "none") return projects.filter((project) => !project.areaId);
    return projects.filter((project) => project.areaId === areaFilter);
  }, [projects, areaFilter]);

  const active = filtered.filter((project) => project.status !== "done");
  const done = filtered.filter((project) => project.status === "done");

  if (projects.length === 0) {
    return <EmptyState />;
  }

  return (
    <div className="space-y-5">
      <TimeAllocationBar
        segments={allocation.segments}
        highlightedId={highlightedId}
        onHighlight={setHighlightedId}
      />

      {areas.length > 0 ? (
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 no-scrollbar">
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
        <p className="py-8 text-center text-[0.875rem]" style={{ color: "var(--text-muted)" }}>
          Nothing here for this filter.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
          {active.map((project, index) => (
            <ProjectCard
              key={project.id}
              view={project}
              index={index}
              highlighted={highlightedId !== null && highlightedId === project.id}
              onQuickAction={setQuickProject}
            />
          ))}
        </div>
      )}

      {done.length > 0 ? (
        <div className="space-y-3">
          <div className="flex justify-center">
            <button
              type="button"
              onClick={() => setShowDone((value) => !value)}
              className="text-[0.8125rem] font-medium transition-colors hover:underline"
              style={{ color: "var(--text-faint)" }}
            >
              {showDone ? "Hide done" : `Show done (${done.length})`}
            </button>
          </div>
          {showDone ? (
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
              {done.map((project, index) => (
                <ProjectCard
                  key={project.id}
                  view={project}
                  index={index}
                  highlighted={highlightedId !== null && highlightedId === project.id}
                  onQuickAction={setQuickProject}
                />
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      {quickProject ? (
        <QuickActionSheet
          view={quickProject}
          onClose={() => setQuickProject(null)}
          onEdit={(view) => {
            setQuickProject(null);
            setEditProject(view);
          }}
        />
      ) : null}

      {editProject ? (
        <EditProjectSheet
          project={toEditView(editProject)}
          areas={areas}
          open
          hideTrigger
          onOpenChange={(value) => {
            if (!value) setEditProject(null);
          }}
        />
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
      className="inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-[0.8125rem] font-medium transition-colors [@media(pointer:coarse)]:min-h-[2.75rem]"
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

/**
 * Bottom sheet of one-tap actions for a single project: change status, start a
 * timer, edit, or mark done. Mutations reuse the existing server actions —
 * status changes post a full project form so no other field is touched.
 */
function QuickActionSheet({
  view,
  onClose,
  onEdit,
}: {
  view: ProjectCardView;
  onClose: () => void;
  onEdit: (view: ProjectCardView) => void;
}) {
  useBodyScrollLock(true);
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function setStatus(status: string) {
    const fd = new FormData();
    fd.set("id", view.id);
    fd.set("name", view.name);
    fd.set("areaId", view.areaId ?? "");
    fd.set("intent", view.intent ?? "");
    fd.set("status", status);
    fd.set("energyType", view.energyType);
    fd.set("timeBudgetHours", view.timeBudgetHours);
    fd.set("targetDate", view.targetDateValue);
    startTransition(async () => {
      await updateProjectAction(undefined, fd);
      onClose();
      router.refresh();
    });
  }

  function startTimer() {
    startTransition(async () => {
      await startProjectTimerAction(view.id);
      onClose();
      router.refresh();
    });
  }

  function markDone() {
    startTransition(async () => {
      await archiveProjectAction(view.id);
      onClose();
      router.refresh();
    });
  }

  return (
    <div className="calendar-modal-backdrop" role="presentation" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Actions for ${view.name}`}
        className="calendar-modal"
        onClick={(event) => event.stopPropagation()}
        style={{ opacity: pending ? 0.7 : 1 }}
      >
        <div className="flex items-center gap-2.5">
          <span
            className="inline-block h-3 w-3 shrink-0 rounded-full"
            style={{ background: momentumDotColor(view.momentum) }}
            aria-hidden
          />
          <h2 className="min-w-0 flex-1 truncate text-[1.0625rem] font-semibold tracking-tight" style={{ color: "var(--text)" }}>
            {view.name}
          </h2>
          <button
            type="button"
            className="btn-icon h-8 w-8 rounded-full border"
            style={{ borderColor: "var(--border-faint)" }}
            onClick={onClose}
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Status */}
        <p className="mt-5 text-[0.6875rem] font-semibold uppercase tracking-wider" style={{ color: "var(--text-faint)" }}>
          Status
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          {BOARD_STATUSES.map((value) => {
            const meta = boardStatusMeta(value);
            const selected = view.status === value;
            return (
              <button
                key={value}
                type="button"
                disabled={pending}
                onClick={() => setStatus(value)}
                className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[0.8125rem] font-medium transition-colors [@media(pointer:coarse)]:min-h-[2.75rem]"
                style={{
                  background: selected ? meta.bg : "var(--bg-tint)",
                  color: selected ? meta.color : "var(--text-muted)",
                  boxShadow: selected ? `inset 0 0 0 1px ${meta.color}` : undefined,
                }}
              >
                <span className="inline-block h-2 w-2 rounded-full" style={{ background: meta.color }} aria-hidden />
                {meta.label}
              </button>
            );
          })}
        </div>

        {/* Actions */}
        <div className="mt-5 space-y-1.5">
          <SheetAction icon="▶" label="Start timer" onClick={startTimer} disabled={pending} />
          <SheetAction icon="✎" label="Edit project" onClick={() => onEdit(view)} disabled={pending} />
          <SheetAction icon="✓" label="Mark done" onClick={markDone} disabled={pending} />
        </div>
      </div>
    </div>
  );
}

function SheetAction({
  icon,
  label,
  onClick,
  disabled,
}: {
  icon: string;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex min-h-[2.75rem] w-full items-center gap-3 rounded-lg px-3 text-left text-[0.9375rem] font-medium transition-colors hover:bg-bg-hover disabled:opacity-50"
      style={{ color: "var(--text)" }}
    >
      <span className="inline-flex h-7 w-7 items-center justify-center rounded-full text-[0.8125rem]" style={{ background: "var(--bg-tint)", color: "var(--text-muted)" }} aria-hidden>
        {icon}
      </span>
      {label}
    </button>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <svg width="72" height="72" viewBox="0 0 72 72" fill="none" aria-hidden>
        <circle cx="36" cy="36" r="27" stroke="var(--border)" strokeWidth="2" />
        <circle cx="36" cy="36" r="3" fill="var(--accent)" />
        <path d="M36 17v6M36 49v6M17 36h6M49 36h6" stroke="var(--border)" strokeWidth="2" strokeLinecap="round" />
        <path d="M45 27L39 39l-12 6 6-12z" fill="var(--accent-tint)" stroke="var(--accent)" strokeWidth="2" strokeLinejoin="round" />
      </svg>
      <h2 className="mt-5 text-[1.0625rem] font-semibold tracking-tight" style={{ color: "var(--text)" }}>
        No projects yet
      </h2>
      <button
        type="button"
        className="btn-ink mt-4"
        onClick={() => {
          // The persistent "+" FAB owns the new-project sheet.
          (document.querySelector(".calendar-fab") as HTMLButtonElement | null)?.click();
        }}
      >
        Start your first one
      </button>
    </div>
  );
}
