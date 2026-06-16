"use client";

// Thin wrapper around the Document Picture-in-Picture API (Chrome 116+, the
// same surface Spotify's "Now Playing" mini-player uses). It opens a real
// always-on-top OS window backed by its own `Document`, copies the page's
// stylesheets into it so Tailwind utilities resolve, hands the caller a
// container element to render into, and tracks open/closed state.
//
// Graceful degradation: `isSupported` is false on Safari/Firefox/older Chrome,
// where `window.documentPictureInPicture` is undefined — callers hide the
// trigger entirely rather than showing a button that can't work.

import { useCallback, useState } from "react";

/** Render the PiP contents into the freshly-created container element. */
type RenderContent = (container: HTMLElement, pipDocument: Document) => void;

export function usePictureInPicture() {
  const isSupported =
    typeof window !== "undefined" && "documentPictureInPicture" in window;
  const [isOpen, setIsOpen] = useState(false);

  const open = useCallback(async (renderContent: RenderContent) => {
    if (typeof window === "undefined" || !window.documentPictureInPicture) {
      return;
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

    // Clone every stylesheet's owning <style>/<link> into the PiP document so
    // Tailwind (and the app theme) render the same as in the main tab. Sheets
    // we can't touch (cross-origin) throw on access — skip those.
    for (const sheet of Array.from(document.styleSheets)) {
      try {
        const node = sheet.ownerNode;
        if (node) pipDoc.head.appendChild(node.cloneNode(true));
      } catch {
        // Cross-origin or otherwise inaccessible stylesheet — ignore.
      }
    }

    pipDoc.body.style.margin = "0";
    const container = pipDoc.createElement("div");
    pipDoc.body.appendChild(container);

    renderContent(container, pipDoc);
    setIsOpen(true);

    // The window can close from the OS chrome, the opener navigating away, or
    // our own close() — `pagehide` covers all of them.
    pipWindow.addEventListener("pagehide", () => setIsOpen(false));
  }, []);

  const close = useCallback(() => {
    if (typeof window !== "undefined") {
      window.documentPictureInPicture?.window?.close();
    }
    setIsOpen(false);
  }, []);

  return { isSupported, isOpen, open, close };
}
