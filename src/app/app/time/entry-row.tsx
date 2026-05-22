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
      title="Delete"
      className="btn-icon opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100"
    >
      <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" aria-hidden>
        <path d="M3.5 3.5l6 6M9.5 3.5l-6 6" />
      </svg>
    </button>
  );
}
