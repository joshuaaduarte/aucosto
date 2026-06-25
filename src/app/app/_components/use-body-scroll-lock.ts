"use client";

// Locks body scroll while a modal/bottom sheet is open. Tracked at module
// level via a set of per-instance tokens (not a plain counter) so
// overlapping/nested modals only release the lock when the last one closes —
// and so a double-fired effect (React dev double-invoke, a modal that
// re-locks before its sibling unlocks) can never desync the count, since
// Set add/delete are idempotent per token.

import { useEffect, useId } from "react";

const lockTokens = new Set<string>();

function applyLockState() {
  const value = lockTokens.size > 0 ? "hidden" : "";
  document.body.style.overflow = value;
  // Some browsers (Firefox, iOS Safari) use the html element as the scroll
  // container rather than body. Lock both so the page stays put in all cases.
  document.documentElement.style.overflow = value;
}

export function useBodyScrollLock(active: boolean = true) {
  const id = useId();
  useEffect(() => {
    if (!active) return;
    lockTokens.add(id);
    applyLockState();
    return () => {
      lockTokens.delete(id);
      applyLockState();
    };
  }, [active, id]);
}
