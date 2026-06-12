"use client";

// Locks body scroll while a modal/bottom sheet is open. Reference-counted at
// module level so overlapping or nested modals can't unlock the page early:
// the lock releases only when the LAST active lock unmounts or deactivates.

import { useEffect } from "react";

let lockCount = 0;

export function useBodyScrollLock(active: boolean = true) {
  useEffect(() => {
    if (!active) return;
    lockCount += 1;
    if (lockCount === 1) {
      document.body.style.overflow = "hidden";
    }
    return () => {
      lockCount -= 1;
      if (lockCount === 0) {
        document.body.style.overflow = "";
      }
    };
  }, [active]);
}
