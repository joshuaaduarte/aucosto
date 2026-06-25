"use client";

// Edit a logged entry or manually add one that the tracker missed.
// One shared modal, two entry points: the pencil on each recent-session row
// (edit) and the "Add entry" button in the section header (add).

import { useActionState, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { PRESET_TIME_CATEGORIES } from "@/lib/time-categories";
import { fillIsoWindowFields } from "@/lib/wall-clock";
import { MentionTextarea } from "@/components/mention-textarea";
import { saveEntryAction, type EntryFormState } from "./actions";
import { useBodyScrollLock } from "../_components/use-body-scroll-lock";

export type EditableEntry = {
  id: string;
  label: string;
  category: string | null;
  doItemId: string | null;
  notes: string | null;
  startedAtIso: string;
  endedAtIso: string;
};

export type LinkableTask = {
  id: string;
  title: string;
};

function dateValue(iso: string) {
  return new Date(iso).toLocaleDateString("en-CA");
}

function timeValue(iso: string) {
  return new Date(iso).toLocaleTimeString("en-CA", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export function EntryEditButton({
  entry,
  tasks = [],
}: {
  entry: EditableEntry;
  tasks?: LinkableTask[];
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Edit entry"
        title="Edit"
        className="btn-icon self-center opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100 [@media(pointer:coarse)]:opacity-100"
      >
        <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M9.1 1.9l2 2L4.6 10.4l-2.5.5.5-2.5z" />
        </svg>
      </button>
      {open ? (
        <EntryModal
          title={`Edit ${entry.label}`}
          entry={entry}
          tasks={tasks}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </>
  );
}

export function AddEntryButton({ tasks = [] }: { tasks?: LinkableTask[] }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="btn-ghost">
        Add entry
      </button>
      {open ? (
        <EntryModal
          title="Log a missed session"
          entry={null}
          tasks={tasks}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </>
  );
}

const initialState: EntryFormState = undefined;

/** Wall-clock prefill for a brand-new entry (e.g. dragged out on the calendar). */
export type EntryDefaults = {
  date: string;
  start: string;
  end: string;
  label?: string;
  category?: string;
};

// Exported for reuse: the calendar timeline opens this same modal when a
// tracked block is tapped, or when a time range is dragged out on the grid
// (passing `defaults` to prefill the date/start/end of a new entry).
export function EntryModal({
  title,
  entry,
  defaults,
  tasks,
  onClose,
}: {
  title: string;
  entry: EditableEntry | null;
  /** Prefill for a new entry; ignored when editing an existing `entry`. */
  defaults?: EntryDefaults;
  tasks: LinkableTask[];
  onClose: () => void;
}) {
  const [state, formAction, pending] = useActionState(
    saveEntryAction,
    initialState,
  );
  const [category, setCategory] = useState(
    entry?.category ?? defaults?.category ?? "",
  );
  const labelRef = useRef<HTMLInputElement>(null);
  const [doItemId, setDoItemId] = useState(entry?.doItemId ?? "");
  const [taskQuery, setTaskQuery] = useState("");
  const closedRef = useRef(false);
  useBodyScrollLock();

  const linkedTask = tasks.find((task) => task.id === doItemId) ?? null;
  const filteredTasks = taskQuery.trim()
    ? tasks.filter((task) =>
        task.title.toLowerCase().includes(taskQuery.trim().toLowerCase()),
      )
    : tasks;

  useEffect(() => {
    if (state && "ok" in state && state.ok && !closedRef.current) {
      closedRef.current = true;
      onClose();
    }
  }, [state, onClose]);

  // Dragging out a range prefills the times — drop the cursor on the label so
  // the user can name the session and submit without reaching for the mouse.
  useEffect(() => {
    if (!entry && defaults) labelRef.current?.focus();
  }, [entry, defaults]);

  const todayValue = new Date().toLocaleDateString("en-CA");

  // Portal to <body>: ancestor transforms/filters (e.g. animated page
  // sections) would otherwise become the containing block for this
  // fixed-position backdrop and drag the modal into the document flow.
  return createPortal(
    <div
      className="calendar-modal-backdrop"
      role="presentation"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="entry-editor-title"
        className="calendar-modal"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p
              className="text-[0.6875rem] font-semibold uppercase tracking-wider"
              style={{ color: "var(--text-faint)" }}
            >
              {entry ? "Edit entry" : "Add entry"}
            </p>
            <h2
              id="entry-editor-title"
              className="mt-1 text-[1.125rem] font-semibold tracking-tight"
              style={{ color: "var(--text)" }}
            >
              {title}
            </h2>
          </div>
          <button
            type="button"
            className="btn-icon h-8 w-8 rounded-full border"
            style={{ borderColor: "var(--border-faint)" }}
            onClick={onClose}
            aria-label="Close entry editor"
          >
            ×
          </button>
        </div>

        <form
          action={formAction}
          className="mt-5 space-y-4"
          onSubmit={(event) => {
            // Convert the wall-clock fields to absolute timestamps HERE, in
            // the browser's timezone. Sending naive "date + time" strings to
            // the server would make the server's timezone decide what they
            // mean — which shifts every saved time when the two differ.
            fillIsoWindowFields(event.currentTarget);
          }}
        >
          {entry ? <input type="hidden" name="id" value={entry.id} /> : null}
          <input type="hidden" name="startsAtIso" defaultValue="" />
          <input type="hidden" name="endsAtIso" defaultValue="" />

          <div className="grid gap-3 sm:grid-cols-[1.6fr_1fr]">
            <div className="space-y-1.5">
              <label
                className="block text-[0.75rem] font-medium"
                style={{ color: "var(--text-muted)" }}
                htmlFor="entry-editor-label"
              >
                Session
              </label>
              <input
                ref={labelRef}
                id="entry-editor-label"
                name="label"
                required
                defaultValue={entry?.label ?? defaults?.label ?? ""}
                placeholder="What was it?"
                className="field"
              />
            </div>
            <div className="space-y-1.5">
              <label
                className="block text-[0.75rem] font-medium"
                style={{ color: "var(--text-muted)" }}
                htmlFor="entry-editor-category"
              >
                Category
              </label>
              <input
                id="entry-editor-category"
                name="category"
                value={category}
                onChange={(event) => setCategory(event.target.value)}
                placeholder="Optional — type or tap below"
                className="field"
              />
            </div>
          </div>

          {/* Preset chips: one swipeable row on phones, wrapping on desktop.
              Tappable — no reliance on datalist, which iOS barely surfaces. */}
          <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 sm:flex-wrap sm:overflow-visible">
            {PRESET_TIME_CATEGORIES.map((preset) => {
              const active = category.trim().toLowerCase() === preset.id;
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => setCategory(active ? "" : preset.id)}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded px-2 py-1.5 text-[0.75rem] font-medium transition-colors"
                  style={{
                    background: active ? "var(--bg-tint-strong)" : "var(--bg-tint)",
                    color: active ? "var(--text)" : "var(--text-muted)",
                    boxShadow: active ? `inset 0 0 0 1px ${preset.color}` : undefined,
                  }}
                >
                  <span
                    className="h-1.5 w-1.5 rounded-full"
                    style={{ background: preset.color }}
                    aria-hidden
                  />
                  {preset.label}
                </button>
              );
            })}
          </div>

          {/* Optional task link — credits the task's tracked time. */}
          <input type="hidden" name="doItemId" value={doItemId} />
          {tasks.length > 0 || doItemId ? (
            <div className="space-y-1.5">
              <p
                className="text-[0.75rem] font-medium"
                style={{ color: "var(--text-muted)" }}
              >
                Linked task{" "}
                <span style={{ color: "var(--text-faint)" }}>
                  (optional — credits its tracked time)
                </span>
              </p>
              {doItemId ? (
                <div
                  className="flex items-center justify-between gap-2 rounded-md border px-3 py-2"
                  style={{ borderColor: "var(--border-faint)" }}
                >
                  <span
                    className="truncate text-[0.8125rem] font-medium"
                    style={{ color: "var(--text)" }}
                  >
                    {linkedTask?.title ?? "Linked task"}
                  </span>
                  <button
                    type="button"
                    className="btn-ghost h-7 shrink-0 px-2 text-[0.6875rem]"
                    onClick={() => setDoItemId("")}
                  >
                    Unlink
                  </button>
                </div>
              ) : (
                <>
                  <input
                    type="text"
                    value={taskQuery}
                    onChange={(event) => setTaskQuery(event.target.value)}
                    placeholder="Search open tasks..."
                    className="field"
                  />
                  {filteredTasks.length > 0 ? (
                    <ul
                      className="max-h-36 space-y-1 overflow-y-auto rounded-md border p-1"
                      style={{ borderColor: "var(--border-faint)" }}
                    >
                      {filteredTasks.map((task) => (
                        <li key={task.id}>
                          <button
                            type="button"
                            onClick={() => setDoItemId(task.id)}
                            className="w-full truncate rounded px-2 py-1.5 text-left text-[0.8125rem] transition-colors hover:bg-bg-hover"
                            style={{ color: "var(--text)" }}
                          >
                            {task.title}
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p
                      className="text-[0.75rem]"
                      style={{ color: "var(--text-faint)" }}
                    >
                      No open tasks match.
                    </p>
                  )}
                </>
              )}
            </div>
          ) : null}

          {/* Phone: date full-width, start/end side by side. Desktop: 3-up. */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div className="col-span-2 space-y-1.5 sm:col-span-1">
              <label
                className="block text-[0.75rem] font-medium"
                style={{ color: "var(--text-muted)" }}
                htmlFor="entry-editor-date"
              >
                Date
              </label>
              <input
                id="entry-editor-date"
                name="date"
                type="date"
                required
                defaultValue={
                  entry
                    ? dateValue(entry.startedAtIso)
                    : (defaults?.date ?? todayValue)
                }
                className="field"
              />
            </div>
            <div className="space-y-1.5">
              <label
                className="block text-[0.75rem] font-medium"
                style={{ color: "var(--text-muted)" }}
                htmlFor="entry-editor-start"
              >
                Start
              </label>
              <input
                id="entry-editor-start"
                name="start"
                type="time"
                required
                defaultValue={
                  entry
                    ? timeValue(entry.startedAtIso)
                    : (defaults?.start ?? "")
                }
                className="field"
              />
            </div>
            <div className="space-y-1.5">
              <label
                className="block text-[0.75rem] font-medium"
                style={{ color: "var(--text-muted)" }}
                htmlFor="entry-editor-end"
              >
                End
              </label>
              <input
                id="entry-editor-end"
                name="end"
                type="time"
                required
                defaultValue={
                  entry ? timeValue(entry.endedAtIso) : (defaults?.end ?? "")
                }
                className="field"
              />
            </div>
          </div>

          <p className="text-[0.75rem]" style={{ color: "var(--text-faint)" }}>
            An end time earlier than the start rolls into the next day.
          </p>

          {/* Quick thought on the session — pulled into the day's
              reflection snapshot. */}
          <div className="space-y-1.5">
            <label
              className="block text-[0.75rem] font-medium"
              style={{ color: "var(--text-muted)" }}
              htmlFor="entry-editor-notes"
            >
              Note{" "}
              <span style={{ color: "var(--text-faint)" }}>(optional)</span>
            </label>
            <MentionTextarea
              id="entry-editor-notes"
              name="notes"
              defaultValue={entry?.notes ?? ""}
              placeholder="A quick thought about this session..."
              className="field min-h-[64px] resize-y"
              helperText="Type @ to link a person · @insight to capture a takeaway"
            />
          </div>

          {state && "error" in state && state.error ? (
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

          <div
            className="sticky bottom-0 -mx-4 mt-2 flex items-center justify-between gap-3 border-t px-4 pb-1 pt-3 sm:-mx-5 sm:px-5"
            style={{
              background: "var(--bg-page)",
              borderColor: "var(--border-faint)",
            }}
          >
            <button
              type="button"
              className="btn-ghost"
              disabled={pending}
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={pending}
              className="btn-ink flex-1 sm:flex-none"
            >
              {pending ? "Saving..." : entry ? "Save entry" : "Add entry"}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}
