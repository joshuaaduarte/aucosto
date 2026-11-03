"use client";

import { useActionState, useMemo, useState, useTransition } from "react";
import {
  cadenceLabel,
  HOME_TASK_PRESETS,
  homeDueLabel,
  homeFreshness,
  personInitial,
  type HomeTaskKind,
} from "@/lib/home";
import { categoryColor } from "@/lib/time-categories";
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

type ChoreFilter = "all" | "mine" | "chore" | "maintenance";

/**
 * Chores and home upkeep in one list, soonest first. A ring empties as each
 * one gets closer to due (tap it to mark done); the badge shows whose turn
 * it is. Filters replace separate sections so nothing is listed twice.
 */
export function ChoreBoard({
  tasks,
  members,
  viewerUserId,
  today,
}: {
  tasks: TaskView[];
  members: MemberOption[];
  viewerUserId: string;
  today: string;
}) {
  const [filter, setFilter] = useState<ChoreFilter>("all");
  const [adding, setAdding] = useState(false);
  const shared = members.length > 1;
  const visible = useMemo(
    () =>
      tasks
        .filter((t) =>
          filter === "all"
            ? true
            : filter === "mine"
              ? t.assigneeUserId === viewerUserId || t.assigneeUserId === null
              : t.kind === filter,
        )
        .sort((a, b) => a.daysUntil - b.daysUntil),
    [tasks, filter, viewerUserId],
  );
  const dueCount = tasks.filter((t) => t.daysUntil <= 0).length;
  const filters: Array<[ChoreFilter, string]> = [
    ["all", dueCount ? `All · ${dueCount} due` : "All"],
    ...(shared ? ([["mine", "Mine"]] as Array<[ChoreFilter, string]>) : []),
    ["chore", "Chores"],
    ["maintenance", "Upkeep"],
  ];

  return (
    <div className="space-y-3">
      <div className="no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1" role="radiogroup" aria-label="Show">
        {filters.map(([value, label]) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={filter === value}
            onClick={() => setFilter(value)}
            className="chip shrink-0"
            data-on={filter === value || undefined}
          >
            {label}
          </button>
        ))}
      </div>
      {visible.length === 0 ? (
        <p className="rounded-lg border px-4 py-6 text-center text-[0.875rem]" style={{ borderColor: "var(--border-soft)", color: "var(--text-faint)" }}>
          {tasks.length === 0
            ? "Add the chores that repeat and the upkeep that's easy to forget: filters, detectors, vents."
            : "Nothing here."}
        </p>
      ) : (
        <ul className="rounded-lg border" style={{ borderColor: "var(--border-soft)" }}>
          {visible.map((task) => (
            <TaskRow key={task.id} task={task} members={members} shared={shared} />
          ))}
        </ul>
      )}
      {adding ? (
        <div className="rounded-lg border p-3" style={{ borderColor: "var(--border-soft)" }}>
          <TaskForm members={members} today={today} onDone={() => setAdding(false)} />
        </div>
      ) : (
        <button type="button" className="btn-ghost" onClick={() => setAdding(true)}>
          + Add a chore or upkeep task
        </button>
      )}
    </div>
  );
}

function FreshnessRing({ task, onDone, pending }: { task: TaskView; onDone: () => void; pending: boolean }) {
  const fresh = homeFreshness(task.daysUntil, task.cadenceDays);
  const color = task.daysUntil <= 0 ? "var(--attention)" : fresh < 0.34 ? "var(--attention)" : "var(--positive)";
  const deg = Math.round(fresh * 360);
  return (
    <button
      type="button"
      onClick={onDone}
      disabled={pending}
      aria-label={`Mark ${task.title} done`}
      title="Mark done"
      className="group/ring relative inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
      style={{ background: `conic-gradient(${color} ${deg}deg, var(--bg-tint-strong) 0)` }}
    >
      <span
        className="inline-flex h-[1.625rem] w-[1.625rem] items-center justify-center rounded-full text-[0.75rem] transition-colors group-hover/ring:bg-bg-hover"
        style={{ background: "var(--bg-page)", color: task.daysUntil <= 0 ? "var(--attention)" : "var(--text-faint)" }}
      >
        {pending ? "…" : "✓"}
      </span>
    </button>
  );
}

