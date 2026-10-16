import { resolveAssistantAuth } from "@/lib/assistant-auth";
import {
  plannedVsActualQuerySchema,
  fetchAssistantPlannedVsActual,
} from "@/lib/assistant-lists";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const authed = await resolveAssistantAuth(req);
  if (!authed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = plannedVsActualQuerySchema.safeParse(
    Object.fromEntries(new URL(req.url).searchParams.entries()),
  );
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid query params", details: parsed.error.issues },
      { status: 400 },
    );
  }

  const result = await fetchAssistantPlannedVsActual(authed.userId, parsed.data);
  return NextResponse.json(result);
}
