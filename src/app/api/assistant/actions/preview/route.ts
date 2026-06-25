import { auth } from "@/auth";
import { ACTION_REGISTRY } from "@/lib/assistant-actions";
import { previewAction } from "@/lib/assistant-action-executor";
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

  const { action, input, source } = body as {
    action?: unknown;
    input?: unknown;
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
    return NextResponse.json({ error: `Action "${action}" is not supported`, supported: false }, { status: 400 });
  }

  const preview = await previewAction(userId, action, input as Record<string, unknown>);

  const actor =
    typeof source === "object" && source !== null && "actor" in source
      ? String((source as Record<string, unknown>).actor ?? "assistant")
      : "assistant";

  const auditId = await recordAudit({
    userId,
    action,
    actor,
    riskLevel: def.risk,
    confirmed: false,
    status: "previewed",
    source: (source as Record<string, unknown> | null) ?? null,
    normalizedInput: preview.ok ? preview.normalizedInput : (input as Record<string, unknown>),
    previewText: preview.previewText,
    resultRecordId: null,
    resultRecordType: null,
    beforeState: null,
  });

  if (!preview.ok) {
    return NextResponse.json({ ok: false, error: preview.error, auditId }, { status: 400 });
  }

  return NextResponse.json({
    ok: true,
    action,
    risk: def.risk,
    requiresConfirmation: def.confirmationRequired,
    previewText: preview.previewText,
    normalizedInput: preview.normalizedInput,
    warnings: preview.warnings,
    auditId,
  });
}
