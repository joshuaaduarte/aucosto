"use server";

import { revalidatePath } from "next/cache";
import { cookies, headers } from "next/headers";
import { z } from "zod";
import { runAsActor } from "@/lib/actor";
import {
  createHousehold,
  createHouseholdInvite,
  removeHouseholdMember,
  renameHousehold,
  revokeHouseholdInvite,
} from "@/lib/household";
import { FINANCE_SCOPE_COOKIE, type FinanceScope } from "@/lib/household-access";
import { moveFinanceData } from "@/lib/services/finance";
import { changePassword } from "@/lib/services/user";
import { requireViewerContext } from "@/lib/viewer-context";

export type HouseholdState =
  | { ok: true; message: string; inviteUrl?: string }
  | { ok: false; error: string }
  | undefined;

function message(error: unknown, fallback: string): { ok: false; error: string } {
  return { ok: false, error: error instanceof Error ? error.message : fallback };
}

function revalidateAll() {
  revalidatePath("/app", "layout");
}

/** The signed-in owner's own id (never the demo workspace). */
async function requireOwner() {
  const context = await requireViewerContext();
  if (context.role !== "owner") throw new Error("Only the household owner can do that.");
  if (context.isDemoMode) throw new Error("Turn off demo mode first.");
  return context;
}

async function appOrigin(): Promise<string> {
  const configured = process.env.AUTH_URL?.trim() || process.env.NEXTAUTH_URL?.trim();
  if (configured) return new URL(configured).origin;
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

export async function setUpHousehold(
  _prev: HouseholdState,
  formData: FormData,
): Promise<HouseholdState> {
  try {
    const context = await requireOwner();
    await createHousehold(context.ownerUserId, String(formData.get("name") ?? ""));
    revalidateAll();
    return { ok: true, message: "Household created." };
  } catch (error) {
    return message(error, "Could not create the household.");
  }
}

export async function saveHouseholdName(
  _prev: HouseholdState,
  formData: FormData,
): Promise<HouseholdState> {
  try {
    const context = await requireOwner();
    await renameHousehold(context.ownerUserId, String(formData.get("name") ?? ""));
    revalidateAll();
    return { ok: true, message: "Saved." };
  } catch (error) {
    return message(error, "Could not rename the household.");
  }
}

export async function inviteToHousehold(
  _prev: HouseholdState,
  formData: FormData,
): Promise<HouseholdState> {
  try {
    const context = await requireOwner();
    const invite = await createHouseholdInvite(
      context.ownerUserId,
      String(formData.get("email") ?? ""),
    );
    revalidatePath("/app/settings");
    return {
      ok: true,
      message: `Invite ready for ${invite.email}. Send them this link; it works once and expires in 7 days.`,
      inviteUrl: `${await appOrigin()}/join/${invite.token}`,
    };
  } catch (error) {
    return message(error, "Could not create the invite.");
  }
}

export async function cancelHouseholdInvite(inviteId: string): Promise<HouseholdState> {
  try {
    const context = await requireOwner();
    await revokeHouseholdInvite(context.ownerUserId, inviteId);
    revalidatePath("/app/settings");
    return { ok: true, message: "Invite cancelled." };
  } catch (error) {
    return message(error, "Could not cancel the invite.");
  }
}

export async function removeFromHousehold(memberUserId: string): Promise<HouseholdState> {
  try {
    const context = await requireOwner();
    await removeHouseholdMember(context.ownerUserId, memberUserId);
    revalidatePath("/app/settings");
    return { ok: true, message: "Access removed." };
  } catch (error) {
    return message(error, "Could not remove access.");
  }
}

const moveSchema = z.object({
  direction: z.enum(["to_household", "to_personal"]),
  accountIds: z.array(z.string().min(1)).max(200),
  includeUnlinkedTransactions: z.boolean(),
  includePlanning: z.boolean(),
});

/**
 * Share finance with the household, or take it back to "Just me". Anyone
 * can share their own "Just me" data in; only the owner can take household
 * accounts out (there is no per-account owner to check a partner against).
 * Scope ids come from the viewer context, never from the client.
 */
export async function moveFinance(input: z.infer<typeof moveSchema>): Promise<HouseholdState> {
  try {
    const parsed = moveSchema.parse(input);
    const context = await requireViewerContext();
    if (context.isDemoMode) throw new Error("Turn off demo mode first.");
    if (!context.householdUserId) throw new Error("Set up the household first.");
    if (parsed.direction === "to_personal" && context.role !== "owner") {
      throw new Error("Ask the household owner to move that back.");
    }
    const personal = context.ownerUserId;
    const household = context.householdUserId;
    const [from, to] =
      parsed.direction === "to_household" ? [personal, household] : [household, personal];
    const result = await runAsActor(context.ownerUserId, () => moveFinanceData(from, to, parsed));
    revalidateAll();
    const parts = [
      `${result.accounts} account${result.accounts === 1 ? "" : "s"}`,
      `${result.transactions} transaction${result.transactions === 1 ? "" : "s"}`,
    ];
    if (result.goals) parts.push(`${result.goals} goal${result.goals === 1 ? "" : "s"}`);
    const dropped = result.duplicatesDropped
      ? ` ${result.duplicatesDropped} duplicate${result.duplicatesDropped === 1 ? "" : "s"} skipped.`
      : "";
    return {
      ok: true,
      message: `Moved ${parts.join(", ")} to ${parsed.direction === "to_household" ? "the household" : "Just me"}.${dropped}`,
    };
  } catch (error) {
    return message(error, "Could not move finance data.");
  }
}

export async function setFinanceScope(scope: FinanceScope): Promise<void> {
  (await cookies()).set(FINANCE_SCOPE_COOKIE, scope === "personal" ? "personal" : "household", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  revalidateAll();
}

export async function updatePassword(
  _prev: HouseholdState,
  formData: FormData,
): Promise<HouseholdState> {
  try {
    const context = await requireViewerContext();
    const next = String(formData.get("newPassword") ?? "");
    if (next !== String(formData.get("confirmPassword") ?? "")) {
      throw new Error("The new passwords don't match.");
    }
    await changePassword(context.ownerUserId, {
      currentPassword: String(formData.get("currentPassword") ?? ""),
      newPassword: next,
    });
    return { ok: true, message: "Password updated." };
  } catch (error) {
    return message(error, "Could not update the password.");
  }
}
