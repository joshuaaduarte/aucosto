"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { startProjectTimerAction } from "../actions";

export function StartProjectTimerButton({
  projectId,
  running,
}: {
  projectId: string;
  running: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  if (running) {
    return (
      <span
        className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[0.8125rem] font-medium"
        style={{ background: "var(--accent-tint)", color: "var(--accent-strong)" }}
      >
        <span className="inline-block h-2 w-2 animate-pulse rounded-full" style={{ background: "var(--accent-strong)" }} />
        Timer running
      </span>
    );
  }

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          await startProjectTimerAction(projectId);
          router.refresh();
        })
      }
      className="btn-ghost"
    >
      {pending ? "Starting…" : "▶ Start timer"}
    </button>
  );
}
