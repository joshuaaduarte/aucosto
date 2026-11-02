// Household membership, invites and the shared data user.
//
// Infra-level module (like viewer-context.ts and demo-workspace.ts): it reads
// and writes User rows directly, which is one of the documented exceptions to
// the services-only prisma rule. Tool data never goes through here.
//
// Every read is guarded against the household tables not existing yet
// (scripts/create-household-home.sql not applied): callers then see "no
// household" and the app behaves exactly as it did single-user.

import "server-only";

import { createHash, randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { recordEvent } from "@/lib/services/events";
import {
  inviteExpiry,
  inviteStatus,
  normalizeEmail,
  type HouseholdRole,
  type InviteStatus,
} from "@/lib/household-access";

export type HouseholdMembership = {
  householdId: string;
  householdName: string;
  dataUserId: string;
  role: HouseholdRole;
  removed: boolean;
};

export type HouseholdMemberSummary = {
  userId: string;
  name: string | null;
  email: string;
  role: HouseholdRole;
  removed: boolean;
  joinedAt: Date;
};

export type HouseholdInviteSummary = {
  id: string;
  email: string;
  expiresAt: Date;
  status: InviteStatus;
};

export function isMissingHouseholdTable(error: unknown): boolean {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2021") return true;
    if (error.code === "P2010") {
      return JSON.stringify(error.meta ?? {}).includes("42P01");
    }
  }
  return false;
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function toRole(value: string): HouseholdRole {
  return value === "partner" ? "partner" : "owner";
}

/** The viewer's household membership, or null (none, or tables missing). */
export async function getHouseholdMembership(
  userId: string,
): Promise<HouseholdMembership | null> {
  try {
    const member = await prisma.householdMember.findUnique({
      where: { userId },
      select: {
        role: true,
        removedAt: true,
        household: { select: { id: true, name: true, dataUserId: true } },
      },
    });
    if (!member) return null;
    return {
      householdId: member.household.id,
      householdName: member.household.name,
      dataUserId: member.household.dataUserId,
      role: toRole(member.role),
      removed: member.removedAt != null,
    };
  } catch (error) {
    if (!isMissingHouseholdTable(error)) {
      console.error("[household] membership read failed", error);
    }
    return null;
  }
}

/**
 * Create the household for an owner: a shadow data user (no password, so it
 * can never sign in) plus the owner's membership. Idempotent.
 */
export async function createHousehold(
  ownerUserId: string,
  name = "Our home",
): Promise<HouseholdMembership> {
  const existing = await getHouseholdMembership(ownerUserId);
  if (existing) {
    if (existing.role !== "owner") throw new Error("Only the owner can do that.");
    return existing;
  }

  const owner = await prisma.user.findUnique({
    where: { id: ownerUserId },
    select: { id: true, timezone: true },
  });
  if (!owner) throw new Error("Owner not found.");

  const household = await prisma.$transaction(async (tx) => {
    const dataUser = await tx.user.create({
      data: {
        name: name.trim() || "Our home",
        email: `household+${randomBytes(6).toString("hex")}@aucosto.local`,
        password: null,
        timezone: owner.timezone,
        financeVisible: true,
      },
    });
    const created = await tx.household.create({
      data: { name: name.trim() || "Our home", dataUserId: dataUser.id },
    });
    await tx.householdMember.create({
      data: { householdId: created.id, userId: ownerUserId, role: "owner" },
    });
    // Anything the owner already put in the Home tool moves with them.
    await tx.homeTask.updateMany({
      where: { userId: ownerUserId },
      data: { userId: dataUser.id },
    });
    await tx.homeListItem.updateMany({
      where: { userId: ownerUserId },
      data: { userId: dataUser.id },
    });
    await tx.homeList.updateMany({
      where: { userId: ownerUserId },
      data: { userId: dataUser.id },
    });
    return created;
  });

  await recordEvent({
    userId: ownerUserId,
    tool: "household",
    type: "household.created",
    refId: household.id,
  });

  return {
    householdId: household.id,
    householdName: household.name,
    dataUserId: household.dataUserId,
    role: "owner",
    removed: false,
  };
}

export async function renameHousehold(ownerUserId: string, name: string): Promise<void> {
  const membership = await requireOwner(ownerUserId);
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Give the household a name.");
  await prisma.household.update({
    where: { id: membership.householdId },
    data: { name: trimmed.slice(0, 60) },
  });
}

async function requireOwner(userId: string): Promise<HouseholdMembership> {
  const membership = await getHouseholdMembership(userId);
  if (!membership || membership.role !== "owner" || membership.removed) {
    throw new Error("Only the household owner can do that.");
  }
  return membership;
}

export async function listHouseholdMembers(
  householdId: string,
): Promise<HouseholdMemberSummary[]> {
  try {
    const rows = await prisma.householdMember.findMany({
      where: { householdId },
      orderBy: { createdAt: "asc" },
      select: {
        role: true,
        removedAt: true,
        createdAt: true,
        user: { select: { id: true, name: true, email: true } },
      },
    });
    return rows.map((row) => ({
      userId: row.user.id,
      name: row.user.name,
      email: row.user.email,
      role: toRole(row.role),
      removed: row.removedAt != null,
      joinedAt: row.createdAt,
    }));
  } catch (error) {
    if (!isMissingHouseholdTable(error)) {
      console.error("[household] member list failed", error);
    }
    return [];
  }
}

/** userId → display name for everyone in the household (for attribution). */
export async function householdMemberNames(
  householdId: string,
): Promise<Record<string, string>> {
  const members = await listHouseholdMembers(householdId);
  return Object.fromEntries(
    members.map((member) => [member.userId, member.name ?? member.email.split("@")[0]!]),
  );
}

export async function listHouseholdInvites(
  householdId: string,
  now = new Date(),
): Promise<HouseholdInviteSummary[]> {
  try {
    const rows = await prisma.householdInvite.findMany({
      where: { householdId, acceptedAt: null },
      orderBy: { createdAt: "desc" },
      select: { id: true, email: true, expiresAt: true, acceptedAt: true },
    });
    return rows.map((row) => ({
      id: row.id,
      email: row.email,
      expiresAt: row.expiresAt,
      status: inviteStatus(row, now),
    }));
  } catch (error) {
    if (!isMissingHouseholdTable(error)) {
      console.error("[household] invite list failed", error);
    }
    return [];
  }
}

/**
 * Create an invite and return the raw token (shown once, as a link). Only the
 * hash is stored. Re-inviting the same email replaces the earlier invite.
 */
export async function createHouseholdInvite(
  ownerUserId: string,
  rawEmail: string,
): Promise<{ token: string; email: string; expiresAt: Date }> {
  const membership = await requireOwner(ownerUserId);
  const email = normalizeEmail(rawEmail);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("Enter a valid email address.");
  }

  const existingUser = await prisma.user.findUnique({
    where: { email },
    select: { id: true, householdMembership: { select: { householdId: true, removedAt: true } } },
  });
  if (existingUser) {
    const m = existingUser.householdMembership;
    const isRemovedMemberHere = m?.householdId === membership.householdId && m.removedAt != null;
    if (!isRemovedMemberHere) {
      throw new Error("That email already has an aucosto account.");
    }
  }

  const token = randomBytes(24).toString("base64url");
  const expiresAt = inviteExpiry(new Date());
  await prisma.$transaction([
    prisma.householdInvite.deleteMany({
      where: { householdId: membership.householdId, email, acceptedAt: null },
    }),
    prisma.householdInvite.create({
      data: {
        householdId: membership.householdId,
        email,
        tokenHash: hashToken(token),
        expiresAt,
        createdByUserId: ownerUserId,
      },
    }),
  ]);

  await recordEvent({
    userId: ownerUserId,
    tool: "household",
    type: "household.invited",
    meta: { email },
  });

  return { token, email, expiresAt };
}

