"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { auth } from "@/auth";
import { ensureDemoWorkspace, seedDemoWorkspaceData } from "@/lib/demo-workspace";
import { prisma } from "@/lib/prisma";
import { APP_UNLOCK_COOKIE, DEMO_MODE_COOKIE } from "@/lib/viewer-context";

export type PrivacyState =
  | { ok: true; message: string }
  | { ok: false; error: string }
  | undefined;

function revalidateApp() {
  revalidatePath("/app");
  revalidatePath("/app/time");
  revalidatePath("/app/finance");
}

async function requireOwnerUser() {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("Not signed in.");
  }
  return session.user.id;
}

export async function savePrivacySettings(
  _prev: PrivacyState,
  formData: FormData,
): Promise<PrivacyState> {
  const ownerUserId = await requireOwnerUser();
  const financeVisible = formData.get("financeVisible") === "on";
  const appLockEnabled = formData.get("appLockEnabled") === "on";
  const pin = String(formData.get("pin") ?? "").trim();

  const existing = await prisma.user.findUnique({
    where: { id: ownerUserId },
    select: { appLockPinHash: true },
  });

  if (!existing) return { ok: false, error: "User not found." };

  let appLockPinHash = existing.appLockPinHash;
  if (appLockEnabled) {
    if (pin) {
      if (!/^\d{4,8}$/.test(pin)) {
        return { ok: false, error: "PIN must be 4 to 8 digits." };
      }
      appLockPinHash = await bcrypt.hash(pin, 10);
    } else if (!appLockPinHash) {
      return { ok: false, error: "Set a PIN before enabling the app lock." };
    }
  } else {
    appLockPinHash = null;
  }

  await prisma.user.update({
    where: { id: ownerUserId },
    data: {
      financeVisible,
      appLockEnabled,
      appLockPinHash,
    },
  });

  const cookieStore = await cookies();
  if (appLockEnabled) {
    cookieStore.set(APP_UNLOCK_COOKIE, "1", {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 12,
    });
  } else {
    cookieStore.delete(APP_UNLOCK_COOKIE);
  }

  revalidateApp();
  return {
    ok: true,
    message: appLockEnabled
      ? "Privacy settings saved. App lock is enabled."
      : "Privacy settings saved.",
  };
}

export async function unlockApp(
  _prev: PrivacyState,
  formData: FormData,
): Promise<PrivacyState> {
  const ownerUserId = await requireOwnerUser();
  const pin = String(formData.get("pin") ?? "").trim();
  if (!pin) return { ok: false, error: "Enter your PIN." };

  const user = await prisma.user.findUnique({
    where: { id: ownerUserId },
    select: { appLockEnabled: true, appLockPinHash: true },
  });

  if (!user?.appLockEnabled || !user.appLockPinHash) {
    return { ok: false, error: "App lock is not enabled." };
  }

  const valid = await bcrypt.compare(pin, user.appLockPinHash);
  if (!valid) {
    return { ok: false, error: "Incorrect PIN." };
  }

  (await cookies()).set(APP_UNLOCK_COOKIE, "1", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 12,
  });

  revalidateApp();
  return { ok: true, message: "Unlocked." };
}

export async function lockAppNow() {
  (await cookies()).delete(APP_UNLOCK_COOKIE);
  revalidateApp();
}

export async function enableDemoMode(): Promise<PrivacyState> {
  const ownerUserId = await requireOwnerUser();
  const demoUserId = await ensureDemoWorkspace(ownerUserId);
  await seedDemoWorkspaceData(demoUserId);

  (await cookies()).set(DEMO_MODE_COOKIE, "1", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 12,
  });

  revalidateApp();
  return { ok: true, message: "Demo mode is on." };
}

export async function disableDemoMode(): Promise<PrivacyState> {
  (await cookies()).delete(DEMO_MODE_COOKIE);
  revalidateApp();
  return { ok: true, message: "Back to personal data." };
}

export async function resetDemoMode(): Promise<PrivacyState> {
  const ownerUserId = await requireOwnerUser();
  const demoUserId = await ensureDemoWorkspace(ownerUserId);
  await seedDemoWorkspaceData(demoUserId);
  (await cookies()).set(DEMO_MODE_COOKIE, "1", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 12,
  });
  revalidateApp();
  return { ok: true, message: "Demo data reset." };
}
