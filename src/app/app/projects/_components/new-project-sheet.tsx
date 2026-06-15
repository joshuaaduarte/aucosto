"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import {
  AREA_COLOR_PALETTE,
  BOARD_STATUSES,
  ENERGY_TYPES,
  boardStatusMeta,
} from "@/lib/projects";
import { createAreaAction, createProjectAction, type ProjectFormState } from "../actions";
import { useBodyScrollLock } from "../../_components/use-body-scroll-lock";
import type { AreaView } from "./area-badge";

const initialState: ProjectFormState = undefined;

export function NewProjectSheet({ areas: initialAreas }: { areas: AreaView[] }) {
  const [open, setOpen] = useState(false);
  useBodyScrollLock(open);

  const [state, formAction, pending] = useActionState(createProjectAction, initialState);
  const [areas, setAreas] = useState<AreaView[]>(initialAreas);
  const [areaId, setAreaId] = useState<string>("");
  const [status, setStatus] = useState<string>("active");
  const [energy, setEnergy] = useState<string>("deep");
  const [advanced, setAdvanced] = useState(false);

  const [addingArea, setAddingArea] = useState(false);
  const [newAreaName, setNewAreaName] = useState("");
  const [areaPending, startArea] = useTransition();
  const [areaError, setAreaError] = useState<string | null>(null);

  useEffect(() => {
    setAreas(initialAreas);
  }, [initialAreas]);

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
        setAreaError(null);
      } else {
        setAreaError(result.error);
      }
    });
  }

  return (
    <>
      <button
        type="button"
        className="calendar-fab"
        style={{ width: "3.5rem", padding: 0, justifyContent: "center" }}
        onClick={() => setOpen(true)}
        aria-label="New project"
        title="New project"
      >
        <span style={{ fontSize: "1.6rem", lineHeight: 1 }} aria-hidden>
          ＋
        </span>
      </button>

      {open ? (
        <div
          className="calendar-modal-backdrop"
          role="presentation"
          onClick={() => setOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="new-project-title"
            className="calendar-modal"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p
                  className="text-[0.6875rem] font-semibold uppercase tracking-wider"
                  style={{ color: "var(--text-faint)" }}
                >
                  New project
                </p>
                <h2
                  id="new-project-title"
                  className="mt-1 text-[1.125rem] font-semibold tracking-tight"
                  style={{ color: "var(--text)" }}
                >
                  What are you taking on?
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

            <form action={formAction} className="mt-4 space-y-4">
              <input type="hidden" name="areaId" value={areaId} />
              <input type="hidden" name="status" value={status} />
              <input type="hidden" name="energyType" value={energy} />

              {/* Name */}
              <div className="space-y-1.5">
                <label className="block text-[0.75rem] font-medium" style={{ color: "var(--text-muted)" }} htmlFor="np-name">
                  Name
                </label>
                <input
                  id="np-name"
                  name="name"
                  required
                  maxLength={160}
                  placeholder="Launch the new portfolio site…"
                  className="field"
                />
              </div>

              {/* Area */}
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
                      <button
                        type="button"
                        className="btn-ghost"
                        style={{ height: "2rem" }}
                        disabled={areaPending}
                        onClick={submitNewArea}
                      >
                        {areaPending ? "…" : "Add"}
                      </button>
                    </span>
                  ) : (
                    <button
                      type="button"
                      className="pill cursor-pointer"
                      onClick={() => setAddingArea(true)}
                    >
                      ＋ New area
                    </button>
                  )}
                </div>
                {areaError ? (
                  <p className="text-[0.75rem]" style={{ color: "#ef4444" }}>{areaError}</p>
                ) : null}
              </div>

              {/* Intent */}
              <div className="space-y-1.5">
                <label className="block text-[0.75rem] font-medium" style={{ color: "var(--text-muted)" }} htmlFor="np-intent">
                  Why does this exist? <span style={{ color: "var(--text-ghost)" }}>(optional)</span>
                </label>
                <input
                  id="np-intent"
                  name="intent"
                  maxLength={280}
                  placeholder="One sentence — the reason this project earns your time."
                  className="field"
                />
              </div>

              {/* Status */}
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

              {/* Energy type */}
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

              {/* Advanced */}
              {advanced ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <label className="block text-[0.75rem] font-medium" style={{ color: "var(--text-muted)" }} htmlFor="np-budget">
                      Time budget (hours)
                    </label>
                    <input
                      id="np-budget"
                      name="timeBudgetHours"
                      type="number"
                      min="0"
                      step="0.5"
                      placeholder="20"
                      className="field"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="block text-[0.75rem] font-medium" style={{ color: "var(--text-muted)" }} htmlFor="np-target">
                      Target date
                    </label>
                    <input id="np-target" name="targetDate" type="date" className="field" />
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  className="text-[0.8125rem] font-medium hover:underline"
                  style={{ color: "var(--text-muted)" }}
                  onClick={() => setAdvanced(true)}
                >
                  + Add time budget &amp; target date
                </button>
              )}

              {state?.error ? (
                <p className="text-[0.8125rem]" style={{ color: "#ef4444" }}>{state.error}</p>
              ) : null}

              <div className="flex items-center justify-between gap-3 pt-1">
                <button type="button" className="btn-ghost" onClick={() => setOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-ink" disabled={pending}>
                  {pending ? "Creating…" : "Create project"}
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
