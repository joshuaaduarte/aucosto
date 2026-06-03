"use client";

import { useState } from "react";
import { formatMinutes } from "@/lib/do";
import { createCalendarBlockAction } from "./actions";

const QUICK_TEMPLATES = [
  { title: "Deep work", start: "09:00", end: "10:30" },
  { title: "Workout", start: "06:00", end: "07:00" },
  { title: "Admin", start: "11:00", end: "11:45" },
  { title: "Wedding planning", start: "19:00", end: "20:00" },
];

export function CalendarQuickAddModal({
  todayDateValue,
  suggestedTasks = [],
  gapSuggestions = [],
}: {
  todayDateValue: string;
  suggestedTasks?: Array<{
    id: string;
    title: string;
    estimatedMinutes: number | null;
  }>;
  gapSuggestions?: Array<{
    taskId: string;
    title: string;
    estimateMinutes: number | null;
    gapLabel: string;
    start: string;
    end: string;
  }>;
}) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [doItemId, setDoItemId] = useState("");
  const [date, setDate] = useState(todayDateValue);
  const [start, setStart] = useState("09:00");
  const [end, setEnd] = useState("10:00");
  const [location, setLocation] = useState("");
  const [notes, setNotes] = useState("");

  function applyTemplate(template: (typeof QUICK_TEMPLATES)[number]) {
    setTitle(template.title);
    setDoItemId("");
    setStart(template.start);
    setEnd(template.end);
  }

  function applySuggestedTask(task: {
    id: string;
    title: string;
    estimatedMinutes: number | null;
  }) {
    setDoItemId(task.id);
    setTitle(task.title);
    if (task.estimatedMinutes && start) {
      const [rawHour = 9, rawMinute = 0] = start.split(":").map(Number);
      const hour = Number.isFinite(rawHour) ? rawHour : 9;
      const minute = Number.isFinite(rawMinute) ? rawMinute : 0;
      const next = new Date();
      next.setHours(hour, minute, 0, 0);
      next.setMinutes(next.getMinutes() + task.estimatedMinutes);
      const endValue = `${String(next.getHours()).padStart(2, "0")}:${String(next.getMinutes()).padStart(2, "0")}`;
      setEnd(endValue);
    }
  }

  function applyGapSuggestion(task: {
    taskId: string;
    title: string;
    estimateMinutes: number | null;
    start: string;
    end: string;
  }) {
    setDoItemId(task.taskId);
    setTitle(task.title);
    setStart(task.start);
    setEnd(task.end);
  }

  function resetForm() {
    setTitle("");
    setDoItemId("");
    setDate(todayDateValue);
    setStart("09:00");
    setEnd("10:00");
    setLocation("");
    setNotes("");
  }

  return (
    <>
      <button
        type="button"
        className="calendar-fab"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls="calendar-quick-add"
      >
        <span className="calendar-fab__plus" aria-hidden="true">
          +
        </span>
        <span>Add block</span>
      </button>

      {open ? (
        <div
          className="calendar-modal-backdrop"
          role="presentation"
          onClick={() => setOpen(false)}
        >
          <div
            id="calendar-quick-add"
            role="dialog"
            aria-modal="true"
            aria-labelledby="calendar-quick-add-title"
            className="calendar-modal"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p
                  className="text-[0.6875rem] font-semibold uppercase tracking-wider"
                  style={{ color: "var(--text-faint)" }}
                >
                  Add a block
                </p>
                <h2
                  id="calendar-quick-add-title"
                  className="mt-1 text-[1.125rem] font-semibold tracking-tight"
                  style={{ color: "var(--text)" }}
                >
                  Plan the next event
                </h2>
              </div>

              <button
                type="button"
                className="btn-icon h-8 w-8 rounded-full border"
                style={{ borderColor: "var(--border-faint)" }}
                onClick={() => setOpen(false)}
                aria-label="Close add block modal"
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

            {suggestedTasks.length > 0 ? (
              <div className="mt-4">
                <p
                  className="text-[0.6875rem] font-semibold uppercase tracking-wider"
                  style={{ color: "var(--text-faint)" }}
                >
                  From your Do List
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {suggestedTasks.map((task) => (
                    <button
                      key={task.id}
                      type="button"
                      className="pill cursor-pointer"
                      onClick={() => applySuggestedTask(task)}
                    >
                      {task.title}
                      {task.estimatedMinutes ? ` · ${formatMinutes(task.estimatedMinutes)}` : ""}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            {gapSuggestions.length > 0 ? (
              <div className="mt-4">
                <p
                  className="text-[0.6875rem] font-semibold uppercase tracking-wider"
                  style={{ color: "var(--text-faint)" }}
                >
                  Fits your open time
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {gapSuggestions.map((suggestion) => (
                    <button
                      key={`${suggestion.taskId}-${suggestion.start}`}
                      type="button"
                      className="pill cursor-pointer"
                      onClick={() => applyGapSuggestion(suggestion)}
                    >
                      {suggestion.title}
                      {suggestion.estimateMinutes
                        ? ` · ${formatMinutes(suggestion.estimateMinutes)}`
                        : ""}
                      {` · ${suggestion.gapLabel}`}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            <form
              action={createCalendarBlockAction}
              className="mt-5 space-y-4"
              onSubmit={() => {
                setOpen(false);
                resetForm();
              }}
            >
              <div className="space-y-1.5">
                <input type="hidden" name="doItemId" value={doItemId} />
                <label
                  className="block text-[0.75rem] font-medium"
                  style={{ color: "var(--text-muted)" }}
                  htmlFor="quick-title"
                >
                  Title
                </label>
                <input
                  id="quick-title"
                  name="title"
                  required
                  placeholder="Deep work, long run, wedding planning..."
                  className="field"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <label
                    className="block text-[0.75rem] font-medium"
                    style={{ color: "var(--text-muted)" }}
                    htmlFor="quick-date"
                  >
                    Date
                  </label>
                  <input
                    id="quick-date"
                    name="date"
                    type="date"
                    required
                    className="field"
                    value={date}
                    onChange={(event) => setDate(event.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <label
                    className="block text-[0.75rem] font-medium"
                    style={{ color: "var(--text-muted)" }}
                    htmlFor="quick-start"
                  >
                    Start
                  </label>
                  <input
                    id="quick-start"
                    name="start"
                    type="time"
                    required
                    className="field"
                    value={start}
                    onChange={(event) => setStart(event.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <label
                    className="block text-[0.75rem] font-medium"
                    style={{ color: "var(--text-muted)" }}
                    htmlFor="quick-end"
                  >
                    End
                  </label>
                  <input
                    id="quick-end"
                    name="end"
                    type="time"
                    required
                    className="field"
                    value={end}
                    onChange={(event) => setEnd(event.target.value)}
                  />
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label
                    className="block text-[0.75rem] font-medium"
                    style={{ color: "var(--text-muted)" }}
                    htmlFor="quick-location"
                  >
                    Location
                  </label>
                  <input
                    id="quick-location"
                    name="location"
                    className="field"
                    value={location}
                    onChange={(event) => setLocation(event.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <label
                    className="block text-[0.75rem] font-medium"
                    style={{ color: "var(--text-muted)" }}
                    htmlFor="quick-notes"
                  >
                    Notes
                  </label>
                  <input
                    id="quick-notes"
                    name="notes"
                    className="field"
                    value={notes}
                    onChange={(event) => setNotes(event.target.value)}
                  />
                </div>
              </div>

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
                <button type="submit" className="btn-ink">
                  Save block
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
