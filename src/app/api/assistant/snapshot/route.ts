import { resolveAssistantAuth } from "@/lib/assistant-auth";
import { buildAssistantSnapshot } from "@/lib/assistant-snapshot";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const authed = await resolveAssistantAuth(req);
  if (!authed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const snapshot = await buildAssistantSnapshot(authed.userId);
  return NextResponse.json(snapshot);
}
