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
  appLockEnabled: boolean;
  pin?: string;
};

export type UpdatePrivacySettingsResult = {
  appLockEnabled: boolean;
};

export class PrivacyValidationError extends Error {}

export async function updatePrivacySettings(
  userId: string,
  input: UpdatePrivacySettingsInput,
): Promise<UpdatePrivacySettingsResult> {
  const existing = await prisma.user.findUnique({
    where: { id: userId },
    select: { appLockPinHash: true },
  });
  if (!existing) throw new PrivacyValidationError("User not found.");

  let appLockPinHash = existing.appLockPinHash;
  if (input.appLockEnabled) {
    const pin = input.pin?.trim();
    if (pin) {
      if (!/^\d{4,8}$/.test(pin)) {
        throw new PrivacyValidationError("PIN must be 4 to 8 digits.");
      }
      appLockPinHash = await bcrypt.hash(pin, 10);
    } else if (!appLockPinHash) {
      throw new PrivacyValidationError("Set a PIN before enabling the app lock.");
    }
  } else {
    appLockPinHash = null;
  }

  await prisma.user.update({
    where: { id: userId },
    data: {
      financeVisible: input.financeVisible,
      appLockEnabled: input.appLockEnabled,
      appLockPinHash,
    },
  });

  await recordEvent({
    userId,
    tool: "events",
    type: "user.privacy_updated",
    meta: {
      financeVisible: input.financeVisible,
      appLockEnabled: input.appLockEnabled,
    },
  });

  return { appLockEnabled: input.appLockEnabled };
}

export async function verifyAppLockPin(
  userId: string,
  pin: string,
): Promise<{ ok: true } | { ok: false; reason: "disabled" | "bad_pin" }> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { appLockEnabled: true, appLockPinHash: true },
  });
  if (!user?.appLockEnabled || !user.appLockPinHash) {
    return { ok: false, reason: "disabled" };
  }
  const ok = await bcrypt.compare(pin, user.appLockPinHash);
  if (!ok) return { ok: false, reason: "bad_pin" };
  return { ok: true };
}
