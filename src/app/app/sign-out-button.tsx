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
      className="text-sm font-medium text-ink-fade transition-colors hover:text-ink disabled:opacity-50"
    >
      {pending ? "Signing out…" : "Sign out"}
    </button>
  );
}
