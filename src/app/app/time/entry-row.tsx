"use client";

import { useEffect, useState, useTransition } from "react";
import { deleteEntry } from "./actions";

// Delete with a two-step confirm: first tap arms it ("Sure?"), second tap
// within 3s deletes. Hover-revealed on pointer devices; always visible on
// touch screens, where there is no hover to reveal it.

export function EntryDeleteButton({ id }: { id: string }) {
  const [pending, startTransition] = useTransition();
  const [armed, setArmed] = useState(false);

  useEffect(() => {
    if (!armed) return;
    const timer = window.setTimeout(() => setArmed(false), 3000);
    return () => window.clearTimeout(timer);
  }, [armed]);

  if (armed) {
    return (
      <button
        type="button"
        onClick={() => startTransition(() => deleteEntry(id))}
        disabled={pending}
        aria-label="Confirm delete"
        className="btn-icon self-center px-2 text-[0.6875rem] font-semibold"
        style={{
          width: "auto",
          color: "var(--accent-strong)",
          background: "var(--accent-tint)",
        }}
      >
        {pending ? "..." : "Sure?"}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setArmed(true)}
      aria-label="Delete entry"
      title="Delete"
      className="btn-icon self-center opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100 [@media(pointer:coarse)]:opacity-100"
    >
      <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" aria-hidden>
        <path d="M3.5 3.5l6 6M9.5 3.5l-6 6" />
      </svg>
    </button>
  );
}