function TaskRow({ task, members, shared }: { task: TaskView; members: MemberOption[]; shared: boolean }) {
  const [pending, start] = useTransition();
  const [editing, setEditing] = useState(false);
  const late = task.daysUntil < 0;
  const due = task.daysUntil <= 0;

  if (editing) {
    return (
      <li className="border-t p-3 first:border-t-0" style={{ borderColor: "var(--border-faint)" }}>
        <TaskForm members={members} task={task} onDone={() => setEditing(false)} />
        <button
          type="button"
          className="btn-ghost mt-2"
          style={{ color: "var(--text-faint)" }}
          disabled={pending}
          onClick={() => {
            if (confirm(`Stop tracking "${task.title}"?`)) start(async () => void (await archiveTask(task.id)));
          }}
        >
          Stop tracking this
        </button>
      </li>
    );
  }

  return (
    <li className="flex items-center gap-3 border-t px-3 py-2.5 first:border-t-0" style={{ borderColor: "var(--border-faint)" }}>
      <FreshnessRing task={task} pending={pending} onDone={() => start(async () => void (await completeTask(task.id)))} />
      <button type="button" className="min-w-0 flex-1 text-left" onClick={() => setEditing(true)} title="Edit">
        <p className="truncate text-[0.9375rem]" style={{ color: "var(--text)", fontWeight: due ? 600 : 400 }}>
          {task.title}
        </p>
        <p className="truncate text-[0.75rem]" style={{ color: late || due ? "var(--attention)" : "var(--text-faint)" }}>
          {homeDueLabel(task.daysUntil)} · {cadenceLabel(task.cadenceDays).toLowerCase()}
          {task.rotate ? " · takes turns" : ""}
          {task.lastDone ? <span style={{ color: "var(--text-faint)" }}> · last {task.lastDone}</span> : null}
        </p>
      </button>
      {shared ? (
        <span
          title={task.assigneeName ? `${task.assigneeName}'s turn` : "Anyone"}
          className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[0.6875rem] font-semibold"
          style={
            task.assigneeName
              ? { background: categoryColor(task.assigneeName), color: "#fff" }
              : { background: "var(--bg-tint-strong)", color: "var(--text-faint)" }
          }
        >
          {task.assigneeName ? personInitial(task.assigneeName) : "·"}
        </span>
      ) : null}
    </li>
  );
}

const CADENCE_CHOICES = [1, 7, 14, 30, 90, 180, 365];

export function TaskForm({
  kind: initialKind = "chore",
  members,
  task,
  today,
  onDone,
}: {
  kind?: HomeTaskKind;
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
  const [kind, setKind] = useState<HomeTaskKind>((task?.kind as HomeTaskKind | undefined) ?? initialKind);
  const [title, setTitle] = useState(task?.title ?? "");
  const [cadence, setCadence] = useState(task?.cadenceDays ?? (kind === "chore" ? 7 : 90));
  const presets = HOME_TASK_PRESETS.filter((p) => p.kind === kind);

  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="kind" value={kind} />
      {task ? <input type="hidden" name="id" value={task.id} /> : null}
      {!task ? (
        <div className="seg max-w-xs" role="tablist" aria-label="Kind">
          {(
            [
              ["chore", "Chore"],
              ["maintenance", "Upkeep"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={kind === value}
              className="seg-item"
              onClick={() => {
                setKind(value);
                setCadence(value === "chore" ? 7 : 90);
              }}
            >
              {label}
            </button>
          ))}
        </div>
      ) : null}
      {!task ? (
        <div className="flex flex-wrap gap-1.5">
          {presets.map((preset) => (
            <button
              key={preset.title}
              type="button"
              className="chip"
              data-on={title === preset.title || undefined}
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
