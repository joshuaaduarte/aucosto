"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { DO_BUCKET_SUGGESTIONS, DO_LANE_LABELS, DO_LANES } from "@/lib/do";
import { createDoItemAction, type DoState } from "./actions";
import { useBodyScrollLock } from "../_components/use-body-scroll-lock";

const initialState: DoState = undefined;

const QUICK_TEMPLATES = [
  { title: "Business outreach", lane: "today", estimatedMinutes: 30 },
  { title: "Wedding follow-up", lane: "next", estimatedMinutes: 20 },
  { title: "Weekly planning", lane: "today", estimatedMinutes: 45 },
  { title: "Long run planning", lane: "later", estimatedMinutes: 25 },
] as const;

export function DoCreateForm({
  projects,
}: {
  projects: Array<{ id: string; name: string }>;
}) {
  const [state, formAction, pending] = useActionState(
    createDoItemAction,
    initialState,
  );
  const formRef = useRef<HTMLFormElement>(null);
  const submittedRef = useRef(false);
  const [open, setOpen] = useState(false);
  useBodyScrollLock(open);
  const [title, setTitle] = useState("");
  const [lane, setLane] = useState<(typeof DO_LANES)[number]>("next");
  const [estimatedMinutes, setEstimatedMinutes] = useState("");
  const [bucket, setBucket] = useState("");
  const [projectId, setProjectId] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (pending) {
      submittedRef.current = true;
      return;
    }

    if (submittedRef.current && open && !state?.error) {
      submittedRef.current = false;
      const timer = window.setTimeout(() => {
        resetForm();
        setOpen(false);
      }, 0);
      return () => window.clearTimeout(timer);
    }
  }, [open, pending, state]);

  function resetForm() {
    formRef.current?.reset();
    submittedRef.current = false;
    setTitle("");
    setLane("next");
    setEstimatedMinutes("");
    setBucket("");
    setProjectId("");
    setNotes("");
  }

  function applyTemplate(template: (typeof QUICK_TEMPLATES)[number]) {
    setTitle(template.title);
    setLane(template.lane);
    setEstimatedMinutes(String(template.estimatedMinutes));
  }

  return (
    <>
      <div className="flex justify-end">
        <button
          type="button"
          className="btn-ink"
          onClick={() => setOpen(true)}
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-controls="do-quick-add"
        >
          New task
        </button>
      </div>

      <button
        type="button"
        className="calendar-fab"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls="do-quick-add"
      >
        <span className="calendar-fab__plus" aria-hidden="true">
          +
        </span>
        <span>Add task</span>
      </button>

      {open ? (
        <div
          className="calendar-modal-backdrop"
          role="presentation"
          onClick={() => setOpen(false)}
        >
          <div
            id="do-quick-add"
            role="dialog"
            aria-modal="true"
            aria-labelledby="do-quick-add-title"
            className="calendar-modal"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p
                  className="text-[0.6875rem] font-semibold uppercase tracking-wider"
                  style={{ color: "var(--text-faint)" }}
                >
                  Add a task
                </p>
                <h2
                  id="do-quick-add-title"
                  className="mt-1 text-[1.125rem] font-semibold tracking-tight"
                  style={{ color: "var(--text)" }}
                >
                  Capture the next thing worth doing
                </h2>
              </div>

              <button
                type="button"
                className="btn-icon h-8 w-8 rounded-full border"
                style={{ borderColor: "var(--border-faint)" }}
                onClick={() => setOpen(false)}
                aria-label="Close add task modal"
              >
                x
              </button>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {QUICK_TEMPLATES.map((template) => (
                <button
                  key={template.title}
                  type="button"
                  className="pill cursor-pointer"
                  onClick={() => applyTemplate(template)}
                >
                  {template.title}
                </button>
              ))}
            </div>

            <form
              ref={formRef}
              action={formAction}
              className="mt-5 space-y-4"
              onSubmit={() => {
                submittedRef.current = true;
              }}
            >
              <div className="space-y-1.5">
                <label
                  htmlFor="do-title"
                  className="block text-[0.75rem] font-medium"
                  style={{ color: "var(--text-muted)" }}
                >
                  Task
                </label>
                <input
                  id="do-title"
                  name="title"
                  required
                  placeholder="Follow up with florist, sketch homepage concept, long run"
                  className="field"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-[1fr_140px]">
                <div className="space-y-1.5">
                  <label
                    htmlFor="do-lane"
                    className="block text-[0.75rem] font-medium"
                    style={{ color: "var(--text-muted)" }}
                  >
                    When
                  </label>
                  <select
                    id="do-lane"
                    name="lane"
                    value={lane}
                    onChange={(event) =>
                      setLane(event.target.value as (typeof DO_LANES)[number])
                    }
                    className="field"
                  >
                    {DO_LANES.map((laneOption) => (
                      <option key={laneOption} value={laneOption}>
                        {DO_LANE_LABELS[laneOption]}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label
                    htmlFor="do-estimatedMinutes"
                    className="block text-[0.75rem] font-medium"
                    style={{ color: "var(--text-muted)" }}
                  >
                    Estimate
                  </label>
                  <input
                    id="do-estimatedMinutes"
                    name="estimatedMinutes"
                    type="number"
                    min={5}
                    step={5}
                    placeholder="45"
                    className="field"
                    value={estimatedMinutes}
                    onChange={(event) => setEstimatedMinutes(event.target.value)}
                  />
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label
                    htmlFor="do-bucket"
                    className="block text-[0.75rem] font-medium"
                    style={{ color: "var(--text-muted)" }}
                  >
                    Bucket
                  </label>
                  <input
                    id="do-bucket"
                    name="bucket"
                    list="do-bucket-suggestions"
                    className="field"
                    placeholder="work, wedding, health"
                    value={bucket}
                    onChange={(event) => setBucket(event.target.value)}
                  />
                  <datalist id="do-bucket-suggestions">
                    {DO_BUCKET_SUGGESTIONS.map((suggestion) => (
                      <option key={suggestion} value={suggestion} />
                    ))}
                  </datalist>
                </div>

                <div className="space-y-1.5">
                  <label
                    htmlFor="do-projectId"
                    className="block text-[0.75rem] font-medium"
                    style={{ color: "var(--text-muted)" }}
                  >
                    Project <span style={{ color: "var(--text-faint)" }}>(optional)</span>
                  </label>
                  <select
                    id="do-projectId"
                    name="projectId"
                    className="field"
                    value={projectId}
                    onChange={(event) => setProjectId(event.target.value)}
                  >
                    <option value="">No project</option>
                    {projects.map((project) => (
                      <option key={project.id} value={project.id}>
                        {project.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="do-notes"
                  className="block text-[0.75rem] font-medium"
                  style={{ color: "var(--text-muted)" }}
                >
                  Notes <span style={{ color: "var(--text-faint)" }}>(optional)</span>
                </label>
                <input
                  id="do-notes"
                  name="notes"
                  className="field"
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                />
              </div>

              {state?.error ? (
                <p
                  className="rounded-md px-3 py-2 text-[0.8125rem]"
                  style={{
                    background: "var(--accent-tint)",
                    color: "var(--accent-strong)",
                    border: "1px solid var(--accent-tint-strong)",
                  }}
                >
                  {state.error}
                </p>
              ) : null}

              <div className="flex items-center justify-between gap-3 pt-1">
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={() => {
                    resetForm();
                    setOpen(false);
                  }}
                >
                  Cancel
                </button>
                <button type="submit" disabled={pending} className="btn-ink">
                  {pending ? "Saving..." : "Add task"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
