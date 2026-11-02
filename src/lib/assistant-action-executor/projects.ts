// Assistant action executor — Project and project-planning actions.
// (Split out of the former single-file assistant-action-executor.ts.)

import "server-only";
import { updateProject, listBoardProjects, createBoardProject, deleteProject, getProjectDeleteImpact } from "@/lib/services/projects";
import { updateProjectPlan, addProjectQuestion, addProjectBlocker, getProjectPlan } from "@/lib/services/project-planning";
import { AddProjectBlockerInput, AddProjectMilestoneInput, AddProjectQuestionInput, CreateProjectInput, DeleteProjectInput, SetProjectNextActionInput, UpdateProjectInput, UpdateProjectPlanInput } from "./schemas";
import { err, err2, errAmbiguous, fmtMinutes, resolveProjectRef, zodErr } from "./shared";
import { ExecuteResult, PreviewResult } from "./types";

export async function previewUpdateProject(
  userId: string,
  raw: unknown,
): Promise<PreviewResult> {
  const parsed = UpdateProjectInput.safeParse(raw);
  if (!parsed.success) {
    return zodErr(parsed.error);
  }
  const { projectName, projectId, status, notes } = parsed.data;

  const ref = await resolveProjectRef(userId, { projectName, projectId });
  if (!ref.ok) return errAmbiguous(ref.error, ref.candidates);

  const project = ref.project;
  const changes: string[] = [];
  if (status) changes.push(`status → ${status}`);
  if (notes !== undefined) changes.push(`notes updated`);
  if (changes.length === 0) {
    return err(
      "No changes specified — pass at least one of: status, notes",
    );
  }

  return {
    ok: true,
    previewText: `Update project "${project.name}": ${changes.join(", ")}`,
    normalizedInput: {
      projectId: project.id,
      projectName: project.name,
      status: status ?? null,
      notes: notes ?? null,
    },
    warnings: [],
  };
}

export async function previewCreateProject(
  userId: string,
  raw: unknown,
): Promise<PreviewResult> {
  const parsed = CreateProjectInput.safeParse(raw);
  if (!parsed.success) {
    return zodErr(parsed.error);
  }
  const { name, intent, status, energyType, timeBudgetMinutes, targetDate } = parsed.data;

  const warnings: string[] = [];
  const projects = await listBoardProjects(userId);
  if (projects.some((p) => p.name.toLowerCase() === name.trim().toLowerCase())) {
    warnings.push(`A project named "${name.trim()}" already exists`);
  }

  const lines: string[] = [`Create project "${name.trim()}"`];
  if (intent) lines.push(`Intent: ${intent.slice(0, 80)}${intent.length > 80 ? "…" : ""}`);
  if (status) lines.push(`Status: ${status}`);
  if (timeBudgetMinutes) lines.push(`Time budget: ${fmtMinutes(timeBudgetMinutes)}/week`);
  if (targetDate) lines.push(`Target date: ${targetDate}`);

  return {
    ok: true,
    previewText: lines.join("\n"),
    normalizedInput: {
      name: name.trim(),
      intent: intent ?? null,
      status: status ?? null,
      energyType: energyType ?? null,
      timeBudgetMinutes: timeBudgetMinutes ?? null,
      targetDateIso: targetDate ? new Date(`${targetDate}T12:00:00`).toISOString() : null,
    },
    warnings,
  };
}

export async function previewDeleteProject(
  userId: string,
  raw: unknown,
): Promise<PreviewResult> {
  const parsed = DeleteProjectInput.safeParse(raw);
  if (!parsed.success) {
    return zodErr(parsed.error);
  }
  const { projectName, projectId, deleteTasks } = parsed.data;

  const ref = await resolveProjectRef(userId, { projectName, projectId });
  if (!ref.ok) return errAmbiguous(ref.error, ref.candidates);
  const project = ref.project;

  // Blast radius: project tasks cascade-delete with the project; to-do items
  // are deleted only with deleteTasks (otherwise unlinked); time entries are
  // always kept but unlinked.
  const impact = await getProjectDeleteImpact(userId, project.id);
  const plural = (n: number, one: string, many: string) =>
    `${n} ${n === 1 ? one : many}`;

  const lines = [
    `Delete project "${project.name}"`,
    "Blast radius:",
    `- ${plural(impact.projectTaskCount, "project task", "project tasks")} will be permanently deleted`,
    deleteTasks
      ? `- ${plural(impact.doItemCount, "to-do item", "to-do items")} will also be deleted`
      : `- ${plural(impact.doItemCount, "to-do item", "to-do items")} will be kept but unlinked from the project`,
    `- ${plural(impact.timeEntryCount, "time entry", "time entries")} will be kept but unlinked from the project`,
  ];

  const warnings = [
    `This permanently deletes the project "${project.name}". This cannot be undone.`,
  ];
  if (impact.projectTaskCount > 0) {
    warnings.push(
      `The project's ${plural(impact.projectTaskCount, "task", "tasks")} will be deleted with it — they cannot be recovered.`,
    );
  }
  if (deleteTasks) {
    warnings.push("All to-do items linked to this project will also be deleted.");
  } else {
    warnings.push("To-do items linked to this project will be kept (unlinked).");
  }

  return {
    ok: true,
    previewText: lines.join("\n"),
    normalizedInput: {
      projectId: project.id,
      projectName: project.name,
      deleteTasks,
    },
    warnings,
  };
}

