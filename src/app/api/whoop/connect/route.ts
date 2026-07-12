// Kick off the Whoop OAuth flow: set a state cookie, redirect to Whoop's
// consent screen. The callback route (/api/whoop/callback) finishes it.

import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { getViewerContext } from "@/lib/viewer-context";
import { buildWhoopAuthUrl, getWhoopConfig } from "@/lib/whoop";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const context = await getViewerContext();
  if (!context) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  const config = getWhoopConfig();
  if (!config.enabled) {
    return NextResponse.json(
      { error: "Whoop isn't configured — set WHOOP_CLIENT_ID / WHOOP_CLIENT_SECRET." },
      { status: 503 },
    );
  }

  const state = randomBytes(16).toString("base64url");
  const cookieStore = await cookies();
  cookieStore.set("aucosto_whoop_state", state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 600,
    path: "/api/whoop",
  });

  return NextResponse.redirect(
    buildWhoopAuthUrl({
      clientId: config.clientId,
      redirectUri: `${new URL(request.url).origin}/api/whoop/callback`,
      state,
    }),
  );
}
