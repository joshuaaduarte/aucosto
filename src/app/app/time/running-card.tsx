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
    <div className="rounded-[1.75rem] border border-emerald-200/80 bg-gradient-to-br from-emerald-50 via-white to-sky-50/60 p-6 shadow-[0_24px_70px_-50px_rgba(16,185,129,0.55)] dark:border-emerald-900/30 dark:from-emerald-950/30 dark:via-zinc-900 dark:to-sky-950/20 dark:shadow-none sm:p-7">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-3">
          <div className="inline-flex rounded-full bg-emerald-500/12 px-3 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-300">
            Running now{category ? ` · ${category}` : ""}
          </div>
          <div>
            <p className="text-3xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50 sm:text-4xl">{label}</p>
            <p className="mt-3 font-mono text-4xl tabular-nums tracking-tight text-zinc-950 dark:text-zinc-50 sm:text-5xl">
              {formatDuration(now - startedAt)}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => startTransition(() => stopEntry())}
          disabled={pending}
          className="inline-flex min-h-12 items-center justify-center rounded-2xl border border-zinc-300 bg-white px-6 text-sm font-medium text-zinc-900 transition-colors hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
        >
          {pending ? "Stopping…" : "Stop timer"}
        </button>
      </div>
    </div>
  );
}
