"use client";

import { useActionState } from "react";
import { unlockApp, type PrivacyState } from "./privacy-actions";

const initialState: PrivacyState = undefined;

export function UnlockScreen() {
  const [state, formAction, pending] = useActionState(unlockApp, initialState);

  return (
    <div className="mx-auto flex min-h-[60vh] w-full max-w-md flex-col items-center justify-center py-12">
      <div className="mb-8 text-center">
        <p className="font-mono text-[0.6875rem] uppercase tracking-[0.28em] text-ink-fade">
          The Press is Locked
        </p>
        <h1 className="mt-4 font-display text-4xl font-medium leading-tight tracking-[-0.03em] text-ink sm:text-5xl">
          Identify yourself,
          <br />
          <span className="italic">dear reader.</span>
        </h1>
        <p className="mt-4 font-serif italic text-ink-fade">
          A four-to-eight digit cipher will release the day’s edition.
        </p>
      </div>

      <form action={formAction} className="w-full space-y-6">
        <div className="space-y-2">
          <label
            htmlFor="pin"
            className="block font-mono text-[0.625rem] uppercase tracking-[0.22em] text-ink-fade"
          >
            Cipher
          </label>
          <input
            id="pin"
            name="pin"
            type="password"
            inputMode="numeric"
            autoFocus
            className="field text-center font-mono text-2xl tracking-[0.5em] tabular"
          />
        </div>

        {state?.ok === false ? (
          <p className="text-center font-serif text-sm italic text-oxblood">
            {state.error}
          </p>
        ) : state?.ok === true ? (
          <p className="text-center font-serif text-sm italic text-verdigris">
            {state.message}
          </p>
        ) : null}

        <button type="submit" disabled={pending} className="btn-ink w-full">
          {pending ? "Releasing…" : "Release the Edition"}
        </button>
      </form>
    </div>
  );
}
