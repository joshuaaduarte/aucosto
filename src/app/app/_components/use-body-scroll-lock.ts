"use client";

// Locks body scroll while a modal/bottom sheet is open. Tracked at module
// level via a set of per-instance tokens (not a plain counter) so
// overlapping/nested modals only release the lock when the last one closes —
// and so a double-fired effect (React dev double-invoke, a modal that
// re-locks before its sibling unlocks) can never desync the count, since
// Set add/delete are idempotent per token.
//
// iOS Safari ignores `overflow: hidden` on body for scroll-event propagation.
// `position: fixed` on body is the only reliable way to prevent the page from
// scrolling through a modal when the modal's inner scroller hits its boundary.
// We save/restore scrollY so the page position is unchanged after the modal
// closes.

import { useEffect, useId } from "react";

const lockTokens = new Set<string>();
let savedScrollY = 0;

function applyLock() {
  savedScrollY = window.scrollY;
  document.body.style.position = "fixed";
  document.body.style.top = `-${savedScrollY}px`;
  document.body.style.left = "0";
  document.body.style.right = "0";
  document.body.style.overflow = "hidden";
  document.documentElement.style.overflow = "hidden";
}

function releaseLock() {
  document.body.style.position = "";
  document.body.style.top = "";
  document.body.style.left = "";
  document.body.style.right = "";
  document.body.style.overflow = "";
  document.documentElement.style.overflow = "";
  window.scrollTo(0, savedScrollY);
}

export function useBodyScrollLock(active: boolean = true) {
  const id = useId();
  useEffect(() => {
    if (!active) return;
    const isFirst = lockTokens.size === 0;
    lockTokens.add(id);
    if (isFirst) applyLock();
    return () => {
      lockTokens.delete(id);
      if (lockTokens.size === 0) releaseLock();
    };
  }, [active, id]);
}
