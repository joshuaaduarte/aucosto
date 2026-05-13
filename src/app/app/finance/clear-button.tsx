"use client";

import { useTransition } from "react";
import { deleteAllTransactions } from "./actions";

export function ClearButton() {
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      onClick={() => {
        if (!confirm("Delete all transactions? This can't be undone.")) return;
        startTransition(() => deleteAllTransactions());
      }}
      disabled={pending}
      className="text-sm text-zinc-500 transition-colors hover:text-red-600 disabled:opacity-50 dark:hover:text-red-400"
    >
      {pending ? "Clearing…" : "Clear all"}
    </button>
  );
}
