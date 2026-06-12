"use client";

import { useState, useTransition } from "react";
import {
  DO_BUCKET_SUGGESTIONS,
  DO_LANE_LABELS,
  DO_LANES,
  DO_STATUSES,
  DO_STATUS_LABELS,
  formatMinutes,
} from "@/lib/do";
import type { DoItemSummary } from "@/lib/services/do";
import {
  completeDoItemAction,
  deleteDoItemAction,
  reopenDoItemAction,
  startDoItemTimerAction,
  updateDoItemAction,
} from "./actions";
import { StartTimerButton } from "../_components/start-timer-button";
import { useBodyScrollLock } from "../_components/use-body-scroll-lock";
import { ScheduleTaskModal } from "./schedule-modal";

function DetailRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div
      className="rounded-md border px-3 py-2.5"
      style={{ borderColor: "var(--border-faint)" }}
    >
      <p
        className="text-[0.6875rem] font-semibold uppercase tracking-wider"
        style={{ color: "var(--text-faint)" }}
      >
        {label}
      </p>
      <p className="mt-1 text-[0.875rem] font-medium" style={{ color: "var(--text)" }}>
        {value}
      </p>
    </div>
  );
}

function CompletionModal({
  item,
  onClose,
}: {
  item: DoItemSummary;
  onClose: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  useBodyScrollLock();

  return (
    <div
      className="calendar-modal-backdrop"
      role="presentation"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={`do-complete-title-${item.id}`}
        className="calendar-modal"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p
              className="text-[0.6875rem] font-semibold uppercase tracking-wider"
              style={{ color: "var(--text-faint)" }}
            >
              Mark done
            </p>
            <h2
              id={`do-complete-title-${item.id}`}
              className="mt-1 text-[1.125rem] font-semibold tracking-tight"
              style={{ color: "var(--text)" }}
            >
              Close the loop on {item.title}
            </h2>
            <p className="mt-2 text-[0.8125rem]" style={{ color: "var(--text-muted)" }}>
              {item.habitTitle
                ? `Capture how long it actually took. This task is linked to ${item.habitTitle}, so marking it done will also give the habit credit if it still needs it.`
                : "Capture how long it actually took so future estimates get smarter."}
            </p>
          </div>

          <button
            type="button"
            className="btn-icon h-8 w-8 rounded-full border"
            style={{ borderColor: "var(--border-faint)" }}
            onClick={onClose}
            aria-label="Close done modal"
          >
            x
          </button>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <DetailRow
            label="Estimate"
            value={item.estimatedMinutes ? formatMinutes(item.estimatedMinutes) : "N/A"}
          />
          <DetailRow
            label="Tracked"
            value={item.trackedMinutes > 0 ? formatMinutes(item.trackedMinutes) : "N/A"}
          />
          <DetailRow
            label="Scheduled"
            value={item.scheduledMinutes > 0 ? formatMinutes(item.scheduledMinutes) : "N/A"}
          />
        </div>

        <form
          action={(formData) => {
            startTransition(async () => {
              await completeDoItemAction(formData);
              onClose();
            });
          }}
          className="mt-5 space-y-4"
        >
          <input type="hidden" name="id" value={item.id} />
          <div className="space-y-1.5">
            <label
              className="block text-[0.75rem] font-medium"
              htmlFor={`actual-${item.id}`}
              style={{ color: "var(--text-muted)" }}
            >
              Actual minutes <span style={{ color: "var(--text-faint)" }}>(optional)</span>
            </label>
            <input
              id={`actual-${item.id}`}
              name="actualMinutes"
              type="number"
              min={5}
              step={5}
              inputMode="numeric"
              defaultValue={item.effectiveActualMinutes ?? ""}
              className="field"
              placeholder={item.estimatedMinutes ? String(item.estimatedMinutes) : "45"}
            />
            <p className="text-[0.75rem]" style={{ color: "var(--text-faint)" }}>
              Leave it blank if you do not want to record the final time yet.
            </p>
          </div>

          <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
            <button type="button" className="btn-ghost w-full sm:w-auto" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" disabled={isPending} className="btn-ink w-full sm:w-auto">
              {isPending ? "Saving..." : "Mark done"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function DoItemCard({
  item,
  projects,
}: {
  item: DoItemSummary;
  projects: Array<{ id: string; name: string }>;
}) {
  const [completeOpen, setCompleteOpen] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);

  return (
    <>
      <li
        className="rounded-md border p-3 sm:p-3.5"
        style={{ borderColor: "var(--border-faint)" }}
      >
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p
                  className="text-[0.9375rem] font-medium"
                  style={{ color: "var(--text)" }}
                >
                  {item.title}
                </p>
                {item.bucket ? <span className="pill">{item.bucket}</span> : null}
                {item.projectName ? <span className="pill">{item.projectName}</span> : null}
                {item.habitTitle ? <span className="pill">Linked habit</span> : null}
                <span className="pill">
                  {DO_LANE_LABELS[item.lane as keyof typeof DO_LANE_LABELS] ?? item.lane}
                </span>
                <span className="pill">{DO_STATUS_LABELS[item.status]}</span>
              </div>
              <p
                className="mt-1 text-[0.75rem]"
                style={{ color: "var(--text-faint)" }}
              >
                Est. {formatMinutes(item.estimatedMinutes)}
                {item.habitTitle ? ` · From ${item.habitTitle}` : ""}
                {item.scheduledMinutes > 0
                  ? ` · Scheduled ${formatMinutes(item.scheduledMinutes)}`
                  : ""}
                {item.trackedMinutes > 0
                  ? ` · Tracked ${formatMinutes(item.trackedMinutes)}`
                  : ""}
                {item.effectiveActualMinutes
                  ? ` · Actual ${formatMinutes(item.effectiveActualMinutes)}`
                  : ""}
              </p>
              {item.notes ? (
                <p
                  className="mt-1.5 whitespace-pre-line text-[0.8125rem]"
                  style={{ color: "var(--text-muted)" }}
                >
                  {item.notes}
                </p>
              ) : null}
            </div>

            <div className="grid grid-cols-2 gap-1.5 sm:flex sm:flex-wrap sm:justify-end">
              {item.status !== "done" ? (
                <StartTimerButton id={item.id} action={startDoItemTimerAction} />
              ) : null}

              {item.status !== "done" && item.scheduledMinutes === 0 ? (
                <button
                  type="button"
                  className="btn-ghost h-8 w-full px-2.5 text-[0.75rem]"
                  onClick={() => setScheduleOpen(true)}
                >
                  Schedule
                </button>
              ) : null}

              {item.status !== "done" ? (
                <button
                  type="button"
                  className="btn-ink h-8 w-full px-2.5 text-[0.75rem]"
                  onClick={() => setCompleteOpen(true)}
                >
                  Done
                </button>
              ) : (
                <form action={reopenDoItemAction} className="contents sm:block">
                  <input type="hidden" name="id" value={item.id} />
                  <button className="btn-ghost h-8 w-full px-2.5 text-[0.75rem]" type="submit">
                    Reopen
                  </button>
                </form>
              )}

              <form action={deleteDoItemAction} className="contents sm:block">
                <input type="hidden" name="id" value={item.id} />
                <button className="btn-ghost col-span-2 h-8 w-full px-2.5 text-[0.75rem] sm:col-span-1" type="submit">
                  Delete
                </button>
              </form>
              {item.habitId ? (
                <a href="/app/habits" className="btn-ghost col-span-2 h-8 w-full px-2.5 text-[0.75rem] sm:col-span-1">
                  Open habit
                </a>
              ) : null}
            </div>
          </div>

          <details
            className="rounded-md border"
            style={{ borderColor: "var(--border-faint)" }}
          >
            <summary
              className="cursor-pointer list-none px-3 py-2 text-[0.75rem] font-medium"
              style={{ color: "var(--text-muted)" }}
            >
              Edit and learn
            </summary>
            <form action={updateDoItemAction} className="space-y-3 px-3 pb-3">
              <input type="hidden" name="id" value={item.id} />
              <div className="space-y-1.5">
                <label
                  className="block text-[0.75rem] font-medium"
                  htmlFor={`title-${item.id}`}
                  style={{ color: "var(--text-muted)" }}
                >
                  Title
                </label>
                <input
                  id={`title-${item.id}`}
                  name="title"
                  defaultValue={item.title}
                  required
                  className="field"
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-5">
                <div className="space-y-1.5">
                  <label
                    className="block text-[0.75rem] font-medium"
                    htmlFor={`lane-${item.id}`}
                    style={{ color: "var(--text-muted)" }}
                  >
                    When
                  </label>
                  <select id={`lane-${item.id}`} name="lane" defaultValue={item.lane} className="field">
                    {DO_LANES.map((lane) => (
                      <option key={lane} value={lane}>
                        {DO_LANE_LABELS[lane]}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label
                    className="block text-[0.75rem] font-medium"
                    htmlFor={`status-${item.id}`}
                    style={{ color: "var(--text-muted)" }}
                  >
                    Status
                  </label>
                  <select id={`status-${item.id}`} name="status" defaultValue={item.status} className="field">
                    {DO_STATUSES.map((status) => (
                      <option key={status} value={status}>
                        {DO_STATUS_LABELS[status]}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label
                    className="block text-[0.75rem] font-medium"
                    htmlFor={`estimate-${item.id}`}
                    style={{ color: "var(--text-muted)" }}
                  >
                    Estimate
                  </label>
                  <input
                    id={`estimate-${item.id}`}
                    name="estimatedMinutes"
                    type="number"
                    min={5}
                    step={5}
                    defaultValue={item.estimatedMinutes ?? ""}
                    className="field"
                  />
                </div>
                <div className="space-y-1.5">
                  <label
                    className="block text-[0.75rem] font-medium"
                    htmlFor={`bucket-${item.id}`}
                    style={{ color: "var(--text-muted)" }}
                  >
                    Bucket
                  </label>
                  <input
                    id={`bucket-${item.id}`}
                    name="bucket"
                    list={`bucket-suggestions-${item.id}`}
                    defaultValue={item.bucket ?? ""}
                    className="field"
                  />
                  <datalist id={`bucket-suggestions-${item.id}`}>
                    {DO_BUCKET_SUGGESTIONS.map((suggestion) => (
                      <option key={suggestion} value={suggestion} />
                    ))}
                  </datalist>
                </div>
                <div className="space-y-1.5">
                  <label
                    className="block text-[0.75rem] font-medium"
                    htmlFor={`learned-${item.id}`}
                    style={{ color: "var(--text-muted)" }}
                  >
                    Actual
                  </label>
                  <input
                    id={`learned-${item.id}`}
                    name="actualMinutes"
                    type="number"
                    min={5}
                    step={5}
                    defaultValue={item.actualMinutes ?? ""}
                    className="field"
                  />
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label
                    className="block text-[0.75rem] font-medium"
                    htmlFor={`project-${item.id}`}
                    style={{ color: "var(--text-muted)" }}
                  >
                    Project
                  </label>
                  <select
                    id={`project-${item.id}`}
                    name="projectId"
                    defaultValue={item.projectId ?? ""}
                    className="field"
                  >
                    <option value="">No project</option>
                    {projects.map((project) => (
                      <option key={project.id} value={project.id}>
                        {project.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label
                    className="block text-[0.75rem] font-medium"
                    htmlFor={`notes-${item.id}`}
                    style={{ color: "var(--text-muted)" }}
                  >
                    Notes
                  </label>
                  <input
                    id={`notes-${item.id}`}
                    name="notes"
                    defaultValue={item.notes ?? ""}
                    className="field"
                  />
                </div>
                <div
                  className="rounded-md border px-3 py-2.5"
                  style={{ borderColor: "var(--border-faint)" }}
                >
                  <p
                    className="text-[0.6875rem] font-semibold uppercase tracking-wider"
                    style={{ color: "var(--text-faint)" }}
                  >
                    Planned vs actual
                  </p>
                  <p className="mt-1 text-[0.8125rem]" style={{ color: "var(--text-muted)" }}>
                    {item.scheduledCount > 0
                      ? `${item.scheduledCount} block${item.scheduledCount === 1 ? "" : "s"} scheduled`
                      : "Not on calendar yet"}
                  </p>
                  <p className="mt-1 text-[0.8125rem]" style={{ color: "var(--text-muted)" }}>
                    {item.trackedMinutes > 0
                      ? `${formatMinutes(item.trackedMinutes)} tracked so far`
                      : "Timer has not touched this yet"}
                  </p>
                </div>
              </div>

              <div className="flex justify-end">
                <button type="submit" className="btn-ink">
                  Save changes
                </button>
              </div>
            </form>
          </details>
        </div>
      </li>

      {completeOpen ? <CompletionModal item={item} onClose={() => setCompleteOpen(false)} /> : null}
      {scheduleOpen ? (
        <ScheduleTaskModal
          item={{
            id: item.id,
            title: item.title,
            estimatedMinutes: item.estimatedMinutes,
          }}
          onClose={() => setScheduleOpen(false)}
        />
      ) : null}
    </>
  );
}
