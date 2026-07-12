// Web Push subscriptions + sending. Subscriptions are created from the
// Settings → Notifications panel; sends happen from the cron nudge route
// (/api/cron/nudges) and the settings test button. Dead endpoints (the push
// service answers 404/410) are pruned on send.

import "server-only";
import webpush from "web-push";
import { prisma } from "@/lib/prisma";
import { requireCan } from "@/lib/auth/can";
import { recordEvent } from "@/lib/services/events";

export type PushConfig = {
  enabled: boolean;
  publicKey: string | null;
};

/** Push is enabled when the VAPID keypair is present in the environment. */
export function getPushConfig(): PushConfig {
  const publicKey = process.env.VAPID_PUBLIC_KEY?.trim() || null;
  const privateKey = process.env.VAPID_PRIVATE_KEY?.trim() || null;
  return { enabled: Boolean(publicKey && privateKey), publicKey };
}

function configureWebPush(): boolean {
  const publicKey = process.env.VAPID_PUBLIC_KEY?.trim();
  const privateKey = process.env.VAPID_PRIVATE_KEY?.trim();
  if (!publicKey || !privateKey) return false;
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT?.trim() || "mailto:owner@aucosto.local",
    publicKey,
    privateKey,
  );
  return true;
}

export type PushSubscriptionInput = {
  endpoint: string;
  p256dh: string;
  auth: string;
  userAgent?: string | null;
};

export async function savePushSubscription(
  userId: string,
  input: PushSubscriptionInput,
): Promise<void> {
  requireCan(userId, "push", "write");
  await prisma.pushSubscription.upsert({
    where: { userId_endpoint: { userId, endpoint: input.endpoint } },
    create: {
      userId,
      endpoint: input.endpoint,
      p256dh: input.p256dh,
      auth: input.auth,
      userAgent: input.userAgent ?? null,
    },
    update: {
      p256dh: input.p256dh,
      auth: input.auth,
      userAgent: input.userAgent ?? null,
    },
  });
  await recordEvent({ userId, tool: "push", type: "push.subscribed" });
}

export async function deletePushSubscription(
  userId: string,
  endpoint: string,
): Promise<void> {
  requireCan(userId, "push", "write");
  await prisma.pushSubscription.deleteMany({ where: { userId, endpoint } });
  await recordEvent({ userId, tool: "push", type: "push.unsubscribed" });
}

export async function countPushSubscriptions(userId: string): Promise<number> {
  requireCan(userId, "push", "read");
  try {
    return await prisma.pushSubscription.count({ where: { userId } });
  } catch (error) {
    console.error("[push] countPushSubscriptions failed", error);
    return 0;
  }
}

/** Every userId that has at least one device subscribed (cron fan-out). */
export async function listSubscribedUserIds(): Promise<string[]> {
  try {
    const rows = await prisma.pushSubscription.findMany({
      distinct: ["userId"],
      select: { userId: true },
    });
    return rows.map((row) => row.userId);
  } catch (error) {
    console.error("[push] listSubscribedUserIds failed", error);
    return [];
  }
}

export type PushPayload = {
  title: string;
  body: string;
  /** In-app path to open on tap. */
  url?: string;
};

/**
 * Send a payload to every device the user subscribed. Returns how many sends
 * succeeded. Dead subscriptions (push service says 404/410) are deleted;
 * other per-device failures are logged and skipped — a bad device must never
 * take down the cron route.
 */
export async function sendPushToUser(
  userId: string,
  payload: PushPayload,
): Promise<number> {
  requireCan(userId, "push", "write");
  if (!configureWebPush()) return 0;

  const subscriptions = await prisma.pushSubscription.findMany({
    where: { userId },
  });
  let sent = 0;
  for (const subscription of subscriptions) {
    try {
      await webpush.sendNotification(
        {
          endpoint: subscription.endpoint,
          keys: { p256dh: subscription.p256dh, auth: subscription.auth },
        },
        JSON.stringify({ url: "/app", ...payload }),
      );
      sent += 1;
    } catch (error) {
      const statusCode = (error as { statusCode?: number }).statusCode;
      if (statusCode === 404 || statusCode === 410) {
        await prisma.pushSubscription
          .delete({ where: { id: subscription.id } })
          .catch(() => {});
      } else {
        console.error("[push] send failed", { statusCode }, error);
      }
    }
  }
  return sent;
}
