"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import {
  createTaskAction,
  renameTaskAction,
  setTaskTodayAction,
  toggleTaskAction,
} from "../actions";
import type { ProjectTaskRecord } from "@/lib/services/projects";

export function TaskList({
  projectId,
  tasks,
}: {
  projectId: string;
  tasks: ProjectTaskRecord[];
}) {
  const today = tasks.filter((task) => task.isToday && !task.done);
  const backlog = tasks.filter((task) => !task.isToday && !task.done);
  const done = tasks.filter((task) => task.done);

  return (
    <div className="space-y-5">
      <Section
        title="Today"
        hint="Pulled into today's focus"
        projectId={projectId}
        tasks={today}
        emptyLabel="Nothing pulled into today yet."
        addAsToday
      />
      <Section
        title="Backlog"
        hint="Everything else"
        projectId={projectId}
        tasks={backlog}
        emptyLabel="Backlog is clear."
        addAsToday={false}
      />
      {done.length > 0 ? (
        <details>
          <summary
            className="cursor-pointer list-none text-[0.75rem] font-medium"
            style={{ color: "var(--text-faint)" }}
          >
            {done.length} completed
          </summary>
          <ol className="mt-2 space-y-1">
            {done.map((task) => (
              <TaskRow key={task.id} projectId={projectId} task={task} />
            ))}
          </ol>
        </details>
      ) : null}
    </div>
  );
}

function Section({
  title,
  hint,
  projectId,
  tasks,
  emptyLabel,
  addAsToday,
}: {
  title: string;
  hint: string;
  projectId: string;
  tasks: ProjectTaskRecord[];
  emptyLabel: string;
  addAsToday: boolean;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-[0.75rem] font-semibold uppercase tracking-wider" style={{ color: "var(--text-faint)" }}>
          {title}
        </p>
        <span className="text-[0.6875rem]" style={{ color: "var(--text-ghost)" }}>
          {hint}
        </span>
      </div>
      {tasks.length === 0 ? (
        <p className="text-[0.8125rem]" style={{ color: "var(--text-faint)" }}>
          {emptyLabel}
        </p>
      ) : (
        <ol className="space-y-1">
          {tasks.map((task) => (
            <TaskRow key={task.id} projectId={projectId} task={task} />
          ))}
        </ol>
      )}
      <QuickAdd projectId={projectId} asToday={addAsToday} />
    </div>
  );
}

function TaskRow({ projectId, task }: { projectId: string; task: ProjectTaskRecord }) {
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(task.title);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  function saveRename() {
    const next = draft.trim();
    setEditing(false);
    if (next && next !== task.title) {
      startTransition(() => renameTaskAction(projectId, task.id, next));
    } else {
      setDraft(task.title);
    }
  }

  return (
    <li
      className="group flex items-center gap-2.5 rounded-md px-2 py-1.5"
      style={{ opacity: pending ? 0.55 : 1 }}
    >
      <button
        type="button"
        onClick={() =>
          startTransition(() => toggleTaskAction(projectId, task.id, !task.done))
        }
        aria-label={task.done ? "Mark not done" : "Mark done"}
        className="flex h-[1.15rem] w-[1.15rem] shrink-0 items-center justify-center rounded-full border transition-colors"
        style={{
          borderColor: task.done ? "#10b981" : "var(--border)",
          background: task.done ? "#10b981" : "transparent",
        }}
      >
        {task.done ? (
          <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M2.5 6.2l2.3 2.3 4.7-5" />
          </svg>
        ) : null}
      </button>

      {editing ? (
        <input
          ref={inputRef}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={saveRename}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              saveRename();
            } else if (event.key === "Escape") {
              setDraft(task.title);
              setEditing(false);
            }
          }}
          className="field"
          style={{ minHeight: "2rem", paddingBlock: "0.25rem" }}
        />
      ) : (
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="min-w-0 flex-1 truncate text-left text-[0.875rem]"
          style={{
            color: task.done ? "var(--text-faint)" : "var(--text)",
            textDecoration: task.done ? "line-through" : undefined,
          }}
        >
          {task.title}
        </button>
      )}

      {!task.done && !editing ? (
        <button
          type="button"
          onClick={() =>
            startTransition(() => setTaskTodayAction(projectId, task.id, !task.isToday))
          }
          className="shrink-0 rounded px-1.5 py-0.5 text-[0.6875rem] font-medium opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100 [@media(pointer:coarse)]:opacity-100"
          style={{ background: "var(--bg-tint)", color: "var(--text-muted)" }}
        >
          {task.isToday ? "← Backlog" : "→ Today"}
        </button>
      ) : null}
    </li>
  );
}

function QuickAdd({ projectId, asToday }: { projectId: string; asToday: boolean }) {
  const [value, setValue] = useState("");
  const [pending, startTransition] = useTransition();

  function submit() {
    const title = value.trim();
    if (!title) return;
    setValue("");
    startTransition(() => createTaskAction(projectId, title, asToday));
  }

  return (
    <div className="flex items-center gap-2 pl-1">
      <span style={{ color: "var(--text-ghost)" }}>+</span>
      <input
        value={value}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            submit();
          }
        }}
        placeholder={asToday ? "Add a task for today…" : "Add a backlog task…"}
        className="flex-1 bg-transparent text-[0.875rem] outline-none"
        style={{ color: "var(--text)", minHeight: "1.75rem" }}
        disabled={pending}
      />
    </div>
  );
}
