"use client";

import { useActionState } from "react";
import { login, type LoginState } from "./actions";

const initialState: LoginState = undefined;

export function LoginForm() {
  const [state, formAction, pending] = useActionState(login, initialState);

  return (
    <form action={formAction} className="space-y-5">
      <div className="space-y-1.5">
        <label
          htmlFor="email"
          className="block text-sm font-medium text-ink"
        >
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          placeholder="you@example.com"
          className="field"
        />
      </div>

      <div className="space-y-1.5">
        <label
          htmlFor="password"
          className="block text-sm font-medium text-ink"
        >
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="field font-mono tracking-[0.1em]"
        />
      </div>

      {state?.error && (
        <p className="text-sm font-medium" style={{ color: "var(--oxblood)" }}>
          {state.error}
        </p>
      )}

      <button type="submit" disabled={pending} className="btn-ink w-full">
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
