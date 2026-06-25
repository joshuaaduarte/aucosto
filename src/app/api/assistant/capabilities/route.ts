import { auth } from "@/auth";
import { ACTION_REGISTRY } from "@/lib/assistant-actions";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json({
    version: 1,
    generatedAt: new Date().toISOString(),
    actions: Object.fromEntries(
      Object.entries(ACTION_REGISTRY).map(([key, def]) => [
        key,
        {
          risk: def.risk,
          confirmationRequired: def.confirmationRequired,
          supported: def.supported,
          description: def.description,
        },
      ]),
    ),
  });
}
