"use client";

import { useTransition } from "react";
import { deleteAllTransactions } from "./actions";

export function ClearButton() {
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      onClick={() => {
        if (!confirm("Strike all entries from the record? This cannot be undone.")) {
          return;
        }
        startTransition(() => deleteAllTransactions());
      }}
      disabled={pending}
      className="font-serif text-sm italic text-ink-fade transition-colors hover:text-oxblood disabled:opacity-50"
    >
      {pending ? "Striking..." : "Strike all entries x"}
    </button>
  );
}
