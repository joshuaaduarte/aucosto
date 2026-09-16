"use client";

// Morning confirm: today's planned blocks, one tap to accept them, one tap to
// start any block as a timer. This is the morning push's deep-link target —
// every tap between the notification and a recorded row leaks the effect, so
// there's nothing else on this screen.

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { confirmPlanAction, startPlannedBlockAction } from "./actions";

export type ConfirmBlock = {
  id: string;
  title: string;
  timeLabel: string;
  confirmed: boolean;
};

export function ConfirmList({
  blocks,
  runningLabel,
}: {
  blocks: ConfirmBlock[];
  /** Label of the currently-running timer, if any. */
  runningLabel: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const allConfirmed = blocks.every((block) => block.confirmed);

  function confirmAll() {
    startTransition(async () => {
      await confirmPlanAction();
      router.refresh();
    });
  }

  function startBlock(title: string) {
    startTransition(async () => {
      const formData = new FormData();
      formData.set("title", title);
      await startPlannedBlockAction(formData);
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <ul className="space-y-2">
        {blocks.map((block) => {
          const running = runningLabel === block.title;
          return (
            <li
              key={block.id}
              className="flex items-center gap-3 rounded-lg border px-3 py-2.5"
              style={{
                borderColor: "var(--border-faint)",
                background: "var(--bg-page)",
                borderLeft: `3px solid ${block.confirmed ? "var(--accent)" : "var(--border-soft)"}`,
              }}
            >
              <span
                className="w-20 shrink-0 text-[0.8125rem] tabular"
                style={{ color: "var(--text-faint)" }}
              >
                {block.timeLabel}
              </span>
              <span
                className="min-w-0 flex-1 truncate text-[0.875rem]"
                style={{ color: "var(--text)" }}
              >
                {block.title}
              </span>
              <button
                type="button"
                disabled={pending || running}
                onClick={() => startBlock(block.title)}
                className="btn-ghost h-9 shrink-0 px-3 text-[0.8125rem]"
              >
                {running ? "Running" : "Start"}
              </button>
            </li>
          );
        })}
      </ul>

      {!allConfirmed ? (
        <button
          type="button"
          onClick={confirmAll}
          disabled={pending}
          className="btn-ink h-10 w-full px-4"
        >
          {pending ? "…" : "That's the day — confirm"}
        </button>
      ) : (
        <p className="text-[0.8125rem]" style={{ color: "var(--text-muted)" }}>
          Confirmed. Start a block whenever you&apos;re ready.
        </p>
      )}
    </div>
  );
}
