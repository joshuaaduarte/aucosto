"use client";

import { useTransition } from "react";
import { deleteEntry } from "./actions";

export function EntryDeleteButton({ id }: { id: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      onClick={() => startTransition(() => deleteEntry(id))}
      disabled={pending}
      aria-label="Delete entry"
      className="text-zinc-400 transition-colors hover:text-red-600 disabled:opacity-50 dark:hover:text-red-400"
    >
      &times;
    </button>
  );
}
