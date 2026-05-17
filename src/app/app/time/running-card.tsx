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
    <article className="rule-t rule-b border-ink relative bg-paper-deep/40 py-8 sm:py-12">
      {/* corner folio */}
      <span
        aria-hidden
        className="absolute left-0 top-2 font-mono text-[0.6875rem] uppercase tracking-[0.22em] text-oxblood"
      >
        ❦ In progress
      </span>
      <span
        aria-hidden
        className="absolute right-0 top-2 font-mono text-[0.6875rem] uppercase tracking-[0.22em] text-ink-fade"
      >
        Dispatch open
      </span>

      <div className="flex flex-col gap-8 px-2 sm:px-6 lg:flex-row lg:items-end lg:justify-between lg:gap-12">
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <span className="ink-pulse h-2 w-2 rounded-full bg-oxblood" aria-hidden />
            <span className="font-mono text-[0.6875rem] uppercase tracking-[0.22em] text-oxblood">
              Filed live{category ? ` · ${category}` : ""}
            </span>
          </div>
          <h2 className="font-display text-[2rem] font-medium leading-[1.05] tracking-[-0.03em] text-ink sm:text-[2.8rem]">
            {label}
          </h2>
          <p className="font-display font-medium leading-none tracking-[-0.04em] tabular text-ink text-[3rem] sm:text-[5rem]">
            {formatDuration(now - startedAt)}
          </p>
        </div>
        <button
          type="button"
          onClick={() => startTransition(() => stopEntry())}
          disabled={pending}
          className="btn-ghost shrink-0 self-start lg:self-end"
        >
          {pending ? "Closing dispatch…" : "Close this dispatch"}
        </button>
      </div>
    </article>
  );
}
