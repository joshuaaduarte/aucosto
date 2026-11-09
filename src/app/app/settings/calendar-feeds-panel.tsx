"use client";

// Settings → Calendars: link the private iCal feeds of outside calendars
// (Google, Outlook, iCloud). Events show read-only on the calendar and hub
// and refresh on their own; nothing is written back.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  addCalendarFeedAction,
  removeCalendarFeedAction,
  syncCalendarFeedAction,
  type FeedActionResult,
} from "./calendar-feeds-actions";

export type CalendarFeedRow = {
  id: string;
  name: string;
  host: string;
  /** ISO string (serialized across the RSC boundary). */
  lastSyncedAt: string | null;
  lastError: string | null;
  eventCount: number;
};

function formatSynced(iso: string | null) {
  if (!iso) return "not synced yet";
  const date = new Date(iso);
  return `synced ${date.toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })}`;
}

export function CalendarFeedsPanel({ feeds }: { feeds: CalendarFeedRow[] | null }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<FeedActionResult | null>(null);
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");

  if (feeds === null) {
    return (
      <p className="text-[0.8125rem]" style={{ color: "var(--text-muted)" }}>
        Calendar feeds need one database step first: apply{" "}
        <code className="font-mono text-[0.75rem]">scripts/create-calendar-feeds.sql</code>.
      </p>
    );
  }

  function run(action: () => Promise<FeedActionResult>, after?: () => void) {
    setResult(null);
    startTransition(async () => {
      const next = await action();
      setResult(next);
      if (next.ok) after?.();
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      {feeds.length > 0 ? (
        <ul className="space-y-2">
          {feeds.map((feed) => (
            <li
              key={feed.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2"
              style={{ borderColor: "var(--border-faint)" }}
            >
              <div className="min-w-0">
                <p className="truncate text-[0.875rem] font-medium" style={{ color: "var(--text)" }}>
                  {feed.name}
                </p>
                <p className="text-[0.75rem]" style={{ color: feed.lastError ? "var(--danger, #b91c1c)" : "var(--text-faint)" }}>
                  {feed.lastError
                    ? feed.lastError
                    : `${feed.host} · ${feed.eventCount} events · ${formatSynced(feed.lastSyncedAt)}`}
                </p>
              </div>
              <div className="flex shrink-0 gap-2">
                <button
                  type="button"
                  className="btn-ghost"
                  disabled={pending}
                  onClick={() => run(() => syncCalendarFeedAction(feed.id))}
                >
                  Refresh
                </button>
                <button
                  type="button"
                  className="btn-ghost"
                  disabled={pending}
                  onClick={() => {
                    if (window.confirm(`Remove ${feed.name}? Its events leave Aucosto.`)) {
                      run(() => removeCalendarFeedAction(feed.id));
                    }
                  }}
                >
                  Remove
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : null}

      <form
        className="space-y-2"
        onSubmit={(event) => {
          event.preventDefault();
          run(
            () => addCalendarFeedAction({ name, url }),
            () => {
              setName("");
              setUrl("");
            },
          );
        }}
      >
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            className="field sm:max-w-[12rem]"
            placeholder="Name (e.g. Work)"
            value={name}
            maxLength={60}
            onChange={(event) => setName(event.target.value)}
            aria-label="Calendar name"
          />
          <input
            className="field flex-1"
            placeholder="https://… or webcal://… private calendar link"
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            aria-label="Private calendar link"
            autoComplete="off"
            spellCheck={false}
          />
          <button type="submit" className="btn-ink" disabled={pending || url.trim().length < 8}>
            {pending ? "Linking…" : "Link calendar"}
          </button>
        </div>
        {result ? (
          <p
            className="text-[0.8125rem]"
            role="status"
            style={{ color: result.ok ? "var(--text-muted)" : "var(--danger, #b91c1c)" }}
          >
            {result.ok ? result.message : result.error}
          </p>
        ) : null}
      </form>

      <details className="text-[0.8125rem]" style={{ color: "var(--text-muted)" }}>
        <summary className="cursor-pointer">Where do I find the link?</summary>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>
            <strong>Google Calendar</strong> (on a computer): Settings → pick the calendar →
            Integrate calendar → copy “Secret address in iCal format”.
          </li>
          <li>
            <strong>Outlook</strong>: Settings → Calendar → Shared calendars → Publish a calendar →
            choose “Can view all details” → copy the ICS link.
          </li>
          <li>
            <strong>iCloud</strong>: Calendar app → share the calendar → Public Calendar → copy link.
          </li>
          <li>
            The link works like a password for that calendar. Aucosto stores it encrypted and only
            ever reads from it. Work admins sometimes turn these links off.
          </li>
        </ul>
      </details>
    </div>
  );
}
