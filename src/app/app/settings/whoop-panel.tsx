"use client";

// Settings → Whoop: connect/disconnect the Whoop account that auto-fills the
// morning check-in (wake time, sleep duration, recovery). The server decides
// whether the integration is configured at all; this panel just renders the
// state it's given.

import { useState } from "react";
import { useRouter } from "next/navigation";

export function WhoopPanel({
  configured,
  connected,
  lastSyncedAt,
  flag,
}: {
  /** WHOOP_CLIENT_ID / WHOOP_CLIENT_SECRET are present server-side. */
  configured: boolean;
  connected: boolean;
  /** ISO string — serialized across the RSC boundary. */
  lastSyncedAt: string | null;
  /** ?whoop= flag from the OAuth callback redirect, for one-shot feedback. */
  flag: string | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  if (!configured) {
    return (
      <p className="text-[0.8125rem]" style={{ color: "var(--text-muted)" }}>
        Create an app at{" "}
        <a
          href="https://developer.whoop.com"
          target="_blank"
          rel="noreferrer"
          className="underline underline-offset-2"
        >
          developer.whoop.com
        </a>{" "}
        (redirect URL: <code className="font-mono text-[0.75rem]">/api/whoop/callback</code>),
        then set <code className="font-mono text-[0.75rem]">WHOOP_CLIENT_ID</code> and{" "}
        <code className="font-mono text-[0.75rem]">WHOOP_CLIENT_SECRET</code> to enable
        this.
      </p>
    );
  }

  async function disconnect() {
    if (busy) return;
    setBusy(true);
    try {
      await fetch("/api/whoop/disconnect", { method: "POST" });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-[0.8125rem]" style={{ color: "var(--text-muted)" }}>
        {connected
          ? `Connected — the morning check-in pre-fills your wake time, sleep and recovery from Whoop.${
              lastSyncedAt
                ? ` Last read ${new Date(lastSyncedAt).toLocaleString()}.`
                : ""
            }`
          : "Connect your Whoop so the morning check-in can pre-fill wake time, sleep duration and recovery."}
      </p>
      {flag === "connected" ? (
        <p
          className="rounded-md px-3 py-2 text-[0.8125rem]"
          style={{ background: "var(--bg-tint)", color: "var(--text-muted)" }}
        >
          Whoop connected. 🎉
        </p>
      ) : null}
      {flag === "error" ? (
        <p
          className="rounded-md px-3 py-2 text-[0.8125rem]"
          style={{ background: "var(--accent-tint)", color: "var(--accent-strong)" }}
        >
          Connecting to Whoop failed — try again.
        </p>
      ) : null}
      {connected ? (
        <button type="button" onClick={disconnect} disabled={busy} className="btn-ghost">
          {busy ? "…" : "Disconnect Whoop"}
        </button>
      ) : (
        <a href="/api/whoop/connect" className="btn-ink inline-flex">
          Connect Whoop
        </a>
      )}
    </div>
  );
}
