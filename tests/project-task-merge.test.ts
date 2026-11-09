import { describe, expect, it } from "vitest";
import {
  doTaskToProjectTask,
  mergeProjectTasks,
  mergeTaskCounts,
  type LinkedDoTaskRow,
} from "@/lib/projects";

const at = (day: number) => new Date(2026, 10, day, 12);

function boardTask(id: string, patch: Partial<{ done: boolean; isToday: boolean; sortOrder: number }> = {}) {
  return {
    id,
    title: id,
    done: false,
    isToday: false,
    sortOrder: 1,
    createdAt: at(1),
    ...patch,
  };
}

function doTask(id: string, patch: Partial<LinkedDoTaskRow> = {}): LinkedDoTaskRow {
  return { id, title: id, status: "ready", lane: "next", createdAt: at(2), ...patch };
}

describe("doTaskToProjectTask", () => {
  it("maps the today lane to Today and everything else to Backlog", () => {
    expect(doTaskToProjectTask(doTask("a", { lane: "today" }), 1).isToday).toBe(true);
    for (const lane of ["next", "later", "someday", null]) {
      expect(doTaskToProjectTask(doTask("a", { lane }), 1).isToday).toBe(false);
    }
  });

  it("treats only the done status as done, including legacy and missing statuses", () => {
    expect(doTaskToProjectTask(doTask("a", { status: "done" }), 1).done).toBe(true);
    for (const status of ["ready", "open", "scheduled", "in_progress", "waiting", null]) {
      expect(doTaskToProjectTask(doTask("a", { status }), 1).done).toBe(false);
    }
  });

  it("marks the row as coming from the Do List", () => {
    expect(doTaskToProjectTask(doTask("a"), 7)).toMatchObject({ source: "do", sortOrder: 7 });
  });
});

describe("mergeProjectTasks", () => {
  it("shows Do List tasks linked to the project next to board tasks", () => {
    const merged = mergeProjectTasks([boardTask("board")], [doTask("linked")]);
    expect(merged.map((task) => [task.id, task.source])).toEqual([
      ["board", "project"],
      ["linked", "do"],
    ]);
  });

  it("returns linked Do List tasks even when the board has none", () => {
    const merged = mergeProjectTasks([], [doTask("linked", { lane: "today" })]);
    expect(merged).toHaveLength(1);
    expect(merged[0]).toMatchObject({ id: "linked", isToday: true, done: false, source: "do" });
  });

  it("orders open before done and Today before Backlog across both sources", () => {
    const merged = mergeProjectTasks(
      [
        boardTask("board-done", { done: true, sortOrder: 1 }),
        boardTask("board-backlog", { sortOrder: 2 }),
        boardTask("board-today", { isToday: true, sortOrder: 3 }),
      ],
      [
        doTask("do-done", { status: "done" }),
        doTask("do-today", { lane: "today" }),
        doTask("do-backlog"),
      ],
    );
    expect(merged.map((task) => task.id)).toEqual([
      "board-today",
      "do-today",
      "board-backlog",
      "do-backlog",
      "board-done",
      "do-done",
    ]);
  });

  it("lists Do List tasks oldest first, after board tasks in the same section", () => {
    const merged = mergeProjectTasks(
      [boardTask("board", { sortOrder: 5 })],
      [doTask("newer", { createdAt: at(9) }), doTask("older", { createdAt: at(3) })],
    );
    expect(merged.map((task) => task.id)).toEqual(["board", "older", "newer"]);
  });
});

describe("mergeTaskCounts", () => {
  it("adds linked Do List counts to board counts per project", () => {
    const merged = mergeTaskCounts(
      new Map([["p1", { open: 1, done: 2 }]]),
      new Map([
        ["p1", { open: 3, done: 1 }],
        ["p2", { open: 4, done: 0 }],
      ]),
    );
    expect(merged.get("p1")).toEqual({ open: 4, done: 3 });
    expect(merged.get("p2")).toEqual({ open: 4, done: 0 });
  });

  it("does not change the maps it was given", () => {
    const board = new Map([["p1", { open: 1, done: 0 }]]);
    mergeTaskCounts(board, new Map([["p1", { open: 1, done: 1 }]]));
    expect(board.get("p1")).toEqual({ open: 1, done: 0 });
  });
});
