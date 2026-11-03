"use client";

// The page's own "New …" button, in its header. The centre "+" is the one
// floating add button app-wide, so tool pages no longer float their own; the
// full form (a sheet mounted elsewhere on the page) listens for this button
// through a window event, which keeps the sheet's state where it already lives.

import { useEffect } from "react";

const EVENT = "aucosto:page-add";

export type PageAddTarget = "calendar-block" | "habit" | "project";

export function openPageAdd(target: PageAddTarget) {
  window.dispatchEvent(new CustomEvent(EVENT, { detail: { target } }));
}

/** Call from the sheet that owns the form: `onOpen` runs when its header button is pressed. */
export function usePageAdd(target: PageAddTarget, onOpen: () => void) {
  useEffect(() => {
    const listener = (event: Event) => {
      if ((event as CustomEvent<{ target?: string }>).detail?.target === target) onOpen();
    };
    window.addEventListener(EVENT, listener);
    return () => window.removeEventListener(EVENT, listener);
  }, [target, onOpen]);
}

export function PageAddButton({ target, label }: { target: PageAddTarget; label: string }) {
  return (
    <button type="button" className="btn-ghost shrink-0" onClick={() => openPageAdd(target)}>
      <span aria-hidden className="mr-1 text-[1rem] leading-none">
        +
      </span>
      {label}
    </button>
  );
}
