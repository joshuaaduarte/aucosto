"use client";

// Publishes the on-screen keyboard height as the global --keyboard-inset CSS
// variable so bottom-sheet modals (.calendar-modal) can lift themselves above
// the keyboard instead of hiding their fields behind it.
//
// Why JS is required: iOS Safari never shrinks dvh/svh (or the layout
// viewport) when the keyboard opens, so a fixed, bottom-anchored sheet stays
// pinned behind the keyboard. The visualViewport API is the only reliable
// signal for how much of the screen the keyboard covers.
//
// Mounted once from the app layout. No-ops where visualViewport is missing
// (older browsers) or the keyboard never overlaps (desktop keeps the inset 0).

import { useEffect } from "react";

export function KeyboardInsetProbe() {
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;

    const root = document.documentElement;
    const update = () => {
      // Layout-viewport height minus the visible height (and any upward scroll
      // of the visual viewport) is the bottom slice the keyboard covers.
      const inset = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      // Small deltas are browser-chrome jitter (URL bar, accessory bar); only
      // treat a meaningful overlap as "keyboard up" so the sheet doesn't twitch.
      root.style.setProperty("--keyboard-inset", inset > 24 ? `${inset}px` : "0px");
    };

    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
      root.style.removeProperty("--keyboard-inset");
    };
  }, []);

  return null;
}
