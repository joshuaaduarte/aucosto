"use client";

// Floating "now tracking" bar: label, live elapsed time, Stop, and a Switch
// link to the time page (where the one-tap switch panel lives). Hidden on
// /app/time itself — the running card there already shows all of this.
// Sits above the mobile tab bar; floats at the bottom on desktop.

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { formatDuration } from "@/lib/time";
import { stopEntry } from "../time/actions";

export function TimerBarClient({
  entryLabel,
  color,
  startedAtIso,
}: {
  entryLabel: string;
  color: string;
  startedAtIso: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const startedAt = new Date(startedAtIso).getTime();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  if (pathname === "/app/time") return null;

  return (
    <div
      className="pointer-events-none fixed inset-x-0 z-40 flex justify-center px-4"
      style={{
        bottom:
          "calc(var(--mobile-tabbar-height, 0px) + env(safe-area-inset-bottom, 0px) + 0.625rem)",
      }}
    >
      <div
        className="pointer-events-auto flex w-full max-w-[26rem] items-center gap-2.5 rounded-full border py-1.5 pl-3.5 pr-1.5 shadow-lg"
        style={{
          background: "var(--bg-page)",
          borderColor: "var(--border-soft)",
          boxShadow: "var(--shadow-pop)",
        }}
      >
        <span
          className="ink-pulse h-2 w-2 shrink-0 rounded-full"
          style={{ background: color }}
          aria-hidden
        />
        <Link
          href="/app/time"
          className="min-w-0 flex-1 truncate text-[0.8125rem] font-medium"
          style={{ color: "var(--text)" }}
        >
          {entryLabel}
        </Link>
        <span
          className="tabular shrink-0 text-[0.8125rem] font-semibold"
          style={{ color: "var(--text)", fontFeatureSettings: '"tnum" 1' }}
        >
          {formatDuration(now - startedAt)}
        </span>
        <Link
          href="/app/time"
          className="btn-ghost h-8 shrink-0 rounded-full px-2.5 text-[0.75rem]"
        >
          Switch
        </Link>
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              await stopEntry();
              router.refresh();
            })
          }
          className="btn-ink h-8 shrink-0 rounded-full px-3 text-[0.75rem]"
        >
          {pending ? "..." : "Stop"}
        </button>
      </div>
    </div>
  );
}
