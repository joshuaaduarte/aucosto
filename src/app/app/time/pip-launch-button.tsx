"use client";

// The "pop out" trigger that opens the floating Picture-in-Picture timer.
// Shared by the time page (labelled) and the global timer bar (icon-only,
// desktop). It owns the React root mounted inside the PiP document and wires
// the widget's callbacks to the same server actions the rest of the time UI
// uses — the PiP window shares this tab's JS context, so this just works.
//
// Graceful degradation:
//  - unsupported browser → renders nothing (no dead button on Safari/Firefox)
//  - no running timer → button is disabled and greyed
//  - timer ends elsewhere → the open window closes itself

import { useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createRoot, type Root } from "react-dom/client";
import { usePictureInPicture } from "@/hooks/use-picture-in-picture";
import {
  PipTimerWidget,
  type PipEntry,
  type PipHabit,
} from "@/components/pip-timer-widget";
import { stopEntry } from "./actions";
import { logHabitDone } from "../habits/actions";

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
  const router = useRouter();
  const { isSupported, isOpen, open, close } = usePictureInPicture();
  const rootRef = useRef<Root | null>(null);

  const teardown = useCallback(() => {
    rootRef.current?.unmount();
    rootRef.current = null;
  }, []);

  // If the running timer ends (here or from another surface), drop the window.
  useEffect(() => {
    if (isOpen && !entry) {
      teardown();
      close();
    }
  }, [isOpen, entry, close, teardown]);

  // Unmount the PiP root if this component itself goes away.
  useEffect(() => () => teardown(), [teardown]);

  if (!isSupported) return null;

  const disabled = !entry;

  async function handleOpen() {
    if (!entry) return;
    const activeEntry = entry;
    await open((container) => {
      const root = createRoot(container);
      rootRef.current = root;
      root.render(
        <PipTimerWidget
          entry={activeEntry}
          habits={habits}
          totalMsToday={totalMsToday}
          onStop={async () => {
            await stopEntry();
            teardown();
            close();
            router.refresh();
          }}
          onSwitch={() => {
            close();
            router.push("/app/time");
          }}
          onLogHabit={async (habitId) => {
            await logHabitDone(habitId);
            router.refresh();
          }}
        />,
      );
    });
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
