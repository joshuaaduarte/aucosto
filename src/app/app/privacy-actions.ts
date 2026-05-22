"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { auth } from "@/auth";
import { ensureDemoWorkspace, seedDemoWorkspaceData } from "@/lib/demo-workspace";
import {
  PrivacyValidationError,
  updatePrivacySettings,
  verifyAppLockPin,
} from "@/lib/services/user";
import { APP_UNLOCK_COOKIE, DEMO_MODE_COOKIE } from "@/lib/viewer-context";

export type PrivacyState =
  | { ok: true; message: string }
  | { ok: false; error: string }
  | undefined;

const UNLOCK_COOKIE_OPTS = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: 60 * 60 * 12,
};

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
  const pin = String(formData.get("pin") ?? "");

  try {
    await updatePrivacySettings(ownerUserId, { financeVisible, appLockEnabled, pin });
  } catch (error) {
    if (error instanceof PrivacyValidationError) {
      return { ok: false, error: error.message };
    }
    throw error;
  }

  const cookieStore = await cookies();
  if (appLockEnabled) {
    cookieStore.set(APP_UNLOCK_COOKIE, "1", UNLOCK_COOKIE_OPTS);
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

  const result = await verifyAppLockPin(ownerUserId, pin);
  if (!result.ok) {
    return {
      ok: false,
      error: result.reason === "disabled" ? "App lock is not enabled." : "Incorrect PIN.",
    };
  }

  (await cookies()).set(APP_UNLOCK_COOKIE, "1", UNLOCK_COOKIE_OPTS);

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

  (await cookies()).set(DEMO_MODE_COOKIE, "1", UNLOCK_COOKIE_OPTS);

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
  (await cookies()).set(DEMO_MODE_COOKIE, "1", UNLOCK_COOKIE_OPTS);
  revalidateApp();
  return { ok: true, message: "Demo data reset." };
}

export async function lockWidgetNow(_widgetId: string): Promise<void> {
  revalidateApp();
}

export async function removeWidgetPin(_widgetId: string): Promise<void> {
  revalidateApp();
}

export async function unlockWidget(
  _prev: PrivacyState,
  _formData: FormData,
): Promise<PrivacyState> {
  revalidateApp();
  return { ok: true, message: "Unlocked." };
}
