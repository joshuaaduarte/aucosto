// Remove the Whoop connection (tokens are deleted, not just marked).

import { NextResponse } from "next/server";
import { getViewerContext } from "@/lib/viewer-context";
import { disconnectWhoop } from "@/lib/services/whoop";

export const dynamic = "force-dynamic";

export async function POST() {
  const context = await getViewerContext();
  if (!context) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }
  await disconnectWhoop(context.effectiveUserId);
  return NextResponse.json({ ok: true });
}
