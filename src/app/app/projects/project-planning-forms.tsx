"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { DO_LANE_LABELS, DO_LANES } from "@/lib/do";
import {
  createProjectScheduleAction,
  createProjectTaskAction,
  type ProjectScheduleState,
  type ProjectTaskState,
} from "./actions";

const initialTaskState: ProjectTaskState = undefined;
const initialScheduleState: ProjectScheduleState = undefined;

export function ProjectTaskCreateForm({
  projectId,
}: {
  projectId: string;
}) {
  const [state, formAction, pending] = useActionState(
    createProjectTaskAction,
    initialTaskState,
  );
  const formRef = useRef<HTMLFormElement>(null);
  const submittedRef = useRef(false);
  const [title, setTitle] = useState("");
  const [lane, setLane] = useState<(typeof DO_LANES)[number]>("next");
  const [estimatedMinutes, setEstimatedMinutes] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (pending) {
      submittedRef.current = true;
      return;
    }

    if (submittedRef.current && !state?.error) {
      submittedRef.current = false;
      const timer = window.setTimeout(() => {
        formRef.current?.reset();
        setTitle("");
        setLane("next");
        setEstimatedMinutes("");
        setNotes("");
      }, 0);
      return () => window.clearTimeout(timer);
    }
  }, [pending, state]);

  return (
    <form
      ref={formRef}
      action={formAction}
      className="space-y-3"
      onSubmit={() => {
        submittedRef.current = true;
      }}
    >
      <input type="hidden" name="projectId" value={projectId} />
      <div className="space-y-1.5">
        <label
          htmlFor={`project-task-title-${projectId}`}
          className="block text-[0.75rem] font-medium"
          style={{ color: "var(--text-muted)" }}
        >
          New linked task
        </label>
        <input
          id={`project-task-title-${projectId}`}
          name="title"
          required
          className="field"
          placeholder="What is the next real move?"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-[1fr_120px]">
        <div className="space-y-1.5">
          <label
            htmlFor={`project-task-lane-${projectId}`}
            className="block text-[0.75rem] font-medium"
            style={{ color: "var(--text-muted)" }}
          >
            When
          </label>
          <select
            id={`project-task-lane-${projectId}`}
            name="lane"
            className="field"
            value={lane}
            onChange={(event) =>
              setLane(event.target.value as (typeof DO_LANES)[number])
            }
          >
            {DO_LANES.map((option) => (
              <option key={option} value={option}>
                {DO_LANE_LABELS[option]}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <label
            htmlFor={`project-task-estimate-${projectId}`}
            className="block text-[0.75rem] font-medium"
            style={{ color: "var(--text-muted)" }}
          >
            Estimate
          </label>
          <input
            id={`project-task-estimate-${projectId}`}
            name="estimatedMinutes"
            type="number"
            min={5}
            step={5}
            className="field"
            placeholder="30"
            value={estimatedMinutes}
            onChange={(event) => setEstimatedMinutes(event.target.value)}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <label
          htmlFor={`project-task-notes-${projectId}`}
          className="block text-[0.75rem] font-medium"
          style={{ color: "var(--text-muted)" }}
        >
          Notes
        </label>
        <input
          id={`project-task-notes-${projectId}`}
          name="notes"
          className="field"
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
        />
      </div>

      {state?.error ? (
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

      <div className="flex justify-end">
        <button type="submit" disabled={pending} className="btn-ink">
          {pending ? "Saving..." : "Add task"}
        </button>
      </div>
    </form>
  );
}

export function ProjectScheduleForm({
  projectId,
  tasks,
  todayDateValue,
}: {
  projectId: string;
  tasks: Array<{
    id: string;
    title: string;
    estimatedMinutes: number | null;
  }>;
  todayDateValue: string;
}) {
  const [state, formAction, pending] = useActionState(
    createProjectScheduleAction,
    initialScheduleState,
  );
  const formRef = useRef<HTMLFormElement>(null);
  const submittedRef = useRef(false);
  const [doItemId, setDoItemId] = useState(tasks[0]?.id ?? "");
  const [title, setTitle] = useState(tasks[0]?.title ?? "");
  const [date, setDate] = useState(todayDateValue);
  const [start, setStart] = useState("09:00");
  const [end, setEnd] = useState("10:00");
  const [location, setLocation] = useState("");
  const [notes, setNotes] = useState("");

  const taskMap = useMemo(
    () => new Map(tasks.map((task) => [task.id, task])),
    [tasks],
  );

  useEffect(() => {
    if (pending) {
      submittedRef.current = true;
      return;
    }

    if (submittedRef.current && !state?.error) {
      submittedRef.current = false;
      const timer = window.setTimeout(() => {
        formRef.current?.reset();
        const firstTask = tasks[0];
        setDoItemId(firstTask?.id ?? "");
        setTitle(firstTask?.title ?? "");
        setDate(todayDateValue);
        setStart("09:00");
        setEnd("10:00");
        setLocation("");
        setNotes("");
      }, 0);
      return () => window.clearTimeout(timer);
    }
  }, [pending, state, tasks, todayDateValue]);

  function handleTaskChange(nextTaskId: string) {
    setDoItemId(nextTaskId);
    const task = taskMap.get(nextTaskId);
    if (task) {
      setTitle(task.title);
      if (task.estimatedMinutes) {
        const [hour = 9, minute = 0] = start.split(":").map(Number);
        const next = new Date();
        next.setHours(hour, minute, 0, 0);
        next.setMinutes(next.getMinutes() + task.estimatedMinutes);
        setEnd(
          `${String(next.getHours()).padStart(2, "0")}:${String(next.getMinutes()).padStart(2, "0")}`,
        );
      }
    }
  }

  if (tasks.length === 0) {
    return (
      <p className="text-[0.8125rem]" style={{ color: "var(--text-muted)" }}>
        Add a linked task first, then schedule it here.
      </p>
    );
  }

  return (
    <form
      ref={formRef}
      action={formAction}
      className="space-y-3"
      onSubmit={() => {
        submittedRef.current = true;
      }}
    >
      <input type="hidden" name="projectId" value={projectId} />

      <div className="space-y-1.5">
        <label
          htmlFor={`project-schedule-task-${projectId}`}
          className="block text-[0.75rem] font-medium"
          style={{ color: "var(--text-muted)" }}
        >
          Task to schedule
        </label>
        <select
          id={`project-schedule-task-${projectId}`}
          name="doItemId"
          className="field"
          value={doItemId}
          onChange={(event) => handleTaskChange(event.target.value)}
        >
          {tasks.map((task) => (
            <option key={task.id} value={task.id}>
              {task.title}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-1.5">
        <label
          htmlFor={`project-schedule-title-${projectId}`}
          className="block text-[0.75rem] font-medium"
          style={{ color: "var(--text-muted)" }}
        >
          Block title
        </label>
        <input
          id={`project-schedule-title-${projectId}`}
          name="title"
          required
          className="field"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1.5">
          <label
            htmlFor={`project-schedule-date-${projectId}`}
            className="block text-[0.75rem] font-medium"
            style={{ color: "var(--text-muted)" }}
          >
            Date
          </label>
          <input
            id={`project-schedule-date-${projectId}`}
            name="date"
            type="date"
            className="field"
            value={date}
            onChange={(event) => setDate(event.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <label
            htmlFor={`project-schedule-start-${projectId}`}
            className="block text-[0.75rem] font-medium"
            style={{ color: "var(--text-muted)" }}
          >
            Start
          </label>
          <input
            id={`project-schedule-start-${projectId}`}
            name="start"
            type="time"
            className="field"
            value={start}
            onChange={(event) => setStart(event.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <label
            htmlFor={`project-schedule-end-${projectId}`}
            className="block text-[0.75rem] font-medium"
            style={{ color: "var(--text-muted)" }}
          >
            End
          </label>
          <input
            id={`project-schedule-end-${projectId}`}
            name="end"
            type="time"
            className="field"
            value={end}
            onChange={(event) => setEnd(event.target.value)}
          />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label
            htmlFor={`project-schedule-location-${projectId}`}
            className="block text-[0.75rem] font-medium"
            style={{ color: "var(--text-muted)" }}
          >
            Location
          </label>
          <input
            id={`project-schedule-location-${projectId}`}
            name="location"
            className="field"
            value={location}
            onChange={(event) => setLocation(event.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <label
            htmlFor={`project-schedule-notes-${projectId}`}
            className="block text-[0.75rem] font-medium"
            style={{ color: "var(--text-muted)" }}
          >
            Notes
          </label>
          <input
            id={`project-schedule-notes-${projectId}`}
            name="notes"
            className="field"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
          />
        </div>
      </div>

      {state?.error ? (
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

      <div className="flex justify-end">
        <button type="submit" disabled={pending} className="btn-ink">
          {pending ? "Saving..." : "Schedule block"}
        </button>
      </div>
    </form>
  );
}
