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
      aria-label="Strike from the record"
      className="font-mono text-base text-ink-ghost transition-colors hover:text-oxblood disabled:opacity-40"
    >
      ✕
    </button>
  );
}
