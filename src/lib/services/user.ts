// User-level settings the privacy panel mutates. Action handlers manage the
// auth check, the Next.js cookie writes, and revalidation; the database reads
// and writes live here so the "no direct prisma outside services" rule holds
// for the User model too.

import "server-only";
import bcrypt from "bcryptjs";
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

export async function hasPassword(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { password: true } });
  return Boolean(user?.password);
}

/**
 * Change (or, for a Google-only account, set) the sign-in password. The
 * current password is required whenever one exists.
 */
export async function changePassword(
  userId: string,
  input: { currentPassword: string; newPassword: string },
): Promise<void> {
  if (input.newPassword.length < 10) {
    throw new Error("Use at least 10 characters.");
  }
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { password: true } });
  if (!user) throw new Error("Account not found.");
  if (user.password && !(await bcrypt.compare(input.currentPassword, user.password))) {
    throw new Error("Your current password is wrong.");
  }
  await prisma.user.update({
    where: { id: userId },
    data: { password: await bcrypt.hash(input.newPassword, 10) },
  });
  await recordEvent({ userId, tool: "events", type: "user.password_changed" });
}