// ── Execute handlers ──────────────────────────────────────────────────────

export async function executeUpdateProject(
  userId: string,
  n: Record<string, unknown>,
): Promise<ExecuteResult> {
  const patch: Parameters<typeof updateProject>[2] = {};
  if (n.status) patch.status = n.status as "active" | "paused" | "done";
  if (n.notes !== undefined && n.notes !== null) patch.notes = String(n.notes);

  const updated = await updateProject(userId, String(n.projectId), patch);
  if (!updated) return err2(`Project "${n.projectId}" not found`);
  return {
    ok: true,
    recordId: updated.id,
    recordType: "Project",
    summary: `Updated project "${updated.name}"`,
  };
}

export async function executeCreateProject(
  userId: string,
  n: Record<string, unknown>,
): Promise<ExecuteResult> {
  const id = await createBoardProject(userId, {
    name: String(n.name),
    intent: n.intent ? String(n.intent) : null,
    status: n.status ? String(n.status) : null,
    energyType: n.energyType ? String(n.energyType) : null,
    timeBudgetMinutes: typeof n.timeBudgetMinutes === "number" ? n.timeBudgetMinutes : null,
    targetDate: n.targetDateIso ? new Date(String(n.targetDateIso)) : null,
  });
  return {
    ok: true,
    recordId: id,
    recordType: "Project",
    summary: `Created project "${n.name}"`,
  };
}

export async function executeDeleteProject(
  userId: string,
  n: Record<string, unknown>,
): Promise<ExecuteResult> {
  await deleteProject(userId, String(n.projectId), {
    deleteTasks: n.deleteTasks === true,
  });
  return {
    ok: true,
    recordId: String(n.projectId),
    recordType: "Project",
    summary: `Deleted project "${n.projectName}"`,
  };
}

export async function previewUpdateProjectPlan(
  userId: string,
  raw: unknown,
): Promise<PreviewResult> {
  const parsed = UpdateProjectPlanInput.safeParse(raw);
  if (!parsed.success) return zodErr(parsed.error);

  const ref = await resolveProjectRef(userId, {
    projectName: parsed.data.projectName,
    projectId: parsed.data.projectId,
  });
  if (!ref.ok) return errAmbiguous(ref.error, ref.candidates);
  const project = ref.project;
  const { goal, whyItMatters, nextMilestone, nextAction, planNotes } = parsed.data;
  const changes: string[] = [];
  if (goal !== undefined) changes.push("goal");
  if (whyItMatters !== undefined) changes.push("why it matters");
  if (nextMilestone !== undefined) changes.push("next milestone");
  if (nextAction !== undefined) changes.push(`next action → "${nextAction}"`);
  if (planNotes !== undefined) changes.push("plan notes");
  if (changes.length === 0) return err("No changes specified");

  return {
    ok: true,
    previewText: `Update planning for "${project.name}": ${changes.join(", ")}`,
    normalizedInput: {
      projectId: project.id,
      projectName: project.name,
      goal: goal ?? null,
      whyItMatters: whyItMatters ?? null,
      nextMilestone: nextMilestone ?? null,
      nextAction: nextAction ?? null,
      planNotes: planNotes ?? null,
    },
    warnings: [],
  };
}

export async function executeUpdateProjectPlan(
  userId: string,
  n: Record<string, unknown>,
): Promise<ExecuteResult> {
  const patch: Parameters<typeof updateProjectPlan>[2] = {};
  if (n.goal !== null && n.goal !== undefined) patch.goal = String(n.goal);
  if (n.whyItMatters !== null && n.whyItMatters !== undefined) patch.whyItMatters = String(n.whyItMatters);
  if (n.nextMilestone !== null && n.nextMilestone !== undefined) patch.nextMilestone = String(n.nextMilestone);
  if (n.nextAction !== null && n.nextAction !== undefined) patch.nextAction = String(n.nextAction);
  if (n.planNotes !== null && n.planNotes !== undefined) patch.planNotes = String(n.planNotes);

  await updateProjectPlan(userId, String(n.projectId), patch);
  return { ok: true, recordId: String(n.projectId), recordType: "Project", summary: `Updated planning for "${n.projectName}"` };
}

