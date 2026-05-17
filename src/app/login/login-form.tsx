"use client";

import { useActionState } from "react";
import { login, type LoginState } from "./actions";

const initialState: LoginState = undefined;

export function LoginForm() {
  const [state, formAction, pending] = useActionState(login, initialState);

  return (
    <form action={formAction} className="space-y-7">
      <div className="space-y-2">
        <label
          htmlFor="email"
          className="block font-mono text-[0.625rem] uppercase tracking-[0.22em] text-ink-fade"
        >
          Reader’s name on record
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          placeholder="name@dispatch.test"
          className="field font-display text-lg italic"
        />
      </div>
      <div className="space-y-2">
        <label
          htmlFor="password"
          className="block font-mono text-[0.625rem] uppercase tracking-[0.22em] text-ink-fade"
        >
          Cipher
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="field font-mono text-lg tracking-[0.2em] tabular"
        />
      </div>

      {state?.error && (
        <p className="font-serif text-sm italic text-oxblood">{state.error}</p>
      )}

      <button type="submit" disabled={pending} className="btn-ink w-full">
        {pending ? "Releasing the edition…" : "Release today's edition  →"}
      </button>
    </form>
  );
}
