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
      className="btn-icon"
      aria-label="Sign out"
      title="Sign out"
    >
      {pending ? (
        <svg width="14" height="14" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" aria-hidden>
          <circle cx="7.5" cy="7.5" r="5" strokeDasharray="6 6" />
        </svg>
      ) : (
        <svg width="14" height="14" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M9 4V2.5A1.5 1.5 0 0 0 7.5 1H3a1.5 1.5 0 0 0-1.5 1.5v10A1.5 1.5 0 0 0 3 14h4.5A1.5 1.5 0 0 0 9 12.5V11" />
          <path d="M13 7.5H6M11 5.5l2 2-2 2" />
        </svg>
      )}
    </button>
  );
}
