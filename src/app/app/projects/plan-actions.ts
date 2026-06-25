"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { resolveActiveUserId } from "@/lib/viewer-context";
import {
  updateProjectPlan,
  addProjectQuestion,
  addProjectBlocker,
  removeProjectQuestion,
  removeProjectBlocker,
} from "@/lib/services/project-planning";
import { syncRolodexMentionsForText } from "@/lib/services/rolodex-mentions";

function revalidate(projectId: string) {
  revalidatePath("/app");
  revalidatePath("/app/projects");
  revalidatePath(`/app/projects/${projectId}`);
}

export type PlanActionResult = { ok: true } | { ok: false; error: string };

const planPatchSchema = z.object({
  projectId: z.string().min(1),
  goal: z.string().max(1000).optional(),
  whyItMatters: z.string().max(1000).optional(),
  nextMilestone: z.string().max(500).optional(),
  nextAction: z.string().max(500).optional(),
  planNotes: z.string().max(5000).optional(),
  targetDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
});

export async function updateProjectPlanAction(
  input: z.infer<typeof planPatchSchema>,
): Promise<PlanActionResult> {
  let userId: string;
  try {
    userId = await resolveActiveUserId();
  } catch {
    return { ok: false, error: "Not signed in." };
  }
  const parsed = planPatchSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const { projectId, ...fields } = parsed.data;
  try {
    await updateProjectPlan(userId, projectId, {
      goal: fields.goal !== undefined ? fields.goal || null : undefined,
      whyItMatters: fields.whyItMatters !== undefined ? fields.whyItMatters || null : undefined,
      nextMilestone: fields.nextMilestone !== undefined ? fields.nextMilestone || null : undefined,
      nextAction: fields.nextAction !== undefined ? fields.nextAction || null : undefined,
      planNotes: fields.planNotes !== undefined ? fields.planNotes || null : undefined,
      targetDate: fields.targetDate !== undefined ? fields.targetDate : undefined,
    });
    const mentionSyncs: Promise<void>[] = [];
    if (fields.goal !== undefined) {
      mentionSyncs.push(syncRolodexMentionsForText(userId, {
        sourceTool: "projects",
        sourceRecordId: projectId,
        sourceField: "goal",
        text: fields.goal || null,
      }));
    }
    if (fields.whyItMatters !== undefined) {
      mentionSyncs.push(syncRolodexMentionsForText(userId, {
        sourceTool: "projects",
        sourceRecordId: projectId,
        sourceField: "whyItMatters",
        text: fields.whyItMatters || null,
      }));
    }
    if (fields.nextMilestone !== undefined) {
      mentionSyncs.push(syncRolodexMentionsForText(userId, {
        sourceTool: "projects",
        sourceRecordId: projectId,
        sourceField: "nextMilestone",
        text: fields.nextMilestone || null,
      }));
    }
    if (fields.nextAction !== undefined) {
      mentionSyncs.push(syncRolodexMentionsForText(userId, {
        sourceTool: "projects",
        sourceRecordId: projectId,
        sourceField: "nextAction",
        text: fields.nextAction || null,
      }));
    }
    if (fields.planNotes !== undefined) {
      mentionSyncs.push(syncRolodexMentionsForText(userId, {
        sourceTool: "projects",
        sourceRecordId: projectId,
        sourceField: "planNotes",
        text: fields.planNotes || null,
      }));
    }
    await Promise.all(mentionSyncs);
    revalidate(projectId);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Could not update plan." };
  }
}

const questionSchema = z.object({
  projectId: z.string().min(1),
  question: z.string().trim().min(1).max(500),
});

export async function addProjectQuestionAction(
  input: z.infer<typeof questionSchema>,
): Promise<PlanActionResult> {
  let userId: string;
  try { userId = await resolveActiveUserId(); } catch { return { ok: false, error: "Not signed in." }; }
  const parsed = questionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid." };
  try {
    await addProjectQuestion(userId, parsed.data.projectId, parsed.data.question);
    await syncRolodexMentionsForText(userId, {
      sourceTool: "projects",
      sourceRecordId: parsed.data.projectId,
      sourceField: `question:${parsed.data.question}`,
      text: parsed.data.question,
    });
    revalidate(parsed.data.projectId);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Could not add question." };
  }
}

const blockerSchema = z.object({
  projectId: z.string().min(1),
  blocker: z.string().trim().min(1).max(500),
});

export async function addProjectBlockerAction(
  input: z.infer<typeof blockerSchema>,
): Promise<PlanActionResult> {
  let userId: string;
  try { userId = await resolveActiveUserId(); } catch { return { ok: false, error: "Not signed in." }; }
  const parsed = blockerSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid." };
  try {
    await addProjectBlocker(userId, parsed.data.projectId, parsed.data.blocker);
    await syncRolodexMentionsForText(userId, {
      sourceTool: "projects",
      sourceRecordId: parsed.data.projectId,
      sourceField: `blocker:${parsed.data.blocker}`,
      text: parsed.data.blocker,
    });
    revalidate(parsed.data.projectId);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Could not add blocker." };
  }
}

const removeQuestionSchema = z.object({
  projectId: z.string().min(1),
  question: z.string().min(1),
});

export async function removeProjectQuestionAction(
  input: z.infer<typeof removeQuestionSchema>,
): Promise<PlanActionResult> {
  let userId: string;
  try { userId = await resolveActiveUserId(); } catch { return { ok: false, error: "Not signed in." }; }
  const parsed = removeQuestionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid." };
  try {
    await removeProjectQuestion(userId, parsed.data.projectId, parsed.data.question);
    revalidate(parsed.data.projectId);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Could not remove question." };
  }
}

const removeBlockerSchema = z.object({
  projectId: z.string().min(1),
  blocker: z.string().min(1),
});

export async function removeProjectBlockerAction(
  input: z.infer<typeof removeBlockerSchema>,
): Promise<PlanActionResult> {
  let userId: string;
  try { userId = await resolveActiveUserId(); } catch { return { ok: false, error: "Not signed in." }; }
  const parsed = removeBlockerSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid." };
  try {
    await removeProjectBlocker(userId, parsed.data.projectId, parsed.data.blocker);
    revalidate(parsed.data.projectId);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Could not remove blocker." };
  }
}

const setNextActionSchema = z.object({
  projectId: z.string().min(1),
  nextAction: z.string().max(500).nullable(),
});

export async function setNextActionAction(
  input: z.infer<typeof setNextActionSchema>,
): Promise<PlanActionResult> {
  let userId: string;
  try { userId = await resolveActiveUserId(); } catch { return { ok: false, error: "Not signed in." }; }
  const parsed = setNextActionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid." };
  try {
    await updateProjectPlan(userId, parsed.data.projectId, {
      nextAction: parsed.data.nextAction || null,
    });
    await syncRolodexMentionsForText(userId, {
      sourceTool: "projects",
      sourceRecordId: parsed.data.projectId,
      sourceField: "nextAction",
      text: parsed.data.nextAction || null,
    });
    revalidate(parsed.data.projectId);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Could not set next action." };
  }
}
