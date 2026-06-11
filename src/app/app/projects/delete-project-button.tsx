"use client";

// Delete a project with an explicit choice about its linked tasks:
// take them along, or keep them in Do as standalone items. Time entries
// survive either way.

import { useState, useTransition } from "react";
import { deleteProjectAction } from "./actions";

export function DeleteProjectButton({
  projectId,
  projectName,
  taskCount,
}: {
  projectId: string;
  projectName: string;
  taskCount: number;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [choice, setChoice] = useState<"with-tasks" | "keep-tasks" | null>(
    null,
  );

  const remove = (deleteTasks: boolean) => {
    if (pending) return;
    setChoice(deleteTasks ? "with-tasks" : "keep-tasks");
    startTransition(async () => {
      const formData = new FormData();
      formData.set("id", projectId);
      formData.set("deleteTasks", deleteTasks ? "1" : "0");
      await deleteProjectAction(formData);
      setOpen(false);
    });
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="btn-ghost"
        style={{ color: "var(--accent-strong)" }}
      >
        Delete project
      </button>

      {open ? (
        <div
          className="calendar-modal-backdrop"
          role="presentation"
          onClick={() => setOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-project-title"
            className="calendar-modal"
            onClick={(event) => event.stopPropagation()}
          >
            <p
              className="text-[0.6875rem] font-semibold uppercase tracking-wider"
              style={{ color: "var(--text-faint)" }}
            >
              Delete project
            </p>
            <h2
              id="delete-project-title"
              className="mt-1 text-[1.125rem] font-semibold tracking-tight"
              style={{ color: "var(--text)" }}
            >
              Delete &quot;{projectName}&quot;?
            </h2>
            <p
              className="mt-2 text-[0.875rem]"
              style={{ color: "var(--text-muted)" }}
            >
              {taskCount === 0
                ? "No tasks are linked to this project. This can't be undone."
                : taskCount === 1
                  ? "1 task is linked to this project. Tracked time is kept either way. This can't be undone."
                  : `${taskCount} tasks are linked to this project. Tracked time is kept either way. This can't be undone.`}
            </p>

            <div className="mt-5 flex flex-col gap-2">
              {taskCount > 0 ? (
                <>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => remove(true)}
                    className="btn-ink w-full"
                  >
                    {pending && choice === "with-tasks"
                      ? "Deleting..."
                      : taskCount === 1
                        ? "Delete project and its task"
                        : `Delete project and its ${taskCount} tasks`}
                  </button>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => remove(false)}
                    className="btn-ghost w-full"
                  >
                    {pending && choice === "keep-tasks"
                      ? "Deleting..."
                      : "Delete project, keep tasks in Do"}
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => remove(false)}
                  className="btn-ink w-full"
                >
                  {pending ? "Deleting..." : "Delete project"}
                </button>
              )}
              <button
                type="button"
                disabled={pending}
                onClick={() => setOpen(false)}
                className="btn-ghost w-full"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
