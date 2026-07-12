// Whoop API client (OAuth 2.0 + the v2 developer API). Pure HTTP — token
// persistence and encryption live in src/lib/services/whoop.ts. Disabled
// (getWhoopConfig().enabled === false) until WHOOP_CLIENT_ID /
// WHOOP_CLIENT_SECRET are set from an app created at developer.whoop.com.

import "server-only";
import type { WhoopSleepRecord } from "@/lib/whoop-morning";

const AUTH_URL = "https://api.prod.whoop.com/oauth/oauth2/auth";
const TOKEN_URL = "https://api.prod.whoop.com/oauth/oauth2/token";
const API_BASE = "https://api.prod.whoop.com/developer";

export const WHOOP_SCOPES = "read:sleep read:recovery offline";

export type WhoopConfig =
  | { enabled: false }
  | { enabled: true; clientId: string; clientSecret: string };

export function getWhoopConfig(): WhoopConfig {
  const clientId = process.env.WHOOP_CLIENT_ID?.trim();
  const clientSecret = process.env.WHOOP_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) return { enabled: false };
  return { enabled: true, clientId, clientSecret };
}

export function buildWhoopAuthUrl(options: {
  clientId: string;
  redirectUri: string;
  state: string;
}): string {
  const url = new URL(AUTH_URL);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", options.clientId);
  url.searchParams.set("redirect_uri", options.redirectUri);
  url.searchParams.set("scope", WHOOP_SCOPES);
  url.searchParams.set("state", options.state);
  return url.toString();
}

export type WhoopTokens = {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
  scopes: string | null;
};

function parseTokenResponse(data: {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
}): WhoopTokens {
  if (!data.access_token || !data.refresh_token) {
    throw new Error("Whoop token response is missing tokens.");
  }
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: new Date(Date.now() + (data.expires_in ?? 3600) * 1000),
    scopes: data.scope ?? null,
  };
}

export async function exchangeWhoopCode(options: {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  code: string;
}): Promise<WhoopTokens> {
  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code: options.code,
      client_id: options.clientId,
      client_secret: options.clientSecret,
      redirect_uri: options.redirectUri,
    }),
  });
  if (!response.ok) {
    throw new Error(`Whoop code exchange failed (${response.status}).`);
  }
  return parseTokenResponse(await response.json());
}

export async function refreshWhoopTokens(options: {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
}): Promise<WhoopTokens> {
  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: options.refreshToken,
      client_id: options.clientId,
      client_secret: options.clientSecret,
      scope: "offline",
    }),
  });
  if (!response.ok) {
    throw new Error(`Whoop token refresh failed (${response.status}).`);
  }
  return parseTokenResponse(await response.json());
}

async function whoopGet<T>(accessToken: string, path: string): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    // Morning data is fetched at render time — never cache across users.
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`Whoop API ${path} failed (${response.status}).`);
  }
  return (await response.json()) as T;
}

/** Most recent sleep activity (may be yesterday's — callers filter). */
export async function fetchLatestWhoopSleep(
  accessToken: string,
): Promise<WhoopSleepRecord | null> {
  const data = await whoopGet<{ records?: WhoopSleepRecord[] }>(
    accessToken,
    "/v2/activity/sleep?limit=1",
  );
  return data.records?.[0] ?? null;
}

export type WhoopRecovery = {
  /** 0–100 recovery score. */
  score: number | null;
};

/** Most recent recovery score, when Whoop has computed one. */
export async function fetchLatestWhoopRecovery(
  accessToken: string,
): Promise<WhoopRecovery | null> {
  const data = await whoopGet<{
    records?: Array<{ score?: { recovery_score?: number } | null }>;
  }>(accessToken, "/v2/recovery?limit=1");
  const record = data.records?.[0];
  if (!record) return null;
  const score = record.score?.recovery_score;
  return { score: typeof score === "number" ? Math.round(score) : null };
}
