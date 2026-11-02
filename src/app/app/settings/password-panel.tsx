"use client";

import { useActionState } from "react";
import { updatePassword } from "./household-actions";
import { Notice } from "./household-panel";

export function PasswordPanel({ hasPassword }: { hasPassword: boolean }) {
  const [state, action, pending] = useActionState(updatePassword, undefined);
  return (
    <form action={action} className="max-w-sm space-y-3">
      {hasPassword ? (
        <input
          name="currentPassword"
          type="password"
          autoComplete="current-password"
          required
          placeholder="Current password"
          aria-label="Current password"
          className="field"
        />
      ) : (
        <p className="text-[0.8125rem]" style={{ color: "var(--text-muted)" }}>
          You sign in with Google. Add a password if you also want email sign-in.
        </p>
      )}
      <input
        name="newPassword"
        type="password"
        autoComplete="new-password"
        required
        minLength={10}
        placeholder="New password (10+ characters)"
        aria-label="New password"
        className="field"
      />
      <input
        name="confirmPassword"
        type="password"
        autoComplete="new-password"
        required
        minLength={10}
        placeholder="Repeat new password"
        aria-label="Repeat new password"
        className="field"
      />
      <button type="submit" disabled={pending} className="btn-ink">
        {pending ? "Saving…" : hasPassword ? "Change password" : "Set password"}
      </button>
      <Notice state={state} />
    </form>
  );
}