export async function revokeHouseholdInvite(ownerUserId: string, inviteId: string): Promise<void> {
  const membership = await requireOwner(ownerUserId);
  await prisma.householdInvite.deleteMany({
    where: { id: inviteId, householdId: membership.householdId, acceptedAt: null },
  });
}

export type InviteLookup = {
  id: string;
  householdId: string;
  householdName: string;
  email: string;
  status: InviteStatus;
  /** An account already exists for this email (a re-invited removed member). */
  hasAccount: boolean;
};

export async function findInviteByToken(token: string): Promise<InviteLookup | null> {
  if (!token || token.length > 200) return null;
  try {
    const invite = await prisma.householdInvite.findUnique({
      where: { tokenHash: hashToken(token) },
      select: {
        id: true,
        email: true,
        expiresAt: true,
        acceptedAt: true,
        household: { select: { id: true, name: true } },
      },
    });
    if (!invite) return null;
    const account = await prisma.user.findUnique({
      where: { email: invite.email },
      select: { id: true },
    });
    return {
      id: invite.id,
      householdId: invite.household.id,
      householdName: invite.household.name,
      email: invite.email,
      status: inviteStatus(invite, new Date()),
      hasAccount: account != null,
    };
  } catch (error) {
    if (!isMissingHouseholdTable(error)) {
      console.error("[household] invite lookup failed", error);
    }
    return null;
  }
}

async function findValidInviteForEmail(email: string) {
  try {
    return await prisma.householdInvite.findFirst({
      where: { email: normalizeEmail(email), acceptedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: "desc" },
      select: { id: true, householdId: true },
    });
  } catch (error) {
    if (!isMissingHouseholdTable(error)) {
      console.error("[household] invite lookup failed", error);
    }
    return null;
  }
}

/**
 * Sign-in gate for OAuth providers: only people who already have an account
 * or hold a live invite may sign in. Nobody else can create an account.
 */
