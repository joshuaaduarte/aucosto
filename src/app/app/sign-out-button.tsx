"use client";

import { useTransition } from "react";
import { logout } from "./actions";

export function SignOutButton() {
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      onClick={() => startTransition(() => logout())}
      disabled={pending}
      className="inline-flex min-h-10 items-center justify-center rounded-full border border-zinc-200 bg-white/80 px-4 text-sm font-medium text-zinc-600 transition-colors hover:border-zinc-300 hover:text-zinc-900 disabled:opacity-50 dark:border-zinc-800 dark:bg-zinc-900/80 dark:text-zinc-300 dark:hover:border-zinc-700 dark:hover:text-zinc-100"
    >
      {pending ? "Signing out…" : "Sign out"}
    </button>
  );
}
