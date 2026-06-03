"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { startDoItemTimerAction } from "./actions";

export function DoStartTimerButton({ id }: { id: string }) {
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
          await startDoItemTimerAction(formData);
          router.push("/app/time");
          router.refresh();
        });
      }}
    >
      {pending ? "Opening timer..." : "Start timer"}
    </button>
  );
}
