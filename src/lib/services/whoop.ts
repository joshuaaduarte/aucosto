// Whoop connection lifecycle + the morning-data read the hub uses. Tokens are
// encrypted at rest with AUTH_SECRET (src/lib/secrets.ts, same as Teller) and
// refreshed transparently when within a minute of expiry. Reads degrade to
// null — the hub renders fine without Whoop (docs/lessons.md: degrade,
// don't die).

import "server-only";
import { prisma } from "@/lib/prisma";
import { requireCan } from "@/lib/auth/can";
import { recordEvent } from "@/lib/services/events";
import { decryptSecret, encryptSecret } from "@/lib/secrets";
import {
  fetchLatestWhoopRecovery,
  fetchLatestWhoopSleep,
  getWhoopConfig,
  refreshWhoopTokens,
  type WhoopTokens,
} from "@/lib/whoop";
import { whoopSleepToMorning } from "@/lib/whoop-morning";
import { startOfToday } from "@/lib/time";

export type WhoopConnectionStatus = {
  connected: boolean;
  lastSyncedAt: Date | null;
  since: Date | null;
};

export async function saveWhoopConnection(
  userId: string,
  tokens: WhoopTokens,
  whoopUserId?: string | null,
): Promise<void> {
  requireCan(userId, "whoop", "write");
  await prisma.whoopConnection.upsert({
    where: { userId },
    create: {
      userId,
      whoopUserId: whoopUserId ?? null,
      accessToken: encryptSecret(tokens.accessToken),
      refreshToken: encryptSecret(tokens.refreshToken),
      expiresAt: tokens.expiresAt,
      scopes: tokens.scopes,
      status: "connected",
    },
    update: {
      whoopUserId: whoopUserId ?? undefined,
      accessToken: encryptSecret(tokens.accessToken),
      refreshToken: encryptSecret(tokens.refreshToken),
      expiresAt: tokens.expiresAt,
      scopes: tokens.scopes,
      status: "connected",
    },
  });
  await recordEvent({ userId, tool: "whoop", type: "whoop.connected" });
}

export async function disconnectWhoop(userId: string): Promise<void> {
  requireCan(userId, "whoop", "write");
  await prisma.whoopConnection.deleteMany({ where: { userId } });
  await recordEvent({ userId, tool: "whoop", type: "whoop.disconnected" });
}

export async function getWhoopStatus(
  userId: string,
): Promise<WhoopConnectionStatus> {
  requireCan(userId, "whoop", "read");
  try {
    const connection = await prisma.whoopConnection.findUnique({
      where: { userId },
    });
    return {
      connected: Boolean(connection && connection.status === "connected"),
      lastSyncedAt: connection?.lastSyncedAt ?? null,
      since: connection?.createdAt ?? null,
    };
  } catch (error) {
    console.error("[whoop] getWhoopStatus failed", error);
    return { connected: false, lastSyncedAt: null, since: null };
  }
}

/**
 * A decrypted, non-expired access token — refreshing (and persisting the
 * rotated pair) when needed. Null when not connected or refresh fails; a
 * failed refresh marks the row "error" so settings can show reconnect.
 */
async function getFreshAccessToken(userId: string): Promise<string | null> {
  const config = getWhoopConfig();
  if (!config.enabled) return null;
  const connection = await prisma.whoopConnection.findUnique({
    where: { userId },
  });
  if (!connection || connection.status !== "connected") return null;

  const expiresSoon =
    connection.expiresAt.getTime() - Date.now() < 60_000;
  if (!expiresSoon) {
    return decryptSecret(connection.accessToken);
  }

  try {
    const tokens = await refreshWhoopTokens({
      clientId: config.clientId,
      clientSecret: config.clientSecret,
      refreshToken: decryptSecret(connection.refreshToken),
    });
    await prisma.whoopConnection.update({
      where: { userId },
      data: {
        accessToken: encryptSecret(tokens.accessToken),
        refreshToken: encryptSecret(tokens.refreshToken),
        expiresAt: tokens.expiresAt,
      },
    });
    return tokens.accessToken;
  } catch (error) {
    console.error("[whoop] token refresh failed", error);
    await prisma.whoopConnection
      .update({ where: { userId }, data: { status: "error" } })
      .catch(() => {});
    return null;
  }
}

export type WhoopMorningPrefill = {
  /** "HH:mm" in the server's (owner-pinned) local clock. */
  wakeTime: string;
  sleepMinutes: number;
  /** 0–100, when Whoop has scored today's recovery. */
  recoveryScore: number | null;
};

function toHhMm(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/**
 * Whoop's auto-detected wake data for TODAY's morning check-in, or null
 * (not configured / not connected / no sleep ended today / API hiccup).
 * Called by the hub only while today's wake is uncaptured, so the external
 * API isn't hit on every hub render all day.
 */
export async function getWhoopMorningPrefill(
  userId: string,
): Promise<WhoopMorningPrefill | null> {
  requireCan(userId, "whoop", "read");
  try {
    const accessToken = await getFreshAccessToken(userId);
    if (!accessToken) return null;

    const [sleep, recovery] = await Promise.all([
      fetchLatestWhoopSleep(accessToken),
      fetchLatestWhoopRecovery(accessToken).catch(() => null),
    ]);
    const morning = whoopSleepToMorning(sleep, startOfToday());
    if (!morning) return null;

    await prisma.whoopConnection
      .update({ where: { userId }, data: { lastSyncedAt: new Date() } })
      .catch(() => {});

    return {
      wakeTime: toHhMm(morning.wakeAt),
      sleepMinutes: morning.sleepMinutes,
      recoveryScore: recovery?.score ?? null,
    };
  } catch (error) {
    console.error("[whoop] getWhoopMorningPrefill failed", error);
    return null;
  }
}
