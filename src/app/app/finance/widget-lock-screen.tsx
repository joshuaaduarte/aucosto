"use client";

import { useActionState } from "react";
import { unlockWidget } from "../privacy-actions";
import type { PrivacyState } from "../privacy-actions";

interface Props {
  widgetId: string;
  widgetLabel: string;
}

export function WidgetLockScreen({ widgetId, widgetLabel }: Props) {
  const [state, action, pending] = useActionState<PrivacyState, FormData>(
    (prev, formData) => unlockWidget(prev, formData),
    undefined,
  );

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <div
        className="w-full max-w-sm rounded-2xl px-8 py-10 text-center"
        style={{ background: "var(--surface)", boxShadow: "var(--surface-shadow)" }}
      >
        <div className="mb-6 flex justify-center">
          <div
            className="flex h-12 w-12 items-center justify-center rounded-full"
            style={{ background: "var(--paper-deep)" }}
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
              <rect x="3" y="9" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="1.4" />
              <path
                d="M6.5 9V6a3.5 3.5 0 0 1 7 0v3"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
              />
            </svg>
          </div>
        </div>

        <p className="font-mono text-[0.6875rem] uppercase tracking-[0.16em] text-ink-ghost">
          {widgetLabel}
        </p>
        <p className="mt-2 text-base font-medium text-ink">Enter PIN to unlock</p>

        <form action={action} className="mt-6 space-y-3">
          <input type="hidden" name="widgetId" value={widgetId} />
          <input
            type="password"
            name="pin"
            inputMode="numeric"
            maxLength={8}
            autoFocus
            placeholder="PIN"
            className="field text-center tracking-[0.3em] text-lg"
            aria-label="PIN"
          />
          {state && !state.ok && (
            <p className="text-sm text-oxblood">{state.error}</p>
          )}
          <button
            type="submit"
            disabled={pending}
            className="btn-ink w-full"
          >
            {pending ? "Unlocking…" : "Unlock"}
          </button>
        </form>
      </div>
    </div>
  );
}
