"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { createPersonAction, type RolodexFormState } from "../actions";

const CONTACT_KINDS = [
  { value: "person", label: "Person" },
  { value: "pet", label: "Pet" },
  { value: "organization", label: "Organization" },
  { value: "group", label: "Group" },
];

const RELATIONSHIP_TYPES = [
  { value: "", label: "Select type…" },
  { value: "family", label: "Family" },
  { value: "friend", label: "Friend" },
  { value: "coworker", label: "Coworker" },
  { value: "vendor", label: "Vendor" },
  { value: "acquaintance", label: "Acquaintance" },
  { value: "pet", label: "Pet" },
  { value: "organization", label: "Organization" },
  { value: "other", label: "Other" },
];

export default function NewPersonPage() {
  const [state, action, pending] = useActionState<RolodexFormState, FormData>(
    createPersonAction,
    undefined,
  );
  const [contactKind, setContactKind] = useState("person");

  return (
    <div className="space-y-6">
      <header className="fade-in">
        <Link
          href="/app/rolodex"
          className="inline-flex items-center gap-1 text-[0.8125rem] font-medium hover:underline"
          style={{ color: "var(--text-muted)" }}
        >
          ← Rolodex
        </Link>
        <h1
          className="mt-2 text-[1.5rem] font-bold tracking-tight"
          style={{ color: "var(--text)", letterSpacing: "-0.025em" }}
        >
          Add contact
        </h1>
      </header>

      <form action={action} className="fade-in-delay-1 space-y-4">
        <input type="hidden" name="contactKind" value={contactKind} />

        {state?.error && (
          <p
            className="rounded-lg px-3 py-2 text-[0.875rem]"
            style={{ background: "var(--accent-tint)", color: "var(--accent-strong)" }}
          >
            {state.error}
          </p>
        )}

        <div className="space-y-3 rounded-xl p-4" style={{ background: "var(--bg-tint)", border: "1px solid var(--border-faint)" }}>
          <div>
            <label className="mb-1 block text-[0.8125rem] font-medium" style={{ color: "var(--text-muted)" }}>
              Kind
            </label>
            <div className="flex gap-1.5">
              {CONTACT_KINDS.map((k) => (
                <button
                  key={k.value}
                  type="button"
                  onClick={() => setContactKind(k.value)}
                  className="rounded-full px-3 py-1.5 text-[0.8125rem] font-medium transition-colors"
                  style={{
                    background: contactKind === k.value ? "var(--text)" : "var(--bg-page)",
                    color: contactKind === k.value ? "var(--bg-page)" : "var(--text-muted)",
                    border: "1px solid var(--border-faint)",
                  }}
                >
                  {k.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-1 block text-[0.8125rem] font-medium" style={{ color: "var(--text-muted)" }}>
              Display name *
            </label>
            <input name="displayName" type="text" required maxLength={200} className="field w-full" placeholder="How you refer to them" />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-[0.8125rem] font-medium" style={{ color: "var(--text-muted)" }}>
                First name
              </label>
              <input name="firstName" type="text" maxLength={100} className="field w-full" />
            </div>
            <div>
              <label className="mb-1 block text-[0.8125rem] font-medium" style={{ color: "var(--text-muted)" }}>
                Last name
              </label>
              <input name="lastName" type="text" maxLength={100} className="field w-full" />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-[0.8125rem] font-medium" style={{ color: "var(--text-muted)" }}>
                Relationship
              </label>
              <select name="relationshipType" className="field w-full">
                {RELATIONSHIP_TYPES.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-[0.8125rem] font-medium" style={{ color: "var(--text-muted)" }}>
                Organization
              </label>
              <input name="organization" type="text" maxLength={200} className="field w-full" />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-[0.8125rem] font-medium" style={{ color: "var(--text-muted)" }}>
              Birthday
            </label>
            <input name="birthday" type="date" className="field" />
          </div>

          <div>
            <label className="mb-1 block text-[0.8125rem] font-medium" style={{ color: "var(--text-muted)" }}>
              Notes
            </label>
            <textarea name="notes" rows={3} maxLength={5000} className="field w-full resize-none" placeholder="Anything to remember…" />
          </div>
        </div>

        <div className="flex gap-2">
          <button
            type="submit"
            disabled={pending}
            className="btn-ghost px-4 py-2 text-[0.875rem] font-medium"
            style={{ color: "var(--accent)" }}
          >
            {pending ? "Adding…" : "Add contact"}
          </button>
          <Link
            href="/app/rolodex"
            className="btn-ghost px-4 py-2 text-[0.875rem]"
            style={{ color: "var(--text-muted)" }}
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
