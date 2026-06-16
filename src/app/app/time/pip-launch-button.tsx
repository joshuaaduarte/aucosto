"use client";

// The "pop out" trigger for the floating Picture-in-Picture mini-app. Shared by
// the time page (labelled) and the global timer bar (icon-only, desktop).
//
// Lifetime is deliberately decoupled from React: the PiP root and window live
// at MODULE scope, not in component state. Next.js navigations unmount/remount
// this button, but the floating window must survive that — so nothing here
// calls root.unmount() on a component cleanup. The window only closes when the
// user closes it or it's replaced by a fresh pop-out; `pagehide` clears the
// module refs whenever it dies.
//
// The widget owns its own running/idle view and re-renders from the PipState
// each action returns, so the window keeps working after stop/start without a
// remount. The wired actions reference module-stable server actions (never a
// captured router), plus `refreshMain` — a pointer a mounted instance keeps
// aimed at a live router — so the main tab refreshes too, even across nav.

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createRoot, type Root } from "react-dom/client";
import {
  requestStyledPipWindow,
  usePictureInPicture,
} from "@/hooks/use-picture-in-picture";
import { PipTimerWidget, type PipActions } from "@/components/pip-timer-widget";
import type { PipState } from "../_components/pip-data";
import { updateEntryNotes } from "./actions";
import {
  pipLogHabit,
  pipStartCategory,
  pipStartHabit,
  pipStop,
} from "./pip-actions";

// ── Module-scope PiP state (survives navigation) ──────────────────
let activePipRoot: Root | null = null;
let activePipWindow: Window | null = null;
// Kept pointed at a live router by whichever button instance is mounted.
let refreshMain: (() => void) | null = null;

function clearPipRefs(forWindow: Window) {
  if (activePipWindow === forWindow) {
    activePipRoot = null;
    activePipWindow = null;
  }
}

function closeActivePip() {
  // close() fires pagehide, which clears the refs. Never unmount the root from
  // a React cleanup — that's what blanked the window on navigation.
  activePipWindow?.close();
}

// Wire the PiP widget's actions to the server actions. Defined at module scope
// so the closures the widget keeps can't capture a stale router. After each
// mutation, nudge the main tab to re-fetch via the live `refreshMain` pointer.
const actions: PipActions = {
  stop: async () => {
    const next = await pipStop();
    refreshMain?.();
    return next;
  },
  startCategory: async (categoryId, title) => {
    const next = await pipStartCategory(categoryId, title);
    refreshMain?.();
    return next;
  },
  startHabit: async (habitId) => {
    const next = await pipStartHabit(habitId);
    refreshMain?.();
    return next;
  },
  logHabit: async (habitId) => {
    const next = await pipLogHabit(habitId);
    refreshMain?.();
    return next;
  },
  saveNotes: async (id, notes) => {
    await updateEntryNotes(id, notes);
  },
};

export function PipLaunchButton({
  state,
  iconOnly = false,
  className,
}: {
  state: PipState;
  iconOnly?: boolean;
  className?: string;
}) {
  const { isSupported } = usePictureInPicture();
  const router = useRouter();

  // Keep the module-level refresher aimed at this instance's live router.
  // Assign inside the effect (not during render) so we never mutate a ref while
  // rendering; running every commit keeps the router reference fresh.
  const refreshRef = useRef(router);
  useEffect(() => {
    refreshRef.current = router;
    refreshMain = () => refreshRef.current.refresh();
  });

  if (!isSupported) return null;

  async function handleOpen() {
    const widget = <PipTimerWidget initialState={state} actions={actions} />;

    // Already open? Re-render with the latest snapshot and focus it.
    if (activePipWindow && !activePipWindow.closed && activePipRoot) {
      activePipRoot.render(widget);
      activePipWindow.focus?.();
      return;
    }

    closeActivePip();
    const pipWindow = await requestStyledPipWindow();
    if (!pipWindow) return;

    const container = pipWindow.document.createElement("div");
    pipWindow.document.body.appendChild(container);
    const root = createRoot(container);
    activePipRoot = root;
    activePipWindow = pipWindow;
    root.render(widget);

    pipWindow.addEventListener("pagehide", () => clearPipRefs(pipWindow));
  }

  return (
    <button
      type="button"
      onClick={handleOpen}
      title="Pop out a floating timer"
      aria-label="Pop out floating timer"
      className={
        className ??
        "btn-ghost inline-flex h-8 items-center gap-1.5 rounded-full px-2.5 text-[0.75rem]"
      }
    >
      <PictureInPictureIcon />
      {iconOnly ? null : <span>Pop out</span>}
    </button>
  );
}

function PictureInPictureIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 15 15"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.25"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="1.75" y="2.75" width="11.5" height="9.5" rx="1.5" />
      <rect x="7.5" y="7" width="4.25" height="3.5" rx="0.75" fill="currentColor" stroke="none" />
    </svg>
  );
}
