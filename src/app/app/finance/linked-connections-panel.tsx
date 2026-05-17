"use client";

import Script from "next/script";
import { useMemo, useState, useTransition } from "react";
import {
  disconnectLinkedFinanceConnection,
  linkTellerConnection,
  syncLinkedFinanceConnection,
} from "./actions";

declare global {
  interface Window {
    TellerConnect?: {
      setup: (config: {
        applicationId: string;
        environment: "sandbox" | "development" | "production";
        products: string[];
        selectAccount?: "disabled" | "single" | "multiple";
        enrollmentId?: string;
        onSuccess: (enrollment: { accessToken: string; enrollmentId?: string }) => void;
        onExit?: () => void;
      }) => { open: () => void };
    };
  }
}

type ConnectionView = {
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

function formatSyncLabel(value: string | null): string {
  if (!value) return "Never synced";
  return `Last synced ${new Date(value).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })}`;
}

export function LinkedConnectionsPanel({
  enabled,
  applicationId,
  environment,
  reason,
  connections,
}: {
  enabled: boolean;
  applicationId?: string;
  environment: "sandbox" | "development" | "production";
  reason?: string;
  connections: ConnectionView[];
}) {
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [scriptReady, setScriptReady] = useState(false);

  const sortedConnections = useMemo(
    () => [...connections].sort((a, b) => (a.institutionName ?? "").localeCompare(b.institutionName ?? "")),
    [connections],
  );

  const launchConnect = (enrollmentId?: string) => {
    if (!enabled || !applicationId) return;
    if (!window.TellerConnect) {
      setStatusMessage("Teller Connect is still loading. Try again in a moment.");
      return;
    }

    const connect = window.TellerConnect.setup({
      applicationId,
      environment,
      products: ["balance", "transactions"],
      selectAccount: "multiple",
      ...(enrollmentId ? { enrollmentId } : {}),
      onSuccess: (enrollment) => {
        setStatusMessage("Linking account and syncing fresh data…");
        startTransition(async () => {
          const result = await linkTellerConnection(
            enrollment.accessToken,
            enrollment.enrollmentId ?? enrollmentId,
          );
          setStatusMessage(result?.ok ? result.message : result?.error ?? "Could not link Teller connection.");
        });
      },
      onExit: () => {
        setStatusMessage((current) => current ?? "Link flow closed.");
      },
    });

    connect.open();
  };

  return (
    <div className="space-y-4">
      <Script
        src="https://cdn.teller.io/connect/connect.js"
        strategy="afterInteractive"
        onLoad={() => setScriptReady(true)}
      />

      <div className="rounded-[1.7rem] border border-zinc-200 bg-white/92 p-5 shadow-[0_18px_50px_-38px_rgba(24,24,27,0.16)]">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="max-w-2xl">
            <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-zinc-500">Linked banks</p>
            <h2 className="mt-2 text-xl font-semibold tracking-tight text-zinc-950">
              Read-only live balances and transactions.
            </h2>
            <p className="mt-2 text-sm leading-6 text-zinc-500">
              Teller handles the bank login flow. Aucosto stores an encrypted access token so it can refresh balances and pull new transactions later.
            </p>
          </div>

          <button
            type="button"
            disabled={!enabled || pending || !scriptReady}
            onClick={() => launchConnect()}
            className="inline-flex min-h-11 items-center justify-center rounded-xl bg-zinc-900 px-4 text-sm font-medium text-zinc-50 transition-colors hover:bg-zinc-800 disabled:opacity-50"
          >
            {pending ? "Working…" : "Connect bank"}
          </button>
        </div>

        {!enabled ? (
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            {reason ?? "Teller is not configured yet."}
          </div>
        ) : null}
        {enabled && !scriptReady ? (
          <p className="mt-4 text-sm text-zinc-500">Loading Teller Connect…</p>
        ) : null}
        {statusMessage ? <p className="mt-4 text-sm text-zinc-500">{statusMessage}</p> : null}
      </div>

      {sortedConnections.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-zinc-300 px-5 py-8 text-sm text-zinc-500">
          No linked bank connections yet.
        </div>
      ) : (
        <div className="space-y-3">
          {sortedConnections.map((connection) => (
            <div key={connection.id} className="rounded-[1.5rem] border border-zinc-200 bg-white p-4 shadow-sm shadow-zinc-950/5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-base font-medium text-zinc-900">
                      {connection.institutionName ?? "Linked institution"}
                    </p>
                    <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-[11px] uppercase tracking-[0.16em] text-zinc-600">
                      {connection.provider}
                    </span>
                    <span className={`rounded-full px-2.5 py-1 text-[11px] ${connection.status === "active" ? "bg-emerald-50 text-emerald-700" : "bg-zinc-100 text-zinc-700"}`}>
                      {connection.status}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-zinc-500">
                    {connection.accountCount} linked account{connection.accountCount === 1 ? "" : "s"} · {formatSyncLabel(connection.lastSyncedAt)}
                  </p>
                  {connection.lastSyncError ? (
                    <p className="mt-2 text-sm text-red-600">{connection.lastSyncError}</p>
                  ) : null}
                  {connection.disconnectedReason ? (
                    <p className="mt-2 text-sm text-amber-700">Disconnected: {connection.disconnectedReason}</p>
                  ) : null}
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => {
                      setStatusMessage("Syncing linked bank data…");
                      startTransition(async () => {
                        const result = await syncLinkedFinanceConnection(connection.id);
                        setStatusMessage(result?.ok ? `${result.message}${result.transactionCount != null ? ` Pulled ${result.transactionCount} transaction updates.` : ""}` : result?.error ?? "Could not sync linked account.");
                      });
                    }}
                    className="inline-flex min-h-10 items-center justify-center rounded-xl border border-zinc-200 bg-white px-3.5 text-sm text-zinc-700 hover:border-zinc-300 hover:text-zinc-900 disabled:opacity-50"
                  >
                    Sync now
                  </button>
                  <button
                    type="button"
                    disabled={!enabled || pending || !scriptReady}
                    onClick={() => launchConnect(connection.enrollmentId)}
                    className="inline-flex min-h-10 items-center justify-center rounded-xl border border-zinc-200 bg-white px-3.5 text-sm text-zinc-700 hover:border-zinc-300 hover:text-zinc-900 disabled:opacity-50"
                  >
                    Repair connection
                  </button>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => {
                      setStatusMessage("Disconnecting linked bank sync…");
                      startTransition(async () => {
                        const result = await disconnectLinkedFinanceConnection(connection.id);
                        setStatusMessage(result?.ok ? result.message : result?.error ?? "Could not disconnect linked account.");
                      });
                    }}
                    className="inline-flex min-h-10 items-center justify-center rounded-xl border border-red-200 bg-red-50 px-3.5 text-sm text-red-700 hover:bg-red-100 disabled:opacity-50"
                  >
                    Disconnect
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
