"use client";

// Inline, no-modal task capture from a project card. Collapsed to a single
// "+ Add task" affordance; expands to a text input that posts the title to
// quickAddProjectTaskAction and clears for the next one.

import { useRef, useState, useTransition } from "react";
import { quickAddProjectTaskAction } from "./actions";

export function QuickAddTask({ projectId }: { projectId: string }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  function submit() {
    const trimmed = title.trim();
    if (!trimmed || pending) return;
    startTransition(async () => {
      const formData = new FormData();
      formData.set("projectId", projectId);
      formData.set("title", trimmed);
      await quickAddProjectTaskAction(formData);
      setTitle("");
      inputRef.current?.focus();
    });
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => {
          setOpen(true);
          requestAnimationFrame(() => inputRef.current?.focus());
        }}
        className="btn-ghost text-[0.8125rem]"
        style={{ color: "var(--text-muted)" }}
      >
        + Add task
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <input
        ref={inputRef}
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            submit();
          } else if (event.key === "Escape") {
            setOpen(false);
            setTitle("");
          }
        }}
        placeholder="New task…"
        className="field flex-1"
        aria-label="New task title"
      />
      <button
        type="button"
        onClick={submit}
        disabled={pending || !title.trim()}
        className="btn-ink"
      >
        {pending ? "Adding…" : "Add"}
      </button>
      <button
        type="button"
        onClick={() => {
          setOpen(false);
          setTitle("");
        }}
        className="btn-icon"
        aria-label="Cancel adding task"
        style={{ color: "var(--text-faint)" }}
      >
        ×
      </button>
    </div>
  );
}
