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
      className="text-sm font-medium text-ink-fade transition-colors hover:text-ink disabled:opacity-50"
    >
      {pending ? "Locking…" : "Lock"}
    </button>
  );
}
