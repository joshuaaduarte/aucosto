"use client";

import { useActionState } from "react";
import { unlockApp, type PrivacyState } from "./privacy-actions";

const initialState: PrivacyState = undefined;

export function UnlockScreen() {
  const [state, formAction, pending] = useActionState(unlockApp, initialState);

  return (
    <div className="mx-auto flex min-h-[calc(70vh+var(--safe-area-bottom))] w-full max-w-md items-center justify-center px-1 py-2 sm:px-4">
      <form
        action={formAction}
        className="w-full rounded-[2rem] border border-zinc-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(250,250,248,0.96)),radial-gradient(circle_at_top_right,rgba(56,189,248,0.12),transparent_35%)] p-6 shadow-[0_24px_80px_-45px_rgba(24,24,27,0.20)] sm:p-7"
      >
        <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-zinc-500">
          aucosto locked
        </p>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight text-zinc-950 sm:text-3xl">
          Enter your PIN to continue.
        </h1>
        <p className="mt-3 text-sm leading-7 text-zinc-500">
          This keeps your workspace private if aucosto is left open.
        </p>

        <div className="mt-5 space-y-1.5">
          <label htmlFor="pin" className="block text-xs font-medium uppercase tracking-[0.16em] text-zinc-500">
            PIN
          </label>
          <input
            id="pin"
            name="pin"
            type="password"
            inputMode="numeric"
            autoFocus
            className="block min-h-12 w-full rounded-2xl border border-zinc-300 bg-white px-4 py-3 text-sm placeholder:text-zinc-400 focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
          />
        </div>

        <div className="mt-4 text-sm">
          {state?.ok === false ? (
            <p className="text-red-600">{state.error}</p>
          ) : state?.ok === true ? (
            <p className="text-emerald-600">{state.message}</p>
          ) : null}
        </div>

        <button
          type="submit"
          disabled={pending}
          className="mt-5 inline-flex min-h-12 w-full items-center justify-center rounded-2xl bg-zinc-900 px-5 text-sm font-medium text-zinc-50 transition-colors hover:bg-zinc-800 disabled:opacity-50"
        >
          {pending ? "Unlocking…" : "Unlock"}
        </button>
      </form>
    </div>
  );
}
