"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import {
  PROJECT_STATUSES,
  PROJECT_STATUS_LABELS,
  type ProjectStatus,
} from "@/lib/projects";
import { createProjectAction, type ProjectState } from "./actions";

const initialState: ProjectState = undefined;

const PROJECT_TEMPLATES = [
  {
    name: "Wedding follow-through",
    bucket: "wedding",
    nextMilestone: "Lock the next vendor decision",
  },
  {
    name: "Aucosto product push",
    bucket: "business",
    nextMilestone: "Ship the next cross-tool loop",
  },
] as const;

export function ProjectCreateForm() {
  const [state, formAction, pending] = useActionState(
    createProjectAction,
    initialState,
  );
  const formRef = useRef<HTMLFormElement>(null);
  const submittedRef = useRef(false);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [bucket, setBucket] = useState("");
  const [status, setStatus] = useState<ProjectStatus>("active");
  const [summary, setSummary] = useState("");
  const [nextMilestone, setNextMilestone] = useState("");

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
    setName("");
    setBucket("");
    setStatus("active");
    setSummary("");
    setNextMilestone("");
  }

  function applyTemplate(template: (typeof PROJECT_TEMPLATES)[number]) {
    setName(template.name);
    setBucket(template.bucket);
    setNextMilestone(template.nextMilestone);
    setStatus("active");
  }

  return (
    <>
      <button
        type="button"
        className="calendar-fab"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls="project-quick-add"
      >
        <span className="calendar-fab__plus" aria-hidden="true">
          +
        </span>
        <span>Add project</span>
      </button>

      {open ? (
        <div
          className="calendar-modal-backdrop"
          role="presentation"
          onClick={() => setOpen(false)}
        >
          <div
            id="project-quick-add"
            role="dialog"
            aria-modal="true"
            aria-labelledby="project-quick-add-title"
            className="calendar-modal"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p
                  className="text-[0.6875rem] font-semibold uppercase tracking-wider"
                  style={{ color: "var(--text-faint)" }}
                >
                  Projects
                </p>
                <h2
                  id="project-quick-add-title"
                  className="mt-1 text-[1.125rem] font-semibold tracking-tight"
                  style={{ color: "var(--text)" }}
                >
                  Open a planning container, not a junk drawer
                </h2>
              </div>
              <button
                type="button"
                className="btn-icon h-8 w-8 rounded-full border"
                style={{ borderColor: "var(--border-faint)" }}
                onClick={() => setOpen(false)}
                aria-label="Close add project modal"
              >
                x
              </button>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {PROJECT_TEMPLATES.map((template) => (
                <button
                  key={template.name}
                  type="button"
                  className="pill cursor-pointer"
                  onClick={() => applyTemplate(template)}
                >
                  {template.name}
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
                <label htmlFor="project-name" className="block text-[0.75rem] font-medium" style={{ color: "var(--text-muted)" }}>
                  Project
                </label>
                <input
                  id="project-name"
                  name="name"
                  required
                  className="field"
                  placeholder="Launch a clean wedding follow-up system"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label htmlFor="project-bucket" className="block text-[0.75rem] font-medium" style={{ color: "var(--text-muted)" }}>
                    Bucket
                  </label>
                  <input
                    id="project-bucket"
                    name="bucket"
                    className="field"
                    placeholder="business, wedding, work"
                    value={bucket}
                    onChange={(event) => setBucket(event.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="project-status" className="block text-[0.75rem] font-medium" style={{ color: "var(--text-muted)" }}>
                    Status
                  </label>
                  <select
                    id="project-status"
                    name="status"
                    className="field"
                    value={status}
                    onChange={(event) => setStatus(event.target.value as ProjectStatus)}
                  >
                    {PROJECT_STATUSES.map((option) => (
                      <option key={option} value={option}>
                        {PROJECT_STATUS_LABELS[option]}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="project-summary" className="block text-[0.75rem] font-medium" style={{ color: "var(--text-muted)" }}>
                  Outcome
                </label>
                <input
                  id="project-summary"
                  name="summary"
                  className="field"
                  placeholder="What finished looks like"
                  value={summary}
                  onChange={(event) => setSummary(event.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="project-nextMilestone" className="block text-[0.75rem] font-medium" style={{ color: "var(--text-muted)" }}>
                  Next milestone
                </label>
                <input
                  id="project-nextMilestone"
                  name="nextMilestone"
                  className="field"
                  placeholder="Next visible checkpoint"
                  value={nextMilestone}
                  onChange={(event) => setNextMilestone(event.target.value)}
                />
              </div>

              {state?.error ? (
                <p className="rounded-md px-3 py-2 text-[0.8125rem]" style={{ background: "var(--accent-tint)", color: "var(--accent-strong)", border: "1px solid var(--accent-tint-strong)" }}>
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
                  {pending ? "Saving..." : "Add project"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
