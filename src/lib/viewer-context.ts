import "server-only";

import { cookies } from "next/headers";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export const APP_UNLOCK_COOKIE = "aucosto_app_unlock";
export const DEMO_MODE_COOKIE = "aucosto_demo_mode";

export type ViewerContext = {
  ownerUserId: string;
  effectiveUserId: string;
  displayName: string;
  financeVisible: boolean;
  appLockEnabled: boolean;
  isUnlocked: boolean;
  isDemoMode: boolean;
  hasDemoWorkspace: boolean;
};

export async function getViewerContext(): Promise<ViewerContext | null> {
  const session = await auth();
  if (!session?.user?.id) return null;

  const cookieStore = await cookies();
  const owner = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      name: true,
      email: true,
      financeVisible: true,
      appLockEnabled: true,
      demoWorkspace: { select: { id: true } },
    },
  });

  if (!owner) return null;

  const wantsDemo = cookieStore.get(DEMO_MODE_COOKIE)?.value === "1";
  const effectiveUserId = wantsDemo && owner.demoWorkspace?.id ? owner.demoWorkspace.id : owner.id;

  return {
    ownerUserId: owner.id,
    effectiveUserId,
    displayName: owner.name ?? owner.email,
    financeVisible: owner.financeVisible,
    appLockEnabled: owner.appLockEnabled,
    isUnlocked: !owner.appLockEnabled || cookieStore.get(APP_UNLOCK_COOKIE)?.value === "1",
    isDemoMode: effectiveUserId !== owner.id,
    hasDemoWorkspace: Boolean(owner.demoWorkspace?.id),
  };
}

export async function requireViewerContext(): Promise<ViewerContext> {
  const context = await getViewerContext();
  if (!context) {
    throw new Error("Not signed in.");
  }
  return context;
}

export async function resolveActiveUserId(): Promise<string> {
  const context = await requireViewerContext();
  return context.effectiveUserId;
}

export async function assertFinanceVisible(): Promise<ViewerContext> {
  const context = await requireViewerContext();
  if (!context.financeVisible) {
    throw new Error("Finance is hidden right now.");
  }
  return context;
}
