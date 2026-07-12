// Owner resolution for token-authenticated webhooks that have no session
// (e.g. /api/location/ingest called by an iOS Shortcut). Single-user app:
// the owner is the seeded user. Infra-level User read — one of the documented
// exceptions to the services-only prisma rule (like viewer-context.ts and
// demo-workspace.ts).

import "server-only";
import { prisma } from "@/lib/prisma";

export async function resolveOwnerUserId(): Promise<string | null> {
  try {
    const email = process.env.SEED_USER_EMAIL?.trim();
    if (email) {
      const byEmail = await prisma.user.findUnique({
        where: { email },
        select: { id: true },
      });
      if (byEmail) return byEmail.id;
    }
    const first = await prisma.user.findFirst({
      where: { isDemo: false },
      orderBy: { createdAt: "asc" },
      select: { id: true },
    });
    return first?.id ?? null;
  } catch (error) {
    console.error("[owner] resolveOwnerUserId failed", error);
    return null;
  }
}