export async function isEmailAllowedToSignIn(rawEmail: string): Promise<boolean> {
  const email = normalizeEmail(rawEmail);
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });
  if (user) return true;
  return (await findValidInviteForEmail(email)) != null;
}

async function joinHousehold(userId: string, householdId: string, inviteId: string) {
  await prisma.$transaction([
    prisma.householdMember.upsert({
      where: { userId },
      create: { householdId, userId, role: "partner" },
      update: { householdId, role: "partner", removedAt: null },
    }),
    prisma.householdInvite.update({
      where: { id: inviteId },
      data: { acceptedAt: new Date() },
    }),
    // Finance is the point of the invite: never start a partner hidden.
    prisma.user.update({ where: { id: userId }, data: { financeVisible: true } }),
  ]);
  await recordEvent({
    userId,
    tool: "household",
    type: "household.joined",
    refId: householdId,
  });
}

/**
 * Called on every sign-in (from the jwt callback). If the person holds a
 * live invite for their email, they join that household. No-op otherwise.
 */
export async function acceptPendingInviteForUser(userId: string, rawEmail: string): Promise<void> {
  const invite = await findValidInviteForEmail(rawEmail);
  if (!invite) return;
  const current = await getHouseholdMembership(userId);
  // Never demote an owner, and never move someone between households here.
  if (current && (current.role === "owner" || current.householdId !== invite.householdId)) {
    return;
  }
  await joinHousehold(userId, invite.householdId, invite.id);
}

/** Password path of the invite page: create the partner's account and join. */
export async function acceptInviteWithPassword(input: {
  token: string;
  name: string;
  password: string;
}): Promise<{ email: string }> {
  const invite = await findInviteByToken(input.token);
  if (!invite || invite.status !== "valid") {
    throw new Error("This invite link is no longer valid. Ask for a new one.");
  }
  if (input.password.length < 10) {
    throw new Error("Use at least 10 characters for your password.");
  }
  const hashed = await bcrypt.hash(input.password, 10);
  const name = input.name.trim().slice(0, 80) || null;

  const existing = await prisma.user.findUnique({
    where: { email: invite.email },
    select: { id: true },
  });
  const userId = existing
    ? (
        await prisma.user.update({
          where: { id: existing.id },
          data: { password: hashed, ...(name ? { name } : {}) },
        })
      ).id
    : (
        await prisma.user.create({
          data: { email: invite.email, name, password: hashed, financeVisible: true },
        })
      ).id;

  await joinHousehold(userId, invite.householdId, invite.id);
  return { email: invite.email };
}

/** Remove a partner's access. Their account stays; it just opens nothing. */
export async function removeHouseholdMember(ownerUserId: string, memberUserId: string): Promise<void> {
  const membership = await requireOwner(ownerUserId);
  if (memberUserId === ownerUserId) throw new Error("You can't remove yourself.");
  const updated = await prisma.householdMember.updateMany({
    where: { householdId: membership.householdId, userId: memberUserId, role: "partner" },
    data: { removedAt: new Date() },
  });
  if (updated.count > 0) {
    await recordEvent({
      userId: ownerUserId,
      tool: "household",
      type: "household.member_removed",
      refId: memberUserId,
    });
  }
}

/** Partner user ids (active or removed): excluded from owner-only crons. */
export async function listPartnerUserIds(): Promise<string[]> {
  try {
    const rows = await prisma.householdMember.findMany({
      where: { role: "partner" },
      select: { userId: true },
    });
    return rows.map((row) => row.userId);
  } catch (error) {
    if (!isMissingHouseholdTable(error)) {
      console.error("[household] partner list failed", error);
    }
    return [];
  }
}

export async function isPartnerUser(userId: string): Promise<boolean> {
  const membership = await getHouseholdMembership(userId);
  return membership?.role === "partner";
}

/**
 * Finance scope for callers without a viewer context (assistant bearer/MCP):
 * the household's data user when the person belongs to one, else themselves.
 */
export async function resolveFinanceScopeUserId(userId: string): Promise<string> {
  const membership = await getHouseholdMembership(userId);
  return membership && !membership.removed ? membership.dataUserId : userId;
}

/** Every household with its active members (for the household nudge cron). */
export async function listActiveHouseholds(): Promise<
  Array<{ householdId: string; dataUserId: string; memberUserIds: string[] }>
> {
  try {
    const rows = await prisma.household.findMany({
      select: {
        id: true,
        dataUserId: true,
        members: { where: { removedAt: null }, select: { userId: true } },
      },
    });
    return rows.map((row) => ({
      householdId: row.id,
      dataUserId: row.dataUserId,
      memberUserIds: row.members.map((m) => m.userId),
    }));
  } catch (error) {
    if (!isMissingHouseholdTable(error)) {
      console.error("[household] household list failed", error);
    }
    return [];
  }
}
