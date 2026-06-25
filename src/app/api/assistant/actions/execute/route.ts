import { auth } from "@/auth";
import { ACTION_REGISTRY } from "@/lib/assistant-actions";
import { executeAction } from "@/lib/assistant-action-executor";
import { recordAudit } from "@/lib/assistant-action-audit";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (typeof body !== "object" || body === null) {
    return NextResponse.json({ error: "Request body must be an object" }, { status: 400 });
  }

  const { action, input, confirmed, source } = body as {
    action?: unknown;
    input?: unknown;
    confirmed?: unknown;
    source?: unknown;
  };

  if (typeof action !== "string" || !action) {
    return NextResponse.json({ error: "action is required" }, { status: 400 });
  }
  if (typeof input !== "object" || input === null) {
    return NextResponse.json({ error: "input must be an object" }, { status: 400 });
  }

  const def = ACTION_REGISTRY[action];
  if (!def) {
    return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
  }
  if (!def.supported) {
    return NextResponse.json(
      { error: `Action "${action}" is not supported`, supported: false },
      { status: 400 },
    );
  }

  // High-risk actions are never executed via the API (finance_write, etc.).
  if (def.risk === "high") {
    return NextResponse.json(
      { error: `High-risk action "${action}" requires manual execution`, requiresConfirmation: true },
      { status: 400 },
    );
  }

  // Medium/high risk requires explicit confirmation.
  if (def.confirmationRequired && confirmed !== true) {
    return NextResponse.json(
      {
        error: "Confirmation required for this action — re-send with confirmed: true",
        requiresConfirmation: true,
        action,
        risk: def.risk,
      },
      { status: 400 },
    );
  }

  const actor =
    typeof source === "object" && source !== null && "actor" in source
      ? String((source as Record<string, unknown>).actor ?? "assistant")
      : "assistant";

  const result = await executeAction(userId, action, input as Record<string, unknown>);

  const auditId = await recordAudit({
    userId,
    action,
    actor,
    riskLevel: def.risk,
    confirmed: confirmed === true,
    status: result.ok ? "executed" : "rejected",
    source: (source as Record<string, unknown> | null) ?? null,
    normalizedInput: input as Record<string, unknown>,
    previewText: result.summary,
    resultRecordId: result.recordId,
    resultRecordType: result.recordType,
    beforeState: null,
  });

  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error, auditId }, { status: 400 });
  }

  return NextResponse.json({
    ok: true,
    action,
    summary: result.summary,
    recordId: result.recordId,
    recordType: result.recordType,
    auditId,
  });
}
