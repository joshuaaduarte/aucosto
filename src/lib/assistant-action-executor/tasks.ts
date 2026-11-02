// Assistant action executor — Do-task actions.
// (Split out of the former single-file assistant-action-executor.ts.)

import "server-only";
import { createDoItem, updateDoItem, getDoItemSummary } from "@/lib/services/do";
import { CompleteTaskInput, CreateTaskInput, UpdateTaskInput } from "./schemas";
import { err, err2, idNotFound, resolveProjectByName, zodErr } from "./shared";
import { ExecuteResult, PreviewResult } from "./types";

export async function previewCreateTask(
  userId: string,
  raw: unknown,
): Promise<PreviewResult> {
  const parsed = CreateTaskInput.safeParse(raw);
  if (!parsed.success) {
    return zodErr(parsed.error);
  }
  const { title, projectName, bucket, notes } = parsed.data;
  const warnings: string[] = [];
  let projectId: string | null = null;
  let resolvedProjectName: string | null = null;

  if (projectName) {
    const resolved = await resolveProjectByName(userId, projectName);
    if (resolved.found) {
      projectId = resolved.match.id;
      resolvedProjectName = resolved.match.name;
    } else {
      const skipNote = "Task will be created without a project.";
      if (resolved.suggestion) {
        warnings.push(`"${projectName}" is close to "${resolved.suggestion}" but not an exact match — not linked. ${skipNote} Pass the exact name to link it.`);
      } else if (resolved.candidates.length > 0) {
        const names = resolved.candidates.map((c) => c.name).join(", ");
        warnings.push(`Multiple projects matched "${projectName}" (${names}) — skipping to avoid a wrong link. ${skipNote}`);
      } else {
        warnings.push(`No project matched "${projectName}" — skipping. ${skipNote}`);
      }
    }
  }

  // "backlog" → "someday" (no backlog lane in the service)
  const lane = bucket === "backlog" ? "someday" : bucket;
  const normalizedInput: Record<string, unknown> = { title, lane, projectId, notes: notes ?? null };

  const lines: string[] = [`Create task: ${title}`];
  if (resolvedProjectName) lines.push(`Project: ${resolvedProjectName}`);
  lines.push(`Lane: ${lane}`);

  return {
    ok: true,
    previewText: lines.join("\n"),
    normalizedInput,
    warnings,
  };
}

export async function previewCompleteTask(
  userId: string,
  raw: unknown,
): Promise<PreviewResult> {
  const parsed = CompleteTaskInput.safeParse(raw);
  if (!parsed.success) {
    return zodErr(parsed.error);
  }
  const { taskId } = parsed.data;
  const task = await getDoItemSummary(userId, taskId);
  if (!task) {
    return err(
      idNotFound(
        "Task",
        taskId,
        "list tasks via GET /api/assistant/tasks to get a valid task id",
      ),
    );
  }
  if (task.status === "done") {
    return err(`Task "${task.title}" is already done`);
  }

  return {
    ok: true,
    previewText: `Complete task "${task.title}" (currently [${task.lane}])`,
    normalizedInput: { taskId, beforeTitle: task.title, beforeLane: task.lane },
    warnings: [],
  };
}

export async function previewUpdateTask(
  userId: string,
  raw: unknown,
): Promise<PreviewResult> {
  const parsed = UpdateTaskInput.safeParse(raw);
  if (!parsed.success) {
    return zodErr(parsed.error);
  }
  const { taskId, title, bucket, projectName } = parsed.data;
  const task = await getDoItemSummary(userId, taskId);
  if (!task) {
    return err(
      idNotFound(
        "Task",
        taskId,
        "list tasks via GET /api/assistant/tasks to get a valid task id",
      ),
    );
  }

  const warnings: string[] = [];
  let projectId: string | undefined | null = undefined;
  let resolvedProjectName: string | null = null;

  if (projectName !== undefined) {
    if (projectName === "") {
      projectId = null;
    } else {
      const resolved = await resolveProjectByName(userId, projectName);
      if (resolved.found) {
        projectId = resolved.match.id;
        resolvedProjectName = resolved.match.name;
      } else {
        const skipNote = "Project will not be changed.";
        if (resolved.suggestion) {
          warnings.push(`"${projectName}" is close to "${resolved.suggestion}" but not an exact match — not linked. ${skipNote} Pass the exact name to link it.`);
        } else if (resolved.candidates.length > 0) {
          const names = resolved.candidates.map((c) => c.name).join(", ");
          warnings.push(`Multiple projects matched "${projectName}" (${names}) — skipping to avoid a wrong link. ${skipNote}`);
        } else {
          warnings.push(`No project matched "${projectName}" — skipping. ${skipNote}`);
        }
      }
    }
  }

  const normalizedInput: Record<string, unknown> = {
    taskId,
    beforeTitle: task.title,
    beforeLane: task.lane,
  };
  if (title !== undefined) normalizedInput.title = title;
  if (bucket !== undefined) normalizedInput.lane = bucket;
  if (projectId !== undefined) normalizedInput.projectId = projectId;

  const changes: string[] = [];
  if (title !== undefined && title !== task.title) changes.push(`title → "${title}"`);
  if (bucket !== undefined && bucket !== task.lane) changes.push(`lane → [${bucket}]`);
  if (projectId !== undefined) {
    if (projectId === task.projectId) {
      // Already on this project — not a change.
      projectId = undefined;
      delete normalizedInput.projectId;
    } else {
      changes.push(
        projectId === null ? `project → none` : `project → "${resolvedProjectName}"`,
      );
    }
  }
  if (changes.length === 0) {
    return err(
      "No changes specified — pass at least one of: title, bucket, projectName",
    );
  }

  return {
    ok: true,
    previewText: `Update task "${task.title}": ${changes.join(", ")}`,
    normalizedInput,
    warnings,
  };
}

export async function executeCreateTask(
  userId: string,
  n: Record<string, unknown>,
): Promise<ExecuteResult> {
  const item = await createDoItem(userId, {
    title: String(n.title),
    lane: (n.lane as "today" | "next" | "later" | "someday") ?? "someday",
    projectId: n.projectId ? String(n.projectId) : null,
    notes: n.notes ? String(n.notes) : null,
  });
  return {
    ok: true,
    recordId: item.id,
    recordType: "DoItem",
    summary: `Created task "${item.title}" in [${item.lane}]`,
  };
}

export async function executeCompleteTask(
  userId: string,
  n: Record<string, unknown>,
): Promise<ExecuteResult> {
  const updated = await updateDoItem(userId, String(n.taskId), { status: "done" });
  if (!updated) return err2(`Task "${n.taskId}" not found`);
  return {
    ok: true,
    recordId: updated.id,
    recordType: "DoItem",
    summary: `Completed task "${updated.title}"`,
  };
}

export async function executeUpdateTask(
  userId: string,
  n: Record<string, unknown>,
): Promise<ExecuteResult> {
  const patch: Parameters<typeof updateDoItem>[2] = {};
  if (n.title !== undefined && n.title !== null) patch.title = String(n.title);
  if (n.lane !== undefined && n.lane !== null)
    patch.lane = n.lane as "today" | "next" | "later" | "someday";
  if ("projectId" in n) patch.projectId = n.projectId ? String(n.projectId) : null;

  const updated = await updateDoItem(userId, String(n.taskId), patch);
  if (!updated) return err2(`Task "${n.taskId}" not found`);
  return {
    ok: true,
    recordId: updated.id,
    recordType: "DoItem",
    summary: `Updated task "${updated.title}"`,
  };
}
