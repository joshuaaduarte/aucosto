"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import {
  PROJECT_STATUSES,
  PROJECT_STATUS_LABELS,
  type ProjectStatus,
} from "@/lib/projects";
import { updateProjectAction } from "./actions";
import { DeleteProjectButton } from "./delete-project-button";

export function ProjectEditForm({
  project,
}: {
  project: {
    id: string;
    name: string;
    status: ProjectStatus;
    bucket: string | null;
    summary: string | null;
    nextMilestone: string | null;
    targetDate: Date | null;
    notes: string | null;
    openTaskCount: number;
    doneTaskCount: number;
  };
}) {
  const [state, formAction, pending] = useActionState(
    updateProjectAction,
    undefined,
  );
  const formRef = useRef<HTMLFormElement>(null);
  const submittedRef = useRef(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (pending) {
      submittedRef.current = true;
      return;
    }

    if (submittedRef.current && !state?.error) {
      submittedRef.current = false;
      const timer = window.setTimeout(() => {
        formRef.current?.reset();
        setOpen(false);
      }, 0);
      return () => window.clearTimeout(timer);
    }
  }, [pending, state]);

  return (
    <details
      open={open}
      onToggle={(event) => setOpen(event.currentTarget.open)}
      className="rounded-md border"
      style={{ borderColor: "var(--border-faint)" }}
    >
      <summary
        className="cursor-pointer list-none px-3 py-2 text-[0.75rem] font-medium"
        style={{ color: "var(--text-muted)" }}
      >
        Edit project
      </summary>
      <form ref={formRef} action={formAction} className="space-y-3 px-3 pb-3">
        <input type="hidden" name="id" value={project.id} />
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label htmlFor={`project-name-${project.id}`} className="block text-[0.75rem] font-medium" style={{ color: "var(--text-muted)" }}>
              Name
            </label>
            <input id={`project-name-${project.id}`} name="name" defaultValue={project.name} required className="field" />
          </div>
          <div className="space-y-1.5">
            <label htmlFor={`project-status-${project.id}`} className="block text-[0.75rem] font-medium" style={{ color: "var(--text-muted)" }}>
              Status
            </label>
            <select id={`project-status-${project.id}`} name="status" defaultValue={project.status} className="field">
              {PROJECT_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {PROJECT_STATUS_LABELS[status]}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label htmlFor={`project-bucket-${project.id}`} className="block text-[0.75rem] font-medium" style={{ color: "var(--text-muted)" }}>
              Bucket
            </label>
            <input id={`project-bucket-${project.id}`} name="bucket" defaultValue={project.bucket ?? ""} className="field" />
          </div>
          <div className="space-y-1.5">
            <label htmlFor={`project-targetDate-${project.id}`} className="block text-[0.75rem] font-medium" style={{ color: "var(--text-muted)" }}>
              Target date
            </label>
            <input id={`project-targetDate-${project.id}`} name="targetDate" type="date" defaultValue={project.targetDate ? project.targetDate.toISOString().slice(0, 10) : ""} className="field" />
          </div>
        </div>
        <div className="space-y-1.5">
          <label htmlFor={`project-summary-${project.id}`} className="block text-[0.75rem] font-medium" style={{ color: "var(--text-muted)" }}>
            Outcome
          </label>
          <input id={`project-summary-${project.id}`} name="summary" defaultValue={project.summary ?? ""} className="field" />
        </div>
        <div className="space-y-1.5">
          <label htmlFor={`project-nextMilestone-${project.id}`} className="block text-[0.75rem] font-medium" style={{ color: "var(--text-muted)" }}>
            Next milestone
          </label>
          <input id={`project-nextMilestone-${project.id}`} name="nextMilestone" defaultValue={project.nextMilestone ?? ""} className="field" />
        </div>
        <div className="space-y-1.5">
          <label htmlFor={`project-notes-${project.id}`} className="block text-[0.75rem] font-medium" style={{ color: "var(--text-muted)" }}>
            Notes
          </label>
          <textarea id={`project-notes-${project.id}`} name="notes" defaultValue={project.notes ?? ""} className="field min-h-[96px] resize-y" />
        </div>
        {state?.error ? (
          <p className="rounded-md px-3 py-2 text-[0.8125rem]" style={{ background: "var(--accent-tint)", color: "var(--accent-strong)", border: "1px solid var(--accent-tint-strong)" }}>
            {state.error}
          </p>
        ) : null}
        <div className="flex justify-end">
          <button type="submit" disabled={pending} className="btn-ink">
            {pending ? "Saving..." : "Save project"}
          </button>
        </div>
      </form>
      <div
        className="flex items-center justify-between gap-3 border-t px-3 py-2.5"
        style={{ borderColor: "var(--border-faint)" }}
      >
        <p className="text-[0.75rem]" style={{ color: "var(--text-faint)" }}>
          You&apos;ll choose what happens to linked tasks.
        </p>
        <DeleteProjectButton
          projectId={project.id}
          projectName={project.name}
          taskCount={project.openTaskCount + project.doneTaskCount}
        />
      </div>
    </details>
  );
}
