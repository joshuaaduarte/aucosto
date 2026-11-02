"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { auth } from "@/auth";
import { ensureDemoWorkspace, seedDemoWorkspaceData } from "@/lib/demo-workspace";
import { updatePrivacySettings } from "@/lib/services/user";
import { DEMO_MODE_COOKIE } from "@/lib/viewer-context";

export type PrivacyState =
  | { ok: true; message: string }
  | { ok: false; error: string }
  | undefined;

const DEMO_COOKIE_OPTS = {
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

  await updatePrivacySettings(ownerUserId, { financeVisible });

  revalidateApp();
  return { ok: true, message: "Privacy settings saved." };
}

export async function enableDemoMode(): Promise<PrivacyState> {
  const ownerUserId = await requireOwnerUser();
  const demoUserId = await ensureDemoWorkspace(ownerUserId);
  await seedDemoWorkspaceData(demoUserId);

  (await cookies()).set(DEMO_MODE_COOKIE, "1", DEMO_COOKIE_OPTS);

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
  (await cookies()).set(DEMO_MODE_COOKIE, "1", DEMO_COOKIE_OPTS);
  revalidateApp();
  return { ok: true, message: "Demo data reset." };
}
