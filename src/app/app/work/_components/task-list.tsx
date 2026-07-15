import Link from "next/link";
import { dueLabel, taskKindLabel, type WorkTaskSummary } from "@/lib/work";
import { deleteTaskAction, toggleTaskDoneAction, updateTaskAction } from "../actions";
import { WorkForm } from "./work-form";
import { Disclosure, FieldLabel, LinkSelects, Meta, linkLabels, type WorkNameMaps } from "./ui";

export function TaskList({
  tasks,
  workspaceId,
  maps,
  today,
  emptyText = "No tasks.",
}: {
  tasks: WorkTaskSummary[];
  workspaceId: string;
  maps: WorkNameMaps;
  today: Date;
  emptyText?: string;
}) {
  if (tasks.length === 0) {
    return (
      <p className="px-3 py-2.5 text-[0.8125rem]" style={{ color: "var(--text-faint)" }}>
        {emptyText}
      </p>
    );
  }
  return (
    <ul>
      {tasks.map((task, i) => (
        <TaskRow
          key={task.id}
          task={task}
          workspaceId={workspaceId}
          maps={maps}
          today={today}
          last={i === tasks.length - 1}
        />
      ))}
    </ul>
  );
}

function TaskRow({
  task,
  workspaceId,
  maps,
  today,
  last,
}: {
  task: WorkTaskSummary;
  workspaceId: string;
  maps: WorkNameMaps;
  today: Date;
  last: boolean;
}) {
  const done = task.status === "done";
  const due = dueLabel(task.dueDate, today);
  const overdue = !done && task.dueDate ? new Date(task.dueDate) < new Date(today.getFullYear(), today.getMonth(), today.getDate()) : false;
  const links = linkLabels(task, maps);

  return (
    <li
      className="flex items-start gap-2.5 px-3 py-2"
      style={last ? undefined : { borderBottom: "1px solid var(--border-faint)" }}
    >
      <form action={toggleTaskDoneAction} className="mt-0.5 shrink-0">
        <input type="hidden" name="id" value={task.id} />
        <input type="hidden" name="done" value={done ? "false" : "true"} />
        <button
          type="submit"
          aria-label={done ? "Reopen task" : "Complete task"}
          className="flex h-4 w-4 items-center justify-center rounded-full transition-colors"
          style={{
            border: `1.5px solid ${done ? "var(--text-faint)" : "var(--border)"}`,
            background: done ? "var(--text-faint)" : "transparent",
            color: "var(--bg-page)",
          }}
        >
          {done && (
            <svg width="9" height="9" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M2 5.2 4.2 7.4 8 3" />
            </svg>
          )}
        </button>
      </form>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <span
            className="text-[0.875rem]"
            style={{
              color: done ? "var(--text-faint)" : "var(--text)",
              textDecoration: done ? "line-through" : undefined,
            }}
          >
            {task.isImportant && !done && (
              <span title="Important" style={{ color: "var(--accent)" }}>
                ★{" "}
              </span>
            )}
            {task.title}
          </span>
          {due && (
            <span
              className="text-[0.6875rem] font-medium"
              style={{ color: overdue ? "var(--accent-strong)" : "var(--text-faint)" }}
            >
              {due}
            </span>
          )}
          {task.kind !== "task" && <Meta>{taskKindLabel(task.kind)}</Meta>}
          {task.status === "waiting" && (
            <Meta>Waiting{task.waitingOn ? ` on ${task.waitingOn}` : ""}</Meta>
          )}
          {links.map((label) => (
            <Meta key={label}>· {label}</Meta>
          ))}
          {task.doItemId && !done && (
            <Link
              href="/app/do"
              className="text-[0.6875rem] hover:underline"
              style={{ color: "var(--text-ghost)" }}
              title="This task lives on the Do List"
            >
              · in Do
            </Link>
          )}
        </div>
        {!done && (
          <div className="mt-0.5">
            <Disclosure summary="Edit">
              <WorkForm action={updateTaskAction} submitLabel="Save task">
                <input type="hidden" name="id" value={task.id} />
                <input type="hidden" name="workspaceId" value={workspaceId} />
                <div className="space-y-2">
                  <input
                    name="title"
                    defaultValue={task.title}
                    required
                    maxLength={300}
                    className="field"
                  />
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    <label className="block">
                      <FieldLabel>Due</FieldLabel>
                      <input
                        type="date"
                        name="dueDate"
                        defaultValue={task.dueDate ? task.dueDate.slice(0, 10) : ""}
                        className="field"
                      />
                    </label>
                    <label className="block">
                      <FieldLabel>Kind</FieldLabel>
                      <select name="kind" defaultValue={task.kind} className="field">
                        <option value="task">Task</option>
                        <option value="prep">Prep</option>
                        <option value="followup">Follow-up</option>
                      </select>
                    </label>
                    <label className="block">
                      <FieldLabel>Waiting on</FieldLabel>
                      <input
                        name="waitingOn"
                        defaultValue={task.waitingOn ?? ""}
                        maxLength={200}
                        placeholder="Who / what"
                        className="field"
                      />
                    </label>
                    <label className="flex items-end gap-1.5 pb-2.5 text-[0.8125rem]" style={{ color: "var(--text-muted)" }}>
                      <input
                        type="checkbox"
                        name="isImportant"
                        defaultChecked={task.isImportant}
                      />
                      Important
                    </label>
                  </div>
                  <LinkSelects maps={maps} defaults={task} />
                </div>
              </WorkForm>
            </Disclosure>
          </div>
        )}
      </div>

      <form action={deleteTaskAction} className="shrink-0">
        <input type="hidden" name="id" value={task.id} />
        <button
          type="submit"
          aria-label="Delete task"
          className="btn-icon"
          style={{ color: "var(--text-ghost)" }}
        >
          <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" aria-hidden>
            <path d="M2 2l8 8M10 2l-8 8" />
          </svg>
        </button>
      </form>
    </li>
  );
}
