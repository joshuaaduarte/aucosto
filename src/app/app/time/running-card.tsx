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
    <div className="rounded-[1.9rem] border border-emerald-200/80 bg-[linear-gradient(180deg,rgba(236,253,245,0.9),rgba(255,255,255,0.96)),radial-gradient(circle_at_top_right,rgba(56,189,248,0.14),transparent_32%)] p-5 shadow-[0_24px_70px_-50px_rgba(24,24,27,0.22)] sm:p-7">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-3">
          <div className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
            Running now{category ? ` · ${category}` : ""}
          </div>
          <div>
            <p className="text-2xl font-semibold tracking-tight text-zinc-950 sm:text-4xl">{label}</p>
            <p className="mt-3 font-mono text-[2.4rem] tabular-nums tracking-tight text-zinc-950 sm:text-5xl">
              {formatDuration(now - startedAt)}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => startTransition(() => stopEntry())}
          disabled={pending}
          className="inline-flex min-h-12 w-full items-center justify-center rounded-2xl border border-zinc-300 bg-white px-6 text-sm font-medium text-zinc-900 transition-colors hover:bg-zinc-50 disabled:opacity-50 sm:w-auto"
        >
          {pending ? "Stopping…" : "Stop timer"}
        </button>
      </div>
    </div>
  );
}
