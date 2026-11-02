// Owner resolution for token-authenticated webhooks that have no session
// (e.g. /api/location/ingest called by an iOS Shortcut). Single-user app:
// the owner is the seeded user. Infra-level User read — one of the documented
// exceptions to the services-only prisma rule (like viewer-context.ts and
// demo-workspace.ts).

import "server-only";
import { prisma } from "@/lib/prisma";
import { isMissingHouseholdTable } from "@/lib/household";

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
    // Not the demo workspace, not a household's shared data user, and not a
    // household partner: the owner is the original single user. Falls back
    // to the pre-household query while the household tables don't exist.
    const first = await prisma.user
      .findFirst({
        where: {
          isDemo: false,
          householdData: null,
          NOT: { householdMembership: { is: { role: "partner" } } },
        },
        orderBy: { createdAt: "asc" },
        select: { id: true },
      })
      .catch((error: unknown) => {
        if (!isMissingHouseholdTable(error)) throw error;
        return prisma.user.findFirst({
          where: { isDemo: false },
          orderBy: { createdAt: "asc" },
          select: { id: true },
        });
      });
    return first?.id ?? null;
  } catch (error) {
    console.error("[owner] resolveOwnerUserId failed", error);
    return null;
  }
}
