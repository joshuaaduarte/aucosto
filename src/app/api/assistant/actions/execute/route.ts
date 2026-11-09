import { runAsAgent } from "@/lib/actor";
import { resolveAssistantAuth } from "@/lib/assistant-auth";
import { executeGatedAction } from "@/lib/assistant-execute";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const authed = await resolveAssistantAuth(req);
  if (!authed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = authed.userId;

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

  const run = () =>
    executeGatedAction(userId, {
      action,
      input: input as Record<string, unknown>,
      confirmed,
      source:
        typeof source === "object" && source !== null
          ? (source as Record<string, unknown>)
          : null,
      defaultActor: "assistant",
    });
  // A bearer key means an external agent, not Josh in the app: mark the
  // events it writes so usage numbers can tell the two apart.
  const outcome = authed.via === "bearer" ? await runAsAgent(run) : await run();

  if (!outcome.ok) {
    if (outcome.refused === "needs_confirmation") {
      return NextResponse.json(
        { error: outcome.error, requiresConfirmation: true, action, risk: outcome.risk },
        { status: 400 },
      );
    }
    if (outcome.refused === "unsupported") {
      return NextResponse.json({ error: outcome.error, supported: false }, { status: 400 });
    }
    if (outcome.refused === "high_risk") {
      return NextResponse.json(
        { error: outcome.error, requiresConfirmation: true },
        { status: 400 },
      );
    }
    if (outcome.refused === "unknown") {
      return NextResponse.json({ error: outcome.error }, { status: 400 });
    }
    return NextResponse.json(
      { ok: false, error: outcome.error, auditId: outcome.auditId },
      { status: 400 },
    );
  }

  const { result, auditId } = outcome;
  return NextResponse.json({
    ok: true,
    action,
    summary: result.summary,
    recordId: result.recordId,
    recordType: result.recordType,
    suggestedCalendarLink: result.suggestedCalendarLink ?? null,
    auditId,
  });
}
