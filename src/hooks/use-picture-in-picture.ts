"use client";

// Document Picture-in-Picture plumbing (Chrome 116+, the same surface
// Spotify's "Now Playing" mini-player uses). Split in two on purpose:
//
//  - usePictureInPicture(): a tiny hook that only reports support. It flips
//    after mount so SSR and first client render agree (no hydration mismatch).
//  - requestStyledPipWindow(): a plain async function — NOT tied to any
//    component — that opens the OS window, mirrors the app theme + stylesheets
//    into it so Tailwind utilities and CSS tokens resolve, and hands the window
//    back. The caller owns the React root and the window's lifetime (see
//    pip-launch-button.tsx), which is what keeps the window alive across
//    in-app navigations.

import { useEffect, useState } from "react";

export function usePictureInPicture() {
  const [isSupported, setIsSupported] = useState(false);
  useEffect(() => {
    setIsSupported(
      typeof window !== "undefined" && "documentPictureInPicture" in window,
    );
  }, []);
  return { isSupported };
}

/**
 * Open a PiP window styled to match the host page, or null if unsupported.
 * Must be called from a user gesture (e.g. a click handler).
 */
export async function requestStyledPipWindow(): Promise<Window | null> {
  if (typeof window === "undefined" || !window.documentPictureInPicture) {
    return null;
  }

  const pipWindow = await window.documentPictureInPicture.requestWindow({
    width: 320,
    height: 520,
  });
  const pipDoc = pipWindow.document;

  // Lay the copied utilities out at device width inside the small window.
  const viewport = pipDoc.createElement("meta");
  viewport.name = "viewport";
  viewport.content = "width=device-width";
  pipDoc.head.appendChild(viewport);

  // Carry the app's theme decision over so the window matches the tab it
  // popped out of (the CSS tokens key off [data-theme] / color-scheme).
  const rootEl = document.documentElement;
  const theme = rootEl.getAttribute("data-theme");
  if (theme) pipDoc.documentElement.setAttribute("data-theme", theme);
  if (rootEl.className) pipDoc.documentElement.className = rootEl.className;
  pipDoc.documentElement.style.colorScheme =
    rootEl.style.colorScheme || "light dark";

  // Clone every stylesheet's owning <style>/<link> into the PiP document so
  // Tailwind (and the app theme tokens) render the same as in the main tab.
  // Sheets we can't read (cross-origin) throw on access — skip those.
  for (const sheet of Array.from(document.styleSheets)) {
    try {
      const node = sheet.ownerNode;
      if (node) pipDoc.head.appendChild(node.cloneNode(true));
    } catch {
      // Cross-origin or otherwise inaccessible stylesheet — ignore.
    }
  }

  pipDoc.body.style.margin = "0";
  pipDoc.body.style.background = "var(--bg-app)";

  return pipWindow;
}
