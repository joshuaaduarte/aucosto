// Web Push subscription management. The proxy matcher excludes /api, so
// every handler authenticates itself. GET → config for the settings panel
// (whether push is enabled server-side + the VAPID public key the browser
// needs to subscribe). POST → save/remove a subscription or send a test.

import { NextResponse } from "next/server";
import { z } from "zod";
import { getViewerContext } from "@/lib/viewer-context";
import {
  countPushSubscriptions,
  deletePushSubscription,
  getPushConfig,
  savePushSubscription,
  sendPushToUser,
} from "@/lib/services/push";

export const dynamic = "force-dynamic";

export async function GET() {
  const context = await getViewerContext();
  if (!context) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }
  const config = getPushConfig();
  const devices = await countPushSubscriptions(context.effectiveUserId);
  return NextResponse.json({
    enabled: config.enabled,
    publicKey: config.publicKey,
    devices,
  });
}

const subscribeSchema = z.object({
  action: z.literal("subscribe"),
  endpoint: z.string().url(),
  keys: z.object({ p256dh: z.string().min(1), auth: z.string().min(1) }),
});
const unsubscribeSchema = z.object({
  action: z.literal("unsubscribe"),
  endpoint: z.string().url(),
});
const testSchema = z.object({ action: z.literal("test") });

const bodySchema = z.discriminatedUnion("action", [
  subscribeSchema,
  unsubscribeSchema,
  testSchema,
]);

export async function POST(request: Request) {
  const context = await getViewerContext();
  if (!context) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }
  const userId = context.effectiveUserId;

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  const body = parsed.data;

  if (body.action === "subscribe") {
    await savePushSubscription(userId, {
      endpoint: body.endpoint,
      p256dh: body.keys.p256dh,
      auth: body.keys.auth,
      userAgent: request.headers.get("user-agent"),
    });
    return NextResponse.json({ ok: true }, { status: 201 });
  }

  if (body.action === "unsubscribe") {
    await deletePushSubscription(userId, body.endpoint);
    return NextResponse.json({ ok: true });
  }

  // action === "test"
  const sent = await sendPushToUser(userId, {
    title: "Aucosto",
    body: "Notifications are working. See you in the morning. 🌅",
    url: "/app",
  });
  return NextResponse.json({ ok: true, sent });
}
