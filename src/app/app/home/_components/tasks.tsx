"use client";

import { useActionState, useState, useTransition } from "react";
import { cadenceLabel, HOME_TASK_PRESETS, homeDueLabel, type HomeTaskKind } from "@/lib/home";
import { archiveTask, completeTask, saveTask } from "../actions";

export type TaskView = {
  id: string;
  kind: string;
  title: string;
  notes: string | null;
  cadenceDays: number;
  daysUntil: number;
  nextDueInput: string;
  assigneeUserId: string | null;
  assigneeName: string | null;
  rotate: boolean;
  lastDone: string | null;
};

export type MemberOption = { userId: string; name: string };

export function TaskList({
  tasks,
  members,
  empty,
}: {
  tasks: TaskView[];
  members: MemberOption[];
  empty: string;
}) {
  if (tasks.length === 0) {
    return (
      <p className="text-[0.8125rem]" style={{ color: "var(--text-faint)" }}>
        {empty}
      </p>
    );
  }
  return (
    <ul className="divide-y rounded-md border" style={{ borderColor: "var(--border-faint)" }}>
      {tasks.map((task) => (
        <TaskRow key={task.id} task={task} members={members} />
      ))}
    </ul>
  );
}

function TaskRow({ task, members }: { task: TaskView; members: MemberOption[] }) {
  const [pending, start] = useTransition();
  const [editing, setEditing] = useState(false);
  const late = task.daysUntil < 0;
  const due = task.daysUntil <= 0;

  if (editing) {
    return (
      <li className="p-3" style={{ borderColor: "var(--border-faint)" }}>
        <TaskForm kind={task.kind as HomeTaskKind} members={members} task={task} onDone={() => setEditing(false)} />
      </li>
    );
  }

  return (
    <li className="flex items-center justify-between gap-3 px-3 py-2.5" style={{ borderColor: "var(--border-faint)" }}>
      <button type="button" className="min-w-0 text-left" onClick={() => setEditing(true)} title="Edit">
        <p className="truncate text-[0.875rem]" style={{ color: "var(--text)" }}>
          {task.title}
        </p>
        <p className="truncate text-[0.75rem]" style={{ color: late ? "var(--accent-strong)" : "var(--text-faint)" }}>
          {homeDueLabel(task.daysUntil)} · {cadenceLabel(task.cadenceDays)}
          {task.assigneeName ? ` · ${task.assigneeName}${task.rotate ? " (rotates)" : ""}` : ""}
          {task.lastDone ? ` · last done ${task.lastDone}` : ""}
        </p>
      </button>
      <div className="flex shrink-0 items-center gap-1">
        <button
          type="button"
          className={due ? "btn-ink" : "btn-ghost"}
          disabled={pending}
          onClick={() => start(async () => void (await completeTask(task.id)))}
        >
          {pending ? "…" : "Done"}
        </button>
        <button
          type="button"
          className="btn-icon"
          aria-label={`Remove ${task.title}`}
          title="Remove"
          disabled={pending}
          onClick={() => {
            if (confirm(`Stop tracking "${task.title}"?`)) start(async () => void (await archiveTask(task.id)));
          }}
        >
          <svg width="12" height="12" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" aria-hidden>
            <path d="M3 3l8 8M11 3l-8 8" />
          </svg>
        </button>
      </div>
    </li>
  );
}

const CADENCE_CHOICES = [1, 7, 14, 30, 90, 180, 365];

export function TaskForm({
  kind,
  members,
  task,
  today,
  onDone,
}: {
  kind: HomeTaskKind;
  members: MemberOption[];
  task?: TaskView;
  today?: string;
  onDone?: () => void;
}) {
  const [state, action, pending] = useActionState(async (prev: Parameters<typeof saveTask>[0], formData: FormData) => {
    const result = await saveTask(prev, formData);
    if (result?.ok) onDone?.();
    return result;
  }, undefined);
  const [title, setTitle] = useState(task?.title ?? "");
  const [cadence, setCadence] = useState(task?.cadenceDays ?? (kind === "chore" ? 7 : 90));
  const presets = HOME_TASK_PRESETS.filter((p) => p.kind === kind);

  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="kind" value={kind} />
      {task ? <input type="hidden" name="id" value={task.id} /> : null}
      {!task ? (
        <div className="flex flex-wrap gap-1.5">
          {presets.map((preset) => (
            <button
              key={preset.title}
              type="button"
              className="rounded-full border px-2.5 py-1 text-[0.75rem]"
              style={{ borderColor: "var(--border-soft)", color: "var(--text-muted)" }}
              onClick={() => {
                setTitle(preset.title);
                setCadence(preset.cadenceDays);
              }}
            >
              {preset.title}
            </button>
          ))}
        </div>
      ) : null}
      <div className="grid gap-2 sm:grid-cols-2">
        <input
          name="title"
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={kind === "chore" ? "Chore" : "Maintenance task"}
          aria-label="Title"
          className="field"
        />
        <select
          name="cadenceDays"
          value={cadence}
          onChange={(e) => setCadence(Number(e.target.value))}
          className="field"
          aria-label="Repeats"
        >
          {[...new Set([...CADENCE_CHOICES, cadence])].sort((a, b) => a - b).map((days) => (
            <option key={days} value={days}>
              {cadenceLabel(days)}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-[0.8125rem]" style={{ color: "var(--text-muted)" }}>
          Next due
          <input name="nextDueAt" type="date" required defaultValue={task?.nextDueInput ?? today} className="field" />
        </label>
        {members.length > 1 ? (
          <select name="assigneeUserId" defaultValue={task?.assigneeUserId ?? ""} className="field" aria-label="Who">
            <option value="">Anyone</option>
            {members.map((m) => (
              <option key={m.userId} value={m.userId}>
                {m.name}
              </option>
            ))}
          </select>
        ) : null}
      </div>
      {members.length > 1 ? (
        <label className="flex items-center gap-2 text-[0.8125rem]" style={{ color: "var(--text-muted)" }}>
          <input type="checkbox" name="rotate" defaultChecked={task?.rotate} /> Take turns (switches person each time it&apos;s done)
        </label>
      ) : null}
      <div className="flex items-center gap-2">
        <button type="submit" disabled={pending} className="btn-ink">
          {pending ? "Saving…" : task ? "Save" : "Add"}
        </button>
        {onDone ? (
          <button type="button" className="btn-ghost" onClick={onDone}>
            Cancel
          </button>
        ) : null}
      </div>
      {state && !state.ok ? (
        <p className="text-[0.75rem]" style={{ color: "var(--accent-strong)" }}>
          {state.error}
        </p>
      ) : null}
    </form>
  );
}

export function AddTask({ kind, members, today }: { kind: HomeTaskKind; members: MemberOption[]; today: string }) {
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <button type="button" className="btn-ghost" onClick={() => setOpen(true)}>
        {kind === "chore" ? "Add a chore" : "Add maintenance"}
      </button>
    );
  }
  return <TaskForm kind={kind} members={members} today={today} onDone={() => setOpen(false)} />;
}
