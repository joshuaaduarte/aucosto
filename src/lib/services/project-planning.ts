import "server-only";
import { prisma } from "@/lib/prisma";
import { requireCan } from "@/lib/auth/can";
import { recordEvent } from "@/lib/services/events";

// ── Types ─────────────────────────────────────────────────────────────────

export interface ProjectPlan {
  goal: string | null;
  whyItMatters: string | null;
  nextMilestone: string | null;
  nextAction: string | null;
  openQuestions: string[];
  blockers: string[];
  planNotes: string | null;
  targetDate: string | null;
}

export interface ProjectPlanPatch {
  goal?: string | null;
  whyItMatters?: string | null;
  nextMilestone?: string | null;
  nextAction?: string | null;
  openQuestions?: string[];
  blockers?: string[];
  planNotes?: string | null;
  targetDate?: string | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────

function parseJsonArray(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as string[]) : [];
  } catch {
    return [];
  }
}

function isoString(val: unknown): string | null {
  if (!val) return null;
  if (val instanceof Date) return val.toISOString();
  const s = String(val);
  return s || null;
}

// ── Ensure columns (idempotent) ───────────────────────────────────────────

let planningColumnsReady: Promise<void> | null = null;

export function ensureProjectPlanningColumns(): Promise<void> {
  if (!planningColumnsReady) {
    planningColumnsReady = (async () => {
      const cols: [string, string][] = [
        ["goal", "TEXT"],
        ["why_it_matters", "TEXT"],
        ["open_questions", "TEXT"],
        ["blockers", "TEXT"],
        ["plan_notes", "TEXT"],
      ];
      for (const [col, type] of cols) {
        await prisma
          .$executeRawUnsafe(
            `ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "${col}" ${type}`,
          )
          .catch(() => {});
      }
    })()
      .then(() => undefined)
      .catch((error) => {
        planningColumnsReady = null;
        console.error("[projects] ensureProjectPlanningColumns failed", error);
      });
  }
  return planningColumnsReady!;
}

// ── Service functions ─────────────────────────────────────────────────────

type PlanRow = {
  goal: string | null;
  why_it_matters: string | null;
  next_milestone: string | null; // maps to "nextMilestone"
  next_action: string | null;    // maps to "nextAction"
  open_questions: string | null;
  blockers: string | null;
  plan_notes: string | null;
  target_date: Date | null;
};

// Postgres column names with mixed case need quoting; the existing Project
// columns use camelCase (Prisma default). We select them with quoted aliases.
const PLAN_SELECT = `
  "goal",
  "why_it_matters",
  "nextMilestone" AS next_milestone,
  "nextAction"    AS next_action,
  "open_questions",
  "blockers",
  "plan_notes",
  "targetDate"    AS target_date
`;

export async function getProjectPlan(
  userId: string,
  projectId: string,
): Promise<ProjectPlan | null> {
  requireCan(userId, "projects", "read");
  try {
    const rows = await prisma.$queryRawUnsafe<PlanRow[]>(
      `SELECT ${PLAN_SELECT} FROM "Project" WHERE "id" = $1 AND "userId" = $2 LIMIT 1`,
      projectId,
      userId,
    );
    const row = rows[0];
    if (!row) return null;
    return {
      goal: row.goal,
      whyItMatters: row.why_it_matters,
      nextMilestone: row.next_milestone,
      nextAction: row.next_action,
      openQuestions: parseJsonArray(row.open_questions),
      blockers: parseJsonArray(row.blockers),
      planNotes: row.plan_notes,
      targetDate: isoString(row.target_date),
    };
  } catch (error) {
    console.error("[projects] getProjectPlan failed", error);
    return null;
  }
}

