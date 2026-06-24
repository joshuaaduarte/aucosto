import { auth } from "@/auth";
import { buildAssistantSnapshot } from "@/lib/assistant-snapshot";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const snapshot = await buildAssistantSnapshot(session.user.id);
  return NextResponse.json(snapshot);
}
