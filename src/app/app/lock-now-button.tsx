"use client";

import { useTransition } from "react";
import { lockAppNow } from "./privacy-actions";

export function LockNowButton() {
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      onClick={() => startTransition(() => lockAppNow())}
      disabled={pending}
      className="inline-flex min-h-11 w-full items-center justify-center rounded-full border border-zinc-200 bg-white/80 px-4 text-sm font-medium text-zinc-600 transition-colors hover:border-zinc-300 hover:text-zinc-900 disabled:opacity-50 sm:w-auto dark:border-zinc-800 dark:bg-zinc-900/80 dark:text-zinc-300 dark:hover:border-zinc-700 dark:hover:text-zinc-100"
    >
      {pending ? "Locking…" : "Lock now"}
    </button>
  );
}
