"use client";

import { useEffect, useState, useTransition } from "react";
import {
  DO_BUCKET_SUGGESTIONS,
  DO_LANE_LABELS,
  DO_LANES,
  DO_STATUSES,
  DO_STATUS_LABELS,
  formatMinutes,
} from "@/lib/do";
import type { DoItemSummary } from "@/lib/services/do";
import { MentionTextarea } from "@/components/mention-textarea";
import { categoryColor } from "@/lib/time-categories";
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

// Two-step delete (consistent with time entries / habits / projects):
// first tap arms "Sure?" for 3s, second tap deletes.
function DeleteTaskButton({ id }: { id: string }) {
  const [pending, startTransition] = useTransition();
  const [armed, setArmed] = useState(false);

  useEffect(() => {
    if (!armed) return;
    const timer = window.setTimeout(() => setArmed(false), 3000);
    return () => window.clearTimeout(timer);
  }, [armed]);

  if (armed) {
    return (
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const formData = new FormData();
            formData.set("id", id);
            await deleteDoItemAction(formData);
          })
        }
        className="btn-ghost h-8 px-2.5 text-[0.75rem] font-semibold sm:col-span-1"
        style={{ color: "var(--accent-strong)", background: "var(--accent-tint)" }}
      >
        {pending ? "Deleting..." : "Sure?"}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setArmed(true)}
      className="btn-ghost h-8 px-2.5 text-[0.75rem]"
    >
      Delete
    </button>
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
  const [open, setOpen] = useState(false);
  const done = item.status === "done";
  // One quiet line instead of a row of pills; "Next"/"Ready" are implied by
  // the lane the card sits in, so only the unusual states are named.
  const meta = [
    item.bucket,
    item.projectName,
    item.habitTitle ? `From ${item.habitTitle}` : null,
    item.status !== "ready" && item.status !== "done" ? DO_STATUS_LABELS[item.status] : null,
    item.estimatedMinutes ? `~${formatMinutes(item.estimatedMinutes)}` : null,
    item.scheduledMinutes > 0 ? `${formatMinutes(item.scheduledMinutes)} scheduled` : null,
    item.trackedMinutes > 0 ? `${formatMinutes(item.trackedMinutes)} tracked` : null,
    done && item.effectiveActualMinutes ? `took ${formatMinutes(item.effectiveActualMinutes)}` : null,
  ].filter((part): part is string => Boolean(part));

  return (
    <>
      <li
        className="rounded-md border"
        style={{ borderColor: open ? "var(--border-soft)" : "var(--border-faint)" }}
      >
        <div className="flex items-center gap-2.5 px-3 py-2.5">
          {done ? (
            <form action={reopenDoItemAction} className="shrink-0">
              <input type="hidden" name="id" value={item.id} />
              <button type="submit" className="list-check" data-checked aria-label={`Reopen ${item.title}`} title="Reopen" />
            </form>
          ) : (
            <button
              type="button"
              className="list-check shrink-0"
              onClick={() => setCompleteOpen(true)}
              aria-label={`Mark ${item.title} done`}
              title="Mark done"
            />
          )}

          <button
            type="button"
            className="min-w-0 flex-1 text-left"
            onClick={() => setOpen((value) => !value)}
            aria-expanded={open}
          >
            <span
              className="block truncate text-[0.9375rem]"
              style={{
                color: done ? "var(--text-faint)" : "var(--text)",
                textDecoration: done ? "line-through" : undefined,
              }}
            >
              {item.title}
            </span>
            {meta.length ? (
              <span className="mt-0.5 flex items-center gap-1.5 truncate text-[0.75rem]" style={{ color: "var(--text-faint)" }}>
                {item.bucket ? (
                  <span
                    className="h-1.5 w-1.5 shrink-0 rounded-full"
                    style={{ background: categoryColor(item.bucket) }}
                    aria-hidden
                  />
                ) : null}
                <span className="truncate">{meta.join(" · ")}</span>
              </span>
            ) : null}
          </button>

          {!done ? (
            <StartTimerButton id={item.id} action={startDoItemTimerAction} compact label={`Start a timer for ${item.title}`} />
          ) : null}
          <button
            type="button"
            className="btn-icon shrink-0"
            onClick={() => setOpen((value) => !value)}
            aria-label={open ? "Close task details" : "Open task details"}
            aria-expanded={open}
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 11 11"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
              style={{ transform: open ? "rotate(180deg)" : undefined, transition: "transform 150ms" }}
            >
              <path d="m3 4 2.5 2.5L8 4" />
            </svg>
          </button>
        </div>

        {open ? (
          <div className="space-y-3 border-t px-3 pb-3 pt-3" style={{ borderColor: "var(--border-faint)" }}>
            {item.notes ? (
              <p className="whitespace-pre-line text-[0.8125rem]" style={{ color: "var(--text-muted)" }}>
                {item.notes}
              </p>
            ) : null}
            <div className="flex flex-wrap gap-1.5">
              {!done && item.scheduledMinutes === 0 ? (
                <button type="button" className="btn-ghost h-8 px-2.5 text-[0.75rem]" onClick={() => setScheduleOpen(true)}>
                  Schedule
                </button>
              ) : null}
              {item.habitId ? (
                <a href="/app/habits" className="btn-ghost h-8 px-2.5 text-[0.75rem]">
                  Open habit
                </a>
              ) : null}
              <DeleteTaskButton id={item.id} />
            </div>
            <form action={updateDoItemAction} className="space-y-3">
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
                    inputMode="numeric"
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
                    inputMode="numeric"
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
                  <MentionTextarea
                    id={`notes-${item.id}`}
                    name="notes"
                    defaultValue={item.notes ?? ""}
                    rows={2}
                    className="field min-h-[64px] resize-y"
                    helperText="Type @ to link a Rolodex person."
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
          </div>
        ) : null}
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
