"use client";

import { useActionState } from "react";
import { joinWithPassword, type JoinState } from "./actions";

export function JoinForm({ token, email }: { token: string; email: string }) {
  const [state, action, pending] = useActionState<JoinState, FormData>(
    joinWithPassword.bind(null, token),
    undefined,
  );
  return (
    <form action={action} className="space-y-3">
      <input value={email} readOnly aria-label="Email" className="field" />
      <input name="name" placeholder="Your name" autoComplete="given-name" aria-label="Your name" className="field" />
      <input
        name="password"
        type="password"
        autoComplete="new-password"
        minLength={10}
        required
        placeholder="Choose a password (10+ characters)"
        aria-label="Password"
        className="field"
      />
      <input
        name="confirm"
        type="password"
        autoComplete="new-password"
        minLength={10}
        required
        placeholder="Repeat password"
        aria-label="Repeat password"
        className="field"
      />
      {state?.error ? (
        <p
          className="rounded-md px-3 py-2 text-[0.8125rem]"
          style={{
            background: "var(--accent-tint)",
            color: "var(--accent-strong)",
            border: "1px solid var(--accent-tint-strong)",
          }}
        >
          {state.error}
        </p>
      ) : null}
      <button type="submit" disabled={pending} className="btn-ink w-full">
        {pending ? "Creating your account…" : "Create account"}
      </button>
    </form>
  );
}
