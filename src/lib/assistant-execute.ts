// Single gate for executing an assistant action. Both the REST route
// (/api/assistant/actions/execute) and the MCP `execute_action` tool call
// this, so the registry/risk/confirmation rules and the audit write can't
// drift apart between the two surfaces.
//
// Note: `confirmed: true` is asserted by the calling agent — it is not a
// human approval step. Medium-risk actions are reversible by design; anything
// that isn't belongs at risk "high", which is never executed here.

import "server-only";

import { ACTION_REGISTRY } from "@/lib/assistant-actions";
import { executeAction, type ExecuteResult } from "@/lib/assistant-action-executor";
import { recordAudit } from "@/lib/services/assistant-audit";

export type GatedExecuteRequest = {
  action: string;
  input: Record<string, unknown>;
  confirmed?: unknown;
  source?: Record<string, unknown> | null;
  /** Actor recorded when `source.actor` is absent ("assistant", "mcp", …). */
  defaultActor: string;
};

export type GatedExecuteOutcome =
  | { ok: true; result: ExecuteResult; auditId: string }
  | {
      ok: false;
      error: string;
      /** Set when the request was refused before execution. */
      refused?: "unknown" | "unsupported" | "high_risk" | "needs_confirmation";
      requiresConfirmation?: boolean;
      risk?: string;
      auditId?: string;
    };

export function resolveActor(source: unknown, fallback: string): string {
  if (typeof source === "object" && source !== null && "actor" in source) {
    const actor = (source as Record<string, unknown>).actor;
    if (typeof actor === "string" && actor) return actor;
  }
  return fallback;
}

export async function executeGatedAction(
  userId: string,
  request: GatedExecuteRequest,
): Promise<GatedExecuteOutcome> {
  const { action, input, confirmed, source } = request;
  const def = ACTION_REGISTRY[action];
  if (!def) return { ok: false, refused: "unknown", error: `Unknown action: ${action}` };
  if (!def.supported) {
    return { ok: false, refused: "unsupported", error: `Action "${action}" is not supported` };
  }
  if (def.risk === "high") {
    return {
      ok: false,
      refused: "high_risk",
      requiresConfirmation: true,
      error: `High-risk action "${action}" requires manual execution`,
    };
  }
  if (def.confirmationRequired && confirmed !== true) {
    return {
      ok: false,
      refused: "needs_confirmation",
      requiresConfirmation: true,
      risk: def.risk,
      error: "Confirmation required for this action — re-send with confirmed: true",
    };
  }

  const result = await executeAction(userId, action, input);
  const auditId = await recordAudit({
    userId,
    action,
    actor: resolveActor(source, request.defaultActor),
    riskLevel: def.risk,
    confirmed: confirmed === true,
    status: result.ok ? "executed" : "rejected",
    source: source ?? null,
    normalizedInput: input,
    previewText: result.summary,
    resultRecordId: result.recordId,
    resultRecordType: result.recordType,
    beforeState: null,
  });

  if (!result.ok) return { ok: false, error: result.error ?? "Execution failed", auditId };
  return { ok: true, result, auditId };
}
