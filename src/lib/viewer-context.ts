import "server-only";

import { cookies } from "next/headers";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getHouseholdMembership } from "@/lib/household";
import {
  FINANCE_SCOPE_COOKIE,
  parseFinanceScope,
  type FinanceScope,
  type HouseholdRole,
} from "@/lib/household-access";

export const DEMO_MODE_COOKIE = "aucosto_demo_mode";

export type ViewerContext = {
  /** The signed-in person (named "owner" for history: it is the viewer). */
  ownerUserId: string;
  /** Personal-tool scope: the viewer, or the demo workspace in demo mode. */
  effectiveUserId: string;
  /** "owner" unless this person joined someone's household as a partner. */
  role: HouseholdRole;
  householdId: string | null;
  householdName: string | null;
  /** The household's shared data user, when there is a household. */
  householdUserId: string | null;
  /** Partner whose access was removed: every app page shows a notice. */
  accessRemoved: boolean;
  /** Scope for finance reads/writes: household or the viewer's own ("Just me"). */
  financeUserId: string;
  financeScope: FinanceScope;
  /** Scope for the Home tool: household when there is one. */
  homeUserId: string;
  displayName: string;
  timezone: string;
  financeVisible: boolean;
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
      timezone: true,
      financeVisible: true,
      demoWorkspace: { select: { id: true } },
    },
  });

  if (!owner) return null;

  const membership = await getHouseholdMembership(owner.id);
  const role: HouseholdRole = membership?.role ?? "owner";
  const accessRemoved = role === "partner" && membership?.removed === true;
  const householdUserId = membership && !membership.removed ? membership.dataUserId : null;

  // Demo mode is an owner-only tool; partners never enter it.
  const wantsDemo = role === "owner" && cookieStore.get(DEMO_MODE_COOKIE)?.value === "1";
  const effectiveUserId = wantsDemo && owner.demoWorkspace?.id ? owner.demoWorkspace.id : owner.id;
  const isDemoMode = effectiveUserId !== owner.id;

  const requestedScope = parseFinanceScope(cookieStore.get(FINANCE_SCOPE_COOKIE)?.value);
  const financeScope: FinanceScope =
    householdUserId && !isDemoMode ? requestedScope : "personal";
  const financeUserId =
    financeScope === "household" && householdUserId ? householdUserId : effectiveUserId;
  const homeUserId = householdUserId && !isDemoMode ? householdUserId : effectiveUserId;

  return {
    ownerUserId: owner.id,
    effectiveUserId,
    role,
    householdId: membership && !membership.removed ? membership.householdId : null,
    householdName: membership && !membership.removed ? membership.householdName : null,
    householdUserId,
    accessRemoved,
    financeUserId,
    financeScope,
    homeUserId,
    displayName: owner.name ?? owner.email,
    timezone: owner.timezone,
    financeVisible: owner.financeVisible,
    isDemoMode,
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
  if (context.accessRemoved) {
    throw new Error("Your household access was removed.");
  }
  if (!context.financeVisible) {
    throw new Error("Finance is hidden right now.");
  }
  return context;
}

/** Viewer for Home-tool actions; refuses removed partners. */
export async function requireHomeViewer(): Promise<ViewerContext> {
  const context = await requireViewerContext();
  if (context.accessRemoved) {
    throw new Error("Your household access was removed.");
  }
  return context;
}