export async function previewAddProjectMilestone(
  userId: string,
  raw: unknown,
): Promise<PreviewResult> {
  const parsed = AddProjectMilestoneInput.safeParse(raw);
  if (!parsed.success) return zodErr(parsed.error);

  const ref = await resolveProjectRef(userId, {
    projectName: parsed.data.projectName,
    projectId: parsed.data.projectId,
  });
  if (!ref.ok) return errAmbiguous(ref.error, ref.candidates);
  const project = ref.project;

  const current = await getProjectPlan(userId, project.id);
  const before = current?.nextMilestone ?? null;
  return {
    ok: true,
    previewText: `Set next milestone for "${project.name}": "${parsed.data.milestone}"${before ? `\n(was: "${before}")` : ""}`,
    normalizedInput: { projectId: project.id, projectName: project.name, milestone: parsed.data.milestone },
    warnings: [],
  };
}

export async function executeAddProjectMilestone(
  userId: string,
  n: Record<string, unknown>,
): Promise<ExecuteResult> {
  await updateProjectPlan(userId, String(n.projectId), { nextMilestone: String(n.milestone) });
  return { ok: true, recordId: String(n.projectId), recordType: "Project", summary: `Set milestone for "${n.projectName}"` };
}

export async function previewAddProjectQuestion(
  userId: string,
  raw: unknown,
): Promise<PreviewResult> {
  const parsed = AddProjectQuestionInput.safeParse(raw);
  if (!parsed.success) return zodErr(parsed.error);

  const ref = await resolveProjectRef(userId, {
    projectName: parsed.data.projectName,
    projectId: parsed.data.projectId,
  });
  if (!ref.ok) return errAmbiguous(ref.error, ref.candidates);
  const project = ref.project;

  const warnings: string[] = [];
  const current = await getProjectPlan(userId, project.id);
  if (
    current?.openQuestions.some(
      (q) => q.toLowerCase() === parsed.data.question.trim().toLowerCase(),
    )
  ) {
    warnings.push(
      `This question is already on "${project.name}"'s open questions list — adding it again will create a duplicate`,
    );
  }

  return {
    ok: true,
    previewText: `Add question to "${project.name}": "${parsed.data.question}"`,
    normalizedInput: { projectId: project.id, projectName: project.name, question: parsed.data.question },
    warnings,
  };
}

export async function executeAddProjectQuestion(
  userId: string,
  n: Record<string, unknown>,
): Promise<ExecuteResult> {
  await addProjectQuestion(userId, String(n.projectId), String(n.question));
  return { ok: true, recordId: String(n.projectId), recordType: "Project", summary: `Added question to "${n.projectName}"` };
}

export async function previewAddProjectBlocker(
  userId: string,
  raw: unknown,
): Promise<PreviewResult> {
  const parsed = AddProjectBlockerInput.safeParse(raw);
  if (!parsed.success) return zodErr(parsed.error);

  const ref = await resolveProjectRef(userId, {
    projectName: parsed.data.projectName,
    projectId: parsed.data.projectId,
  });
  if (!ref.ok) return errAmbiguous(ref.error, ref.candidates);
  const project = ref.project;

  const warnings: string[] = [];
  const current = await getProjectPlan(userId, project.id);
  if (
    current?.blockers.some(
      (b) => b.toLowerCase() === parsed.data.blocker.trim().toLowerCase(),
    )
  ) {
    warnings.push(
      `This blocker is already on "${project.name}"'s blockers list — adding it again will create a duplicate`,
    );
  }

  return {
    ok: true,
    previewText: `Add blocker to "${project.name}": "${parsed.data.blocker}"`,
    normalizedInput: { projectId: project.id, projectName: project.name, blocker: parsed.data.blocker },
    warnings,
  };
}

export async function executeAddProjectBlocker(
  userId: string,
  n: Record<string, unknown>,
): Promise<ExecuteResult> {
  await addProjectBlocker(userId, String(n.projectId), String(n.blocker));
  return { ok: true, recordId: String(n.projectId), recordType: "Project", summary: `Added blocker to "${n.projectName}"` };
}

export async function previewSetProjectNextAction(
  userId: string,
  raw: unknown,
): Promise<PreviewResult> {
  const parsed = SetProjectNextActionInput.safeParse(raw);
  if (!parsed.success) return zodErr(parsed.error);

  const ref = await resolveProjectRef(userId, {
    projectName: parsed.data.projectName,
    projectId: parsed.data.projectId,
  });
  if (!ref.ok) return errAmbiguous(ref.error, ref.candidates);
  const project = ref.project;

  const current = await getProjectPlan(userId, project.id);
  const before = current?.nextAction ?? null;
  return {
    ok: true,
    previewText: `Set next action for "${project.name}": "${parsed.data.nextAction}"${before ? `\n(was: "${before}")` : ""}`,
    normalizedInput: { projectId: project.id, projectName: project.name, nextAction: parsed.data.nextAction },
    warnings: [],
  };
}

export async function executeSetProjectNextAction(
  userId: string,
  n: Record<string, unknown>,
): Promise<ExecuteResult> {
  await updateProjectPlan(userId, String(n.projectId), { nextAction: String(n.nextAction) });
  return { ok: true, recordId: String(n.projectId), recordType: "Project", summary: `Set next action for "${n.projectName}"` };
}

// ── Rolodex preview/execute handlers ─────────────────────────────────────
