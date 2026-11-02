// User-level settings the privacy panel mutates. Action handlers manage the
// auth check, the Next.js cookie writes, and revalidation; the database reads
// and writes live here so the "no direct prisma outside services" rule holds
// for the User model too.

import "server-only";
import { prisma } from "@/lib/prisma";
import { recordEvent } from "@/lib/services/events";

export type UpdatePrivacySettingsInput = {
  financeVisible: boolean;
};

/** Display name + finance visibility, for read surfaces like the assistant snapshot. */
export async function getUserProfile(
  userId: string,
): Promise<{ name: string | null; financeVisible: boolean } | null> {
  return prisma.user.findUnique({
    where: { id: userId },
    select: { name: true, financeVisible: true },
  });
}

export async function updatePrivacySettings(
  userId: string,
  input: UpdatePrivacySettingsInput,
): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: { financeVisible: input.financeVisible },
  });

  await recordEvent({
    userId,
    tool: "events",
    type: "user.privacy_updated",
    meta: { financeVisible: input.financeVisible },
  });
}
