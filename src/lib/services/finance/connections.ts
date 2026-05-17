import "server-only";
import { prisma } from "@/lib/prisma";
import { requireCan } from "@/lib/auth/can";
import { recordEvent } from "@/lib/services/events";
import { encryptSecret } from "@/lib/secrets";
import { tellerListAccounts } from "@/lib/teller";
import { syncFinanceConnection } from "./teller-sync";

export type LinkedFinanceConnectionSummary = {
  id: string;
  provider: string;
  institutionName: string | null;
  institutionId: string | null;
  enrollmentId: string;
  status: string;
  lastSyncedAt: string | null;
  lastSyncError: string | null;
  disconnectedReason: string | null;
  accountCount: number;
};

export async function listLinkedConnections(
  userId: string,
): Promise<LinkedFinanceConnectionSummary[]> {
  requireCan(userId, "finance", "read");
  const connections = await prisma.financeConnection.findMany({
    where: { userId },
    include: { accounts: { select: { id: true } } },
    orderBy: [{ status: "asc" }, { institutionName: "asc" }, { createdAt: "desc" }],
  });

  return connections.map((connection) => ({
    id: connection.id,
    provider: connection.provider,
    institutionName: connection.institutionName,
    institutionId: connection.institutionId,
    enrollmentId: connection.enrollmentId,
    status: connection.status,
    lastSyncedAt: connection.lastSyncedAt?.toISOString() ?? null,
    lastSyncError: connection.lastSyncError,
    disconnectedReason: connection.disconnectedReason,
    accountCount: connection.accounts.length,
  }));
}

export async function linkTellerConnection(
  userId: string,
  input: { accessToken: string; enrollmentId?: string | null },
): Promise<LinkedFinanceConnectionSummary> {
  requireCan(userId, "finance", "write");

  const accessToken = input.accessToken.trim();
  if (!accessToken) throw new Error("Missing Teller access token.");

  const tellerAccounts = await tellerListAccounts(accessToken);
  if (tellerAccounts.length === 0) {
    throw new Error("Teller returned no eligible accounts for this connection.");
  }

  const enrollmentId = input.enrollmentId?.trim() || tellerAccounts[0]!.enrollment_id;
  const institutionName = tellerAccounts[0]!.institution?.name ?? null;
  const institutionId = tellerAccounts[0]!.institution?.id ?? null;

  let connection = await prisma.financeConnection.findFirst({
    where: { userId, provider: "teller", enrollmentId },
  });

  if (connection) {
    connection = await prisma.financeConnection.update({
      where: { id: connection.id },
      data: {
        institutionId,
        institutionName,
        accessTokenEnc: encryptSecret(accessToken),
        status: "active",
        disconnectedReason: null,
        lastSyncError: null,
      },
    });
  } else {
    connection = await prisma.financeConnection.create({
      data: {
        userId,
        provider: "teller",
        enrollmentId,
        institutionId,
        institutionName,
        accessTokenEnc: encryptSecret(accessToken),
      },
    });
  }

  await recordEvent({
    userId,
    tool: "finance",
    type: "finance.connection_linked",
    refId: connection.id,
    meta: { provider: "teller", institutionName, enrollmentId },
  });

  await syncFinanceConnection(userId, connection.id);

  const refreshed = await prisma.financeConnection.findUniqueOrThrow({
    where: { id: connection.id },
    include: { accounts: { select: { id: true } } },
  });

  return {
    id: refreshed.id,
    provider: refreshed.provider,
    institutionName: refreshed.institutionName,
    institutionId: refreshed.institutionId,
    enrollmentId: refreshed.enrollmentId,
    status: refreshed.status,
    lastSyncedAt: refreshed.lastSyncedAt?.toISOString() ?? null,
    lastSyncError: refreshed.lastSyncError,
    disconnectedReason: refreshed.disconnectedReason,
    accountCount: refreshed.accounts.length,
  };
}

export async function disconnectFinanceConnection(
  userId: string,
  connectionId: string,
): Promise<void> {
  requireCan(userId, "finance", "write");

  const connection = await prisma.financeConnection.findFirst({
    where: { id: connectionId, userId },
  });
  if (!connection) return;

  await prisma.financeConnection.delete({ where: { id: connection.id } });

  await recordEvent({
    userId,
    tool: "finance",
    type: "finance.connection_disconnected",
    refId: connection.id,
    meta: { provider: connection.provider, institutionName: connection.institutionName },
  });
}

export async function markFinanceConnectionDisconnected(input: {
  provider: string;
  enrollmentId: string;
  reason?: string | null;
}): Promise<void> {
  const connection = await prisma.financeConnection.findFirst({
    where: {
      provider: input.provider,
      enrollmentId: input.enrollmentId,
    },
  });
  if (!connection) return;

  await prisma.financeConnection.update({
    where: { id: connection.id },
    data: {
      status: "disconnected",
      disconnectedReason: input.reason ?? "disconnected",
      lastSyncError: null,
    },
  });

  await recordEvent({
    userId: connection.userId,
    tool: "finance",
    type: "finance.connection_disconnected",
    refId: connection.id,
    meta: {
      provider: connection.provider,
      institutionName: connection.institutionName,
      reason: input.reason ?? null,
    },
  });
}
