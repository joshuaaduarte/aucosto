// Whoop OAuth callback: verify state, exchange the code, store encrypted
// tokens, bounce back to settings with a status flag.

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getViewerContext } from "@/lib/viewer-context";
import { exchangeWhoopCode, getWhoopConfig } from "@/lib/whoop";
import { saveWhoopConnection } from "@/lib/services/whoop";

export const dynamic = "force-dynamic";

function settingsRedirect(request: Request, flag: string): NextResponse {
  return NextResponse.redirect(
    new URL(`/app/settings?whoop=${flag}`, request.url),
  );
}

export async function GET(request: Request) {
  const context = await getViewerContext();
  if (!context) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  const config = getWhoopConfig();
  if (!config.enabled) return settingsRedirect(request, "disabled");

  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const cookieStore = await cookies();
  const expectedState = cookieStore.get("aucosto_whoop_state")?.value;
  cookieStore.delete("aucosto_whoop_state");

  if (!code || !state || !expectedState || state !== expectedState) {
    return settingsRedirect(request, "error");
  }

  try {
    const tokens = await exchangeWhoopCode({
      clientId: config.clientId,
      clientSecret: config.clientSecret,
      redirectUri: `${url.origin}/api/whoop/callback`,
      code,
    });
    await saveWhoopConnection(context.effectiveUserId, tokens);
    return settingsRedirect(request, "connected");
  } catch (error) {
    console.error("[whoop] callback failed", error);
    return settingsRedirect(request, "error");
  }
}
