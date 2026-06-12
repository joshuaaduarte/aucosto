"use client";

import { useFormStatus } from "react-dom";

function SubmitButton({
  label,
  pendingLabel,
  variant,
}: {
  label: string;
  pendingLabel: string;
  variant: "start" | "end";
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={variant === "start" ? "btn-ink" : "btn-ghost"}
      style={
        variant === "end"
          ? { borderColor: "var(--border-soft)" }
          : undefined
      }
    >
      {pending ? pendingLabel : label}
    </button>
  );
}

export function StartRhythmButton({
  type,
  action,
}: {
  type: string;
  action: (formData: FormData) => void;
}) {
  return (
    <form action={action}>
      <input type="hidden" name="type" value={type} />
      <SubmitButton label="Start" pendingLabel="Starting…" variant="start" />
    </form>
  );
}

export function EndRhythmButton({
  sessionId,
  action,
}: {
  sessionId: string;
  action: (formData: FormData) => void;
}) {
  return (
    <form action={action}>
      <input type="hidden" name="sessionId" value={sessionId} />
      <SubmitButton label="End" pendingLabel="Ending…" variant="end" />
    </form>
  );
}
