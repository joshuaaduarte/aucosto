"use client";

// The "pop out" trigger for the floating Picture-in-Picture timer. Shared by
// the time page (labelled) and the global timer bar (icon-only, desktop).
//
// Lifetime is deliberately decoupled from React: the PiP root and window live
// at MODULE scope, not in component state. Next.js navigations unmount/remount
// this button (it lives in the layout's timer bar and on the time page), but
// the floating window must survive that — so nothing here calls root.unmount()
// on a component cleanup. The window only goes away when the user closes it,
// the timer ends, or it's replaced by a fresh pop-out. `pagehide` clears the
// module refs whenever the window dies for any reason.
//
// Because the rendered widget's callbacks can outlive the render that created
// them (the root persists across navigations), they must NOT close over a
// Next.js router — those refs go stale. Switch does a hard `location.href`
// navigation, and refreshes route through `refreshMain`, which a mounted
// instance keeps pointing at a live router.

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createRoot, type Root } from "react-dom/client";
import {
  requestStyledPipWindow,
  usePictureInPicture,
} from "@/hooks/use-picture-in-picture";
import {
  PipTimerWidget,
  type PipEntry,
  type PipHabit,
} from "@/components/pip-timer-widget";
import { stopEntry } from "./actions";
import { logHabitDone } from "../habits/actions";

// ── Module-scope PiP state (survives navigation) ──────────────────
let activePipRoot: Root | null = null;
let activePipWindow: Window | null = null;
// Kept pointed at a live router by whichever button instance is mounted, so
// the persisted widget's callbacks always refresh through a fresh router.
let refreshMain: (() => void) | null = null;

function clearPipRefs(forWindow: Window) {
  if (activePipWindow === forWindow) {
    activePipRoot = null;
    activePipWindow = null;
  }
}

function closeActivePip() {
  // close() fires pagehide, which clears the refs. Never unmount the root from
  // a React cleanup — that's exactly what blanked the window on navigation.
  activePipWindow?.close();
}

export function PipLaunchButton({
  entry,
  habits,
  totalMsToday,
  iconOnly = false,
  className,
}: {
  entry: PipEntry | null;
  habits: PipHabit[];
  totalMsToday: number;
  iconOnly?: boolean;
  className?: string;
}) {
  const { isSupported } = usePictureInPicture();
  const router = useRouter();

  // Keep the module-level refresher aimed at this instance's live router.
  const refreshRef = useRef(router);
  refreshRef.current = router;
  useEffect(() => {
    refreshMain = () => refreshRef.current.refresh();
  }, []);

  // If the running timer ends (here or elsewhere), close any open window.
  useEffect(() => {
    if (!entry && activePipWindow && !activePipWindow.closed) {
      closeActivePip();
    }
  }, [entry]);

  if (!isSupported) return null;

  const disabled = !entry;

  async function handleOpen() {
    if (!entry) return;
    const activeEntry = entry;

    const widget = (
      <PipTimerWidget
        entry={activeEntry}
        habits={habits}
        totalMsToday={totalMsToday}
        onStop={async () => {
          await stopEntry();
          closeActivePip();
          refreshMain?.();
        }}
        onSwitch={() => {
          closeActivePip();
          // Hard navigation: the persisted root can't trust a captured router.
          window.location.href = "/app/time";
        }}
        onLogHabit={async (habitId) => {
          await logHabitDone(habitId);
          refreshMain?.();
        }}
      />
    );

    // Already open? Re-render fresh data into the existing window and focus it.
    if (activePipWindow && !activePipWindow.closed && activePipRoot) {
      activePipRoot.render(widget);
      activePipWindow.focus?.();
      return;
    }

    // Otherwise replace any stale window and open a new one.
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
      disabled={disabled}
      title={disabled ? "Start a timer to pop it out" : "Pop out a floating timer"}
      aria-label="Pop out floating timer"
      className={
        className ??
        "btn-ghost inline-flex h-8 items-center gap-1.5 rounded-full px-2.5 text-[0.75rem] disabled:opacity-45"
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
