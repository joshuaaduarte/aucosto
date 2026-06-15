"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  AREA_COLOR_PALETTE,
  BOARD_STATUSES,
  ENERGY_TYPES,
  boardStatusMeta,
} from "@/lib/projects";
import {
  archiveProjectAction,
  createAreaAction,
  updateProjectAction,
  type ProjectFormState,
} from "../actions";
import { useBodyScrollLock } from "../../_components/use-body-scroll-lock";
import type { AreaView } from "./area-badge";

export type ProjectEditView = {
  id: string;
  name: string;
  intent: string | null;
  areaId: string | null;
  status: string;
  energyType: string;
  timeBudgetHours: string;
  targetDateValue: string;
};

const initialState: ProjectFormState = undefined;

export function EditProjectSheet({
  project,
  areas: initialAreas,
  open: openProp,
  onOpenChange,
  hideTrigger = false,
}: {
  project: ProjectEditView;
  areas: AreaView[];
  /** Controlled open state (omit for the self-managed trigger button). */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Hide the built-in pencil trigger (when opened from elsewhere). */
  hideTrigger?: boolean;
}) {
  const router = useRouter();
  const [openState, setOpenState] = useState(false);
  const open = openProp ?? openState;
  const setOpen = (value: boolean) => {
    if (onOpenChange) onOpenChange(value);
    else setOpenState(value);
  };
  useBodyScrollLock(open);

  const [state, formAction, pending] = useActionState(updateProjectAction, initialState);
  const submittingRef = useRef(false);

  const [areas, setAreas] = useState<AreaView[]>(initialAreas);
  const [areaId, setAreaId] = useState<string>(project.areaId ?? "");
  const [status, setStatus] = useState<string>(project.status);
  const [energy, setEnergy] = useState<string>(project.energyType);
  const [addingArea, setAddingArea] = useState(false);
  const [newAreaName, setNewAreaName] = useState("");
  const [areaPending, startArea] = useTransition();
  const [archivePending, startArchive] = useTransition();

  useEffect(() => setAreas(initialAreas), [initialAreas]);

  // Close on a successful save (the action returns undefined and revalidates).
  useEffect(() => {
    if (!pending && submittingRef.current && !state?.error) {
      submittingRef.current = false;
      setOpen(false);
    }
  }, [pending, state]);

  function submitNewArea() {
    const name = newAreaName.trim();
    if (!name) return;
    const color = AREA_COLOR_PALETTE[areas.length % AREA_COLOR_PALETTE.length] ?? "#6366f1";
    startArea(async () => {
      const result = await createAreaAction(name, color);
      if (result.ok) {
        setAreas((prev) => [...prev, result.area]);
        setAreaId(result.area.id);
        setNewAreaName("");
        setAddingArea(false);
      }
    });
  }

  return (
    <>
      {hideTrigger ? null : (
        <button
          type="button"
          className="btn-icon h-8 w-8 rounded-md border"
          style={{ borderColor: "var(--border-faint)" }}
          onClick={() => setOpen(true)}
          aria-label="Edit project"
          title="Edit project"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M9.5 2.5l2 2L5 11l-2.5.5L3 9z" />
          </svg>
        </button>
      )}

      {open ? (
        <div className="calendar-modal-backdrop" role="presentation" onClick={() => setOpen(false)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-project-title"
            className="calendar-modal"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[0.6875rem] font-semibold uppercase tracking-wider" style={{ color: "var(--text-faint)" }}>
                  Edit project
                </p>
                <h2 id="edit-project-title" className="mt-1 text-[1.125rem] font-semibold tracking-tight" style={{ color: "var(--text)" }}>
                  Tune the plan
                </h2>
              </div>
              <button
                type="button"
                className="btn-icon h-8 w-8 rounded-full border"
                style={{ borderColor: "var(--border-faint)" }}
                onClick={() => setOpen(false)}
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <form
              action={formAction}
              className="mt-4 space-y-4"
              onSubmit={() => {
                submittingRef.current = true;
              }}
            >
              <input type="hidden" name="id" value={project.id} />
              <input type="hidden" name="areaId" value={areaId} />
              <input type="hidden" name="status" value={status} />
              <input type="hidden" name="energyType" value={energy} />

              <div className="space-y-1.5">
                <label className="block text-[0.75rem] font-medium" style={{ color: "var(--text-muted)" }} htmlFor="ep-name">
                  Name
                </label>
                <input id="ep-name" name="name" required maxLength={160} defaultValue={project.name} className="field" />
              </div>

              <div className="space-y-1.5">
                <label className="block text-[0.75rem] font-medium" style={{ color: "var(--text-muted)" }}>
                  Area
                </label>
                <div className="flex flex-wrap gap-2">
                  <AreaChip selected={areaId === ""} color="var(--text-faint)" label="None" onClick={() => setAreaId("")} />
                  {areas.map((area) => (
                    <AreaChip
                      key={area.id}
                      selected={areaId === area.id}
                      color={area.color}
                      label={area.name}
                      onClick={() => setAreaId(area.id)}
                    />
                  ))}
                  {addingArea ? (
                    <span className="inline-flex items-center gap-1">
                      <input
                        value={newAreaName}
                        onChange={(event) => setNewAreaName(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            event.preventDefault();
                            submitNewArea();
                          }
                        }}
                        placeholder="Area name"
                        className="field"
                        style={{ width: "9rem", minHeight: "2rem" }}
                      />
                      <button type="button" className="btn-ghost" style={{ height: "2rem" }} disabled={areaPending} onClick={submitNewArea}>
                        {areaPending ? "…" : "Add"}
                      </button>
                    </span>
                  ) : (
                    <button type="button" className="pill cursor-pointer" onClick={() => setAddingArea(true)}>
                      ＋ New area
                    </button>
                  )}
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-[0.75rem] font-medium" style={{ color: "var(--text-muted)" }} htmlFor="ep-intent">
                  Why does this exist?
                </label>
                <input id="ep-intent" name="intent" maxLength={280} defaultValue={project.intent ?? ""} className="field" />
              </div>

              <div className="space-y-1.5">
                <label className="block text-[0.75rem] font-medium" style={{ color: "var(--text-muted)" }}>
                  Status
                </label>
                <div className="flex flex-wrap gap-2">
                  {BOARD_STATUSES.map((value) => {
                    const meta = boardStatusMeta(value);
                    const selected = status === value;
                    return (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setStatus(value)}
                        className="inline-flex items-center rounded-full px-2.5 py-1 text-[0.75rem] font-medium transition-colors"
                        style={{
                          background: selected ? meta.bg : "var(--bg-tint)",
                          color: selected ? meta.color : "var(--text-muted)",
                          boxShadow: selected ? `inset 0 0 0 1px ${meta.color}` : undefined,
                        }}
                      >
                        {meta.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-[0.75rem] font-medium" style={{ color: "var(--text-muted)" }}>
                  Energy type
                </label>
                <div className="flex flex-wrap gap-2">
                  {ENERGY_TYPES.map((type) => {
                    const selected = energy === type.value;
                    return (
                      <button
                        key={type.value}
                        type="button"
                        onClick={() => setEnergy(type.value)}
                        className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[0.75rem] font-medium transition-colors"
                        style={{
                          background: selected ? `${type.color}1f` : "var(--bg-tint)",
                          color: selected ? type.color : "var(--text-muted)",
                          boxShadow: selected ? `inset 0 0 0 1px ${type.color}` : undefined,
                        }}
                      >
                        <span aria-hidden>{type.emoji}</span>
                        {type.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="block text-[0.75rem] font-medium" style={{ color: "var(--text-muted)" }} htmlFor="ep-budget">
                    Time budget (hours)
                  </label>
                  <input id="ep-budget" name="timeBudgetHours" type="number" min="0" step="0.5" defaultValue={project.timeBudgetHours} className="field" />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-[0.75rem] font-medium" style={{ color: "var(--text-muted)" }} htmlFor="ep-target">
                    Target date
                  </label>
                  <input id="ep-target" name="targetDate" type="date" defaultValue={project.targetDateValue} className="field" />
                </div>
              </div>

              {state?.error ? (
                <p className="text-[0.8125rem]" style={{ color: "#ef4444" }}>{state.error}</p>
              ) : null}

              <div className="flex items-center justify-between gap-3 pt-1">
                <button
                  type="button"
                  className="text-[0.8125rem] font-medium hover:underline"
                  style={{ color: "var(--text-faint)" }}
                  disabled={archivePending}
                  onClick={() =>
                    startArchive(async () => {
                      await archiveProjectAction(project.id);
                      setOpen(false);
                      router.refresh();
                    })
                  }
                >
                  {archivePending ? "Archiving…" : "Mark done"}
                </button>
                <button type="submit" className="btn-ink" disabled={pending}>
                  {pending ? "Saving…" : "Save changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}

function AreaChip({
  selected,
  color,
  label,
  onClick,
}: {
  selected: boolean;
  color: string;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[0.75rem] font-medium transition-colors"
      style={{
        background: selected ? "var(--bg-tint-strong)" : "var(--bg-tint)",
        color: selected ? "var(--text)" : "var(--text-muted)",
        boxShadow: selected ? `inset 0 0 0 1px ${color}` : undefined,
      }}
    >
      <span className="inline-block h-2 w-2 rounded-full" style={{ background: color }} aria-hidden />
      {label}
    </button>
  );
}
