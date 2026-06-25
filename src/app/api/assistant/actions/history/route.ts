import { auth } from "@/auth";
import { getRecentAudits } from "@/lib/assistant-action-audit";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;

  const limitParam = req.nextUrl.searchParams.get("limit");
  const limit = Math.min(100, Math.max(1, Number(limitParam) || 20));

  try {
    const audits = await getRecentAudits(userId, limit);
    return NextResponse.json({ audits, count: audits.length });
  } catch (err) {
    console.error("[assistant/actions/history] failed to fetch audits", err);
    return NextResponse.json({ audits: [], count: 0 });
  }
}
