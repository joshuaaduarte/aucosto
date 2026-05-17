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
      className="group inline-flex items-baseline gap-1.5 font-serif text-sm italic text-ink-fade transition-colors hover:text-ink disabled:opacity-50"
    >
      <span
        aria-hidden
        className="font-mono text-[0.625rem] not-italic uppercase tracking-[0.22em] text-ink-ghost group-hover:text-oxblood"
      >
        ✕
      </span>
      {pending ? "signing out…" : "sign out"}
    </button>
  );
}
