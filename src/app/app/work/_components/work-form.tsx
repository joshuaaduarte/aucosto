"use client";

import { useActionState } from "react";
import type { WorkFormState } from "../actions";

/**
 * Generic wrapper for Work Hub forms: wires useActionState, renders the
 * error banner, and disables the submit button while pending. Fields are
 * passed as (server-rendered) children so each form stays a plain form.
 */
export function WorkForm({
  action,
  submitLabel,
  children,
  className,
}: {
  action: (prev: WorkFormState, formData: FormData) => Promise<WorkFormState>;
  submitLabel: string;
  children: React.ReactNode;
  className?: string;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  return (
    <form action={formAction} className={className ?? "space-y-2"}>
      {state?.error && (
        <p
          className="rounded-lg px-3 py-2 text-[0.8125rem]"
          style={{ background: "var(--accent-tint)", color: "var(--accent-strong)" }}
        >
          {state.error}
        </p>
      )}
      {children}
      <button
        type="submit"
        disabled={pending}
        className="btn-ink px-3 py-1.5 text-[0.8125rem] font-medium"
      >
        {pending ? "Saving…" : submitLabel}
      </button>
    </form>
  );
}