export async function updateProjectPlan(
  userId: string,
  projectId: string,
  patch: ProjectPlanPatch,
): Promise<void> {
  requireCan(userId, "projects", "write");

  const sets: string[] = [];
  const values: unknown[] = [];
  let idx = 1;

  if (patch.goal !== undefined) { sets.push(`"goal" = $${idx++}`); values.push(patch.goal?.trim() || null); }
  if (patch.whyItMatters !== undefined) { sets.push(`"why_it_matters" = $${idx++}`); values.push(patch.whyItMatters?.trim() || null); }
  if (patch.nextMilestone !== undefined) { sets.push(`"nextMilestone" = $${idx++}`); values.push(patch.nextMilestone?.trim() || null); }
  if (patch.nextAction !== undefined) { sets.push(`"nextAction" = $${idx++}`); values.push(patch.nextAction?.trim() || null); }
  if (patch.openQuestions !== undefined) { sets.push(`"open_questions" = $${idx++}`); values.push(patch.openQuestions.length ? JSON.stringify(patch.openQuestions) : null); }
  if (patch.blockers !== undefined) { sets.push(`"blockers" = $${idx++}`); values.push(patch.blockers.length ? JSON.stringify(patch.blockers) : null); }
  if (patch.planNotes !== undefined) { sets.push(`"plan_notes" = $${idx++}`); values.push(patch.planNotes?.trim() || null); }
  if (patch.targetDate !== undefined) { sets.push(`"targetDate" = $${idx++}::timestamptz`); values.push(patch.targetDate ?? null); }

  if (sets.length === 0) return;

  sets.push(`"updatedAt" = NOW()`);
  values.push(projectId, userId);

  await prisma.$executeRawUnsafe(
    `UPDATE "Project" SET ${sets.join(", ")} WHERE "id" = $${idx++} AND "userId" = $${idx++}`,
    ...values,
  );
  await recordEvent({
    userId,
    tool: "projects",
    type: "project.updated",
    refId: projectId,
    meta: { planFields: Object.keys(patch) },
  });
}

export async function addProjectQuestion(
  userId: string,
  projectId: string,
  question: string,
): Promise<void> {
  requireCan(userId, "projects", "write");
  const plan = await getProjectPlan(userId, projectId);
  if (!plan) throw new Error("Project not found.");
  const updated = [...plan.openQuestions, question.trim()].filter(Boolean);
  await updateProjectPlan(userId, projectId, { openQuestions: updated });
}

export async function addProjectBlocker(
  userId: string,
  projectId: string,
  blocker: string,
): Promise<void> {
  requireCan(userId, "projects", "write");
  const plan = await getProjectPlan(userId, projectId);
  if (!plan) throw new Error("Project not found.");
  const updated = [...plan.blockers, blocker.trim()].filter(Boolean);
  await updateProjectPlan(userId, projectId, { blockers: updated });
}

export async function removeProjectQuestion(
  userId: string,
  projectId: string,
  question: string,
): Promise<void> {
  requireCan(userId, "projects", "write");
  const plan = await getProjectPlan(userId, projectId);
  if (!plan) return;
  const updated = plan.openQuestions.filter((q) => q !== question);
  await updateProjectPlan(userId, projectId, { openQuestions: updated });
}

export async function removeProjectBlocker(
  userId: string,
  projectId: string,
  blocker: string,
): Promise<void> {
  requireCan(userId, "projects", "write");
  const plan = await getProjectPlan(userId, projectId);
  if (!plan) return;
  const updated = plan.blockers.filter((b) => b !== blocker);
  await updateProjectPlan(userId, projectId, { blockers: updated });
}

// ── Snapshot helper — reads planning fields for all active projects ────────

export type ProjectPlanSummary = {
  projectId: string;
  projectName: string;
  goal: string | null;
  nextMilestone: string | null;
  nextAction: string | null;
  openQuestions: string[];
  blockers: string[];
  planNotes: string | null;
  targetDate: string | null;
  missingNextAction: boolean;
};

export async function listProjectPlanSummaries(
  userId: string,
): Promise<ProjectPlanSummary[]> {
  requireCan(userId, "projects", "read");
  try {
    const rows = await prisma.$queryRawUnsafe<
      Array<PlanRow & { id: string; name: string; status: string }>
    >(
      `SELECT "id", "name", "status", ${PLAN_SELECT}
       FROM "Project"
       WHERE "userId" = $1 AND "status" <> 'done'
       ORDER BY "updatedAt" DESC`,
      userId,
    );
    return rows.map((row) => ({
      projectId: row.id,
      projectName: row.name,
      goal: row.goal,
      nextMilestone: row.next_milestone,
      nextAction: row.next_action,
      openQuestions: parseJsonArray(row.open_questions),
      blockers: parseJsonArray(row.blockers),
      planNotes: row.plan_notes,
      targetDate: isoString(row.target_date),
      missingNextAction: !row.next_action && row.status === "active",
    }));
  } catch (error) {
    console.error("[projects] listProjectPlanSummaries failed", error);
    return [];
  }
}
