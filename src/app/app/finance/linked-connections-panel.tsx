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
  return `Last sync ${new Date(value).toLocaleString([], {
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
    () =>
      [...connections].sort((a, b) =>
        (a.institutionName ?? "").localeCompare(b.institutionName ?? ""),
      ),
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
        setStatusMessage("Linking account and syncing fresh data...");
        startTransition(async () => {
          const result = await linkTellerConnection(
            enrollment.accessToken,
            enrollment.enrollmentId ?? enrollmentId,
          );
          setStatusMessage(
            result?.ok
              ? result.message
              : result?.error ?? "Could not link Teller connection.",
          );
        });
      },
      onExit: () => {
        setStatusMessage((current) => current ?? "Link flow closed.");
      },
    });

    connect.open();
  };

  return (
    <div className="space-y-6">
      <Script
        src="https://cdn.teller.io/connect/connect.js"
        strategy="afterInteractive"
        onLoad={() => setScriptReady(true)}
      />

      <header className="rule-t border-ink/40 pt-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-baseline sm:justify-between">
          <div className="max-w-2xl">
            <p className="font-mono text-[0.6875rem] uppercase tracking-[0.24em] text-ink-fade">
              The Press Wire · Linked Banks
            </p>
            <h3 className="mt-2 font-display text-2xl font-medium italic tracking-[-0.02em] text-ink">
              Live balances and entries, read directly from the institution.
            </h3>
            <p className="mt-2 font-serif text-sm italic leading-relaxed text-ink-fade">
              Teller handles the login flow. Aucosto holds an encrypted token to
              refresh balances and pull new entries.
            </p>
          </div>

          <button
            type="button"
            disabled={!enabled || pending || !scriptReady}
            onClick={() => launchConnect()}
            className="btn-ink shrink-0"
          >
            {pending ? "Connecting..." : "Connect bank"}{" "}
            {!pending ? "->" : null}
          </button>
        </div>

        {!enabled ? (
          <p className="mt-4 rule-t rule-b border-aged-gold/50 bg-aged-gold/10 px-4 py-3 font-serif text-sm italic text-ink-soft">
            {reason ?? "Teller is not configured yet."}
          </p>
        ) : null}
        {enabled && !scriptReady ? (
          <p className="mt-4 font-serif text-sm italic text-ink-fade">
            Loading Teller Connect...
          </p>
        ) : null}
        {statusMessage ? (
          <p className="mt-4 font-serif text-sm italic text-ink-soft">{statusMessage}</p>
        ) : null}
      </header>

      {sortedConnections.length === 0 ? (
        <p className="rule-t rule-b border-rule px-2 py-10 text-center font-serif italic text-ink-fade">
          No banks are wired in yet.
        </p>
      ) : (
        <ul>
          {sortedConnections.map((connection) => (
            <li key={connection.id} className="rule-t border-ink/30 py-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-baseline lg:justify-between">
                <div>
                  <div className="flex flex-wrap items-baseline gap-2">
                    <p className="font-display text-lg text-ink">
                      {connection.institutionName ?? "Linked institution"}
                    </p>
                    <span className="font-mono text-[0.625rem] uppercase tracking-[0.2em] text-ink-fade">
                      - {connection.provider}
                    </span>
                    <span
                      className={`font-mono text-[0.625rem] uppercase tracking-[0.2em] ${
                        connection.status === "active" ? "text-verdigris" : "text-ink-fade"
                      }`}
                    >
                      · {connection.status}
                    </span>
                  </div>
                  <p className="mt-1.5 font-serif text-sm italic text-ink-fade">
                    <span className="not-italic font-mono tabular text-ink-soft">
                      {connection.accountCount}
                    </span>{" "}
                    linked account{connection.accountCount === 1 ? "" : "s"} ·{" "}
                    <span className="not-italic font-mono tabular text-ink-fade">
                      {formatSyncLabel(connection.lastSyncedAt)}
                    </span>
                  </p>
                  {connection.lastSyncError ? (
                    <p className="mt-1.5 font-serif text-sm italic text-oxblood">
                      {connection.lastSyncError}
                    </p>
                  ) : null}
                  {connection.disconnectedReason ? (
                    <p className="mt-1.5 font-serif text-sm italic text-aged-gold">
                      Disconnected: {connection.disconnectedReason}
                    </p>
                  ) : null}
                </div>

                <div className="flex flex-wrap items-baseline gap-x-5 gap-y-2">
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => {
                      setStatusMessage("Syncing linked bank data...");
                      startTransition(async () => {
                        const result = await syncLinkedFinanceConnection(connection.id);
                        setStatusMessage(
                          result?.ok
                            ? `${result.message}${result.transactionCount != null ? ` Pulled ${result.transactionCount} entries.` : ""}`
                            : result?.error ?? "Could not sync linked account.",
                        );
                      });
                    }}
                    className="font-serif text-sm italic text-ink-fade transition-colors hover:text-ink disabled:opacity-50"
                  >
                    Sync now {"->"}
                  </button>
                  <button
                    type="button"
                    disabled={!enabled || pending || !scriptReady}
                    onClick={() => launchConnect(connection.enrollmentId)}
                    className="font-serif text-sm italic text-ink-fade transition-colors hover:text-ink disabled:opacity-50"
                  >
                    Repair
                  </button>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => {
                      setStatusMessage("Disconnecting linked bank sync...");
                      startTransition(async () => {
                        const result = await disconnectLinkedFinanceConnection(connection.id);
                        setStatusMessage(
                          result?.ok
                            ? result.message
                            : result?.error ?? "Could not disconnect linked account.",
                        );
                      });
                    }}
                    className="font-serif text-sm italic text-oxblood transition-colors hover:underline disabled:opacity-50"
                  >
                    Disconnect x
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
