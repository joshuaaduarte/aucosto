"use client";

// "Did this happen?" — ended calendar events waiting to become time entries.
// One tap logs an event with its own times (linked to the event), "Skip"
// remembers it didn't happen. Shown on the hub and the Time page.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { confirmEventsAction, skipEventAction } from "./confirm-events-actions";

export type ConfirmRow = {
  id: string;
  title: string;
  /** Pre-formatted local range, e.g. "9:00–9:30 AM · Yesterday". */
  when: string;
  minutes: number;
  linked: boolean;
};

function formatMinutes(minutes: number) {
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours}h ${rest}m` : `${hours}h`;
}

export function ConfirmEventsCard({ rows }: { rows: ConfirmRow[] }) {
  const router = useRouter();
  const [hidden, setHidden] = useState<Set<string>>(() => new Set());
  const [note, setNote] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const visible = rows.filter((row) => !hidden.has(row.id));
  if (visible.length === 0 && !note) return null;

  const hide = (ids: string[]) =>
    setHidden((current) => new Set([...current, ...ids]));

  const log = (ids: string[]) => {
    hide(ids);
    setNote(null);
    startTransition(async () => {
      const result = await confirmEventsAction(ids);
      if (!result.ok) {
        setNote(result.error);
      } else {
        setNote(
          result.failed > 0
            ? `Logged ${result.logged}; ${result.failed} couldn't be logged.`
            : `Logged ${result.logged} as time.`,
        );
      }
      router.refresh();
    });
  };

  const skip = (id: string) => {
    hide([id]);
    startTransition(async () => {
      await skipEventAction(id);
      router.refresh();
    });
  };

  return (
    <section
      id="confirm"
      className="fade-in-delay-1 rounded-lg border px-4 py-3.5"
      style={{ background: "var(--bg-page)", borderColor: "var(--border-faint)" }}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <p className="text-[0.875rem] font-semibold" style={{ color: "var(--text)" }}>
            Did these happen?
          </p>
          <p className="mt-0.5 text-[0.8125rem]" style={{ color: "var(--text-muted)" }}>
            Tap to log them as time. No timers needed.
          </p>
        </div>
        {visible.length > 1 ? (
          <button
            type="button"
            className="btn-ghost text-[0.8125rem]"
            disabled={pending}
            onClick={() => log(visible.map((row) => row.id))}
          >
            Log all {visible.length}
          </button>
        ) : null}
      </div>

      {visible.length > 0 ? (
        <ul className="mt-3 divide-y" style={{ borderColor: "var(--border-faint)" }}>
          {visible.map((row) => (
            <li key={row.id} className="flex items-center justify-between gap-3 py-2">
              <div className="min-w-0">
                <p className="truncate text-[0.875rem]" style={{ color: "var(--text)" }}>
                  {row.title}
                </p>
                <p className="text-[0.75rem] tabular" style={{ color: "var(--text-faint)" }}>
                  {row.when} · {formatMinutes(row.minutes)}
                  {row.linked ? " · linked calendar" : ""}
                </p>
              </div>
              <div className="flex shrink-0 gap-1.5">
                <button
                  type="button"
                  className="btn-ink h-8 px-3 text-[0.75rem]"
                  disabled={pending}
                  onClick={() => log([row.id])}
                >
                  Log it
                </button>
                <button
                  type="button"
                  className="btn-ghost h-8 px-2.5 text-[0.75rem]"
                  disabled={pending}
                  onClick={() => skip(row.id)}
                  aria-label={`${row.title} didn't happen`}
                >
                  Skip
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : null}

      {note ? (
        <p className="mt-2 text-[0.75rem]" role="status" style={{ color: "var(--text-muted)" }}>
          {note}
        </p>
      ) : null}
    </section>
  );
}
