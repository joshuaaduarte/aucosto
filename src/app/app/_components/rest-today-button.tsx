"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { setRestTodayAction } from "../streak-actions";

// "Taking today off" next to the streak line. A rest day comes out of this
// week's goal and habit streaks skip over it (Apple's "pause rings" idea).
// It can only be set on the day or ahead of time, never backdated.

export function RestTodayButton({
  resting,
  onSaved,
}: {
  resting: boolean;
  /** Called with the saved state, before the page refreshes. */
  onSaved?: (rest: boolean) => void;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggle = async () => {
    if (pending) return;
    setPending(true);
    setError(null);
    try {
      const result = await setRestTodayAction(!resting);
      if (!result.ok) setError(result.error);
      else {
        onSaved?.(!resting);
        router.refresh();
      }
    } finally {
      setPending(false);
    }
  };

  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        onClick={toggle}
        disabled={pending}
        className="btn-ghost h-7 rounded-full px-2.5 text-[0.75rem]"
        style={{ color: "var(--text-muted)" }}
        data-testid="rest-today"
      >
        {pending ? "…" : resting ? "Resting today · undo" : "Taking today off"}
      </button>
      {error ? (
        <span className="text-[0.75rem]" style={{ color: "var(--attention)" }}>
          {error}
        </span>
      ) : null}
    </span>
  );
}
