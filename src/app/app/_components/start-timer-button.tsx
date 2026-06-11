"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

// Shared "start a timer from X" button. The caller passes the tool-specific
// server action (e.g. startDoItemTimerAction, startHabitTimerAction); the
// button handles pending state and the hop to /app/time.
export function StartTimerButton({
  id,
  action,
}: {
  id: string;
  action: (formData: FormData) => Promise<unknown>;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <button
      className="btn-ghost h-8 w-full px-2.5 text-[0.75rem]"
      type="button"
      disabled={pending}
      onClick={() => {
        startTransition(async () => {
          const formData = new FormData();
          formData.set("id", id);
          await action(formData);
          router.push("/app/time");
          router.refresh();
        });
      }}
    >
      {pending ? "Opening timer..." : "Start timer"}
    </button>
  );
}
