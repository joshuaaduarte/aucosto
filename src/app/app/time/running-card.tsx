"use client";

import { useEffect, useState, useTransition } from "react";
import { stopEntry } from "./actions";
import { formatDuration } from "@/lib/time";

export function RunningCard({
  label,
  category,
  startedAtIso,
}: {
  label: string;
  category: string | null;
  startedAtIso: string;
}) {
  const startedAt = new Date(startedAtIso).getTime();
  const [now, setNow] = useState(() => Date.now());
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <article
      className="rounded-md px-5 py-5"
      style={{
        background: "var(--accent-tint)",
        border: "1px solid var(--accent-tint-strong)",
      }}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span
              className="ink-pulse inline-block h-1.5 w-1.5 rounded-full"
              style={{ background: "var(--accent)" }}
              aria-hidden
            />
            <span
              className="text-[0.6875rem] font-semibold uppercase tracking-wider"
              style={{ color: "var(--accent-strong)" }}
            >
              Running{category ? ` · ${category}` : ""}
            </span>
          </div>
          <h2
            className="mt-2 truncate text-[1.5rem] font-bold tracking-tight sm:text-[1.875rem]"
            style={{ color: "var(--text)", letterSpacing: "-0.025em" }}
          >
            {label}
          </h2>
          <p
            className="mt-1 text-[2.5rem] font-semibold tabular leading-none sm:text-[3.25rem]"
            style={{
              color: "var(--text)",
              letterSpacing: "-0.03em",
              fontFeatureSettings: '"tnum" 1',
            }}
          >
            {formatDuration(now - startedAt)}
          </p>
        </div>
        <button
          type="button"
          onClick={() => startTransition(() => stopEntry())}
          disabled={pending}
          className="btn-ghost shrink-0"
        >
          {pending ? "Stopping…" : "Stop"}
        </button>
      </div>
    </article>
  );
}
