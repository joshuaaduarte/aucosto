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
    <div className="flex items-center justify-between gap-4 rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="space-y-1">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-zinc-500">
          Running{category ? ` · ${category}` : ""}
        </p>
        <p className="text-2xl font-semibold tracking-tight">{label}</p>
        <p className="font-mono text-sm tabular-nums text-zinc-500">
          {formatDuration(now - startedAt)}
        </p>
      </div>
      <button
        type="button"
        onClick={() => startTransition(() => stopEntry())}
        disabled={pending}
        className="inline-flex h-10 items-center justify-center rounded-md border border-zinc-300 px-5 text-sm font-medium transition-colors hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
      >
        {pending ? "Stopping…" : "Stop"}
      </button>
    </div>
  );
}
