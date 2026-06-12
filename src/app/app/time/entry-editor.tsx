"use client";

// Edit a logged entry or manually add one that the tracker missed.
// One shared modal, two entry points: the pencil on each recent-session row
// (edit) and the "Add entry" button in the section header (add).

import { useActionState, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { PRESET_TIME_CATEGORIES } from "@/lib/time-categories";
import { fillIsoWindowFields } from "@/lib/wall-clock";
import { saveEntryAction, type EntryFormState } from "./actions";
import { useBodyScrollLock } from "../_components/use-body-scroll-lock";

export type EditableEntry = {
  id: string;
  label: string;
  category: string | null;
  startedAtIso: string;
  endedAtIso: string;
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

export function EntryEditButton({ entry }: { entry: EditableEntry }) {
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
          onClose={() => setOpen(false)}
        />
      ) : null}
    </>
  );
}

export function AddEntryButton() {
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
          onClose={() => setOpen(false)}
        />
      ) : null}
    </>
  );
}

const initialState: EntryFormState = undefined;

function EntryModal({
  title,
  entry,
  onClose,
}: {
  title: string;
  entry: EditableEntry | null;
  onClose: () => void;
}) {
  const [state, formAction, pending] = useActionState(
    saveEntryAction,
    initialState,
  );
  const [category, setCategory] = useState(entry?.category ?? "");
  const closedRef = useRef(false);
  useBodyScrollLock();

  useEffect(() => {
    if (state && "ok" in state && state.ok && !closedRef.current) {
      closedRef.current = true;
      onClose();
    }
  }, [state, onClose]);

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
            x
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
                id="entry-editor-label"
                name="label"
                required
                defaultValue={entry?.label ?? ""}
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
                defaultValue={entry ? dateValue(entry.startedAtIso) : todayValue}
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
                defaultValue={entry ? timeValue(entry.startedAtIso) : ""}
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
                defaultValue={entry ? timeValue(entry.endedAtIso) : ""}
                className="field"
              />
            </div>
          </div>

          <p className="text-[0.75rem]" style={{ color: "var(--text-faint)" }}>
            An end time earlier than the start rolls into the next day.
          </p>

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
