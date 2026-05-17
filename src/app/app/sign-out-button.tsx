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
      className="inline-flex min-h-11 w-full items-center justify-center rounded-full border border-zinc-200 bg-white/88 px-4 text-sm font-medium text-zinc-600 transition-colors hover:border-zinc-300 hover:text-zinc-900 disabled:opacity-50 sm:w-auto"
    >
      {pending ? "Signing out…" : "Sign out"}
    </button>
  );
}
