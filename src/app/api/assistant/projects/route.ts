import { resolveAssistantAuth } from "@/lib/assistant-auth";
import { fetchAssistantProjects } from "@/lib/assistant-lists";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const authed = await resolveAssistantAuth(req);
  if (!authed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await fetchAssistantProjects(authed.userId);
  return NextResponse.json(result);
}
