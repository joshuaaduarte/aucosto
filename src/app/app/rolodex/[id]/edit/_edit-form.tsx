"use client";

import Link from "next/link";
import { useActionState, useState, useTransition } from "react";
import { updatePersonAction, addInteractionAction, type RolodexFormState } from "../../actions";
import type { RolodexPersonDetail } from "@/lib/services/rolodex";

const CONTACT_KINDS = [
  { value: "person", label: "Person" },
  { value: "pet", label: "Pet" },
  { value: "organization", label: "Organization" },
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

export function EditPersonForm({
  id,
  person,
}: {
  id: string;
  person: RolodexPersonDetail;
}) {
  const [updateState, updateAction, updatePending] = useActionState<RolodexFormState, FormData>(
    updatePersonAction,
    undefined,
  );

  const [contactKind, setContactKind] = useState(person.contactKind ?? "person");

  const [intTitle, setIntTitle] = useState("");
  const [intBody, setIntBody] = useState("");
  const [intFollowUp, setIntFollowUp] = useState(false);
  const [intFollowUpDate, setIntFollowUpDate] = useState("");
  const [intError, setIntError] = useState("");
  const [, startInt] = useTransition();

  function handleAddInteraction(e: React.FormEvent) {
    e.preventDefault();
    if (!intTitle.trim()) return;
    setIntError("");
    startInt(async () => {
      const result = await addInteractionAction(
        id,
        intTitle,
        intBody || undefined,
        intFollowUp,
        intFollowUp && intFollowUpDate ? intFollowUpDate : undefined,
      );
      if (result.ok) {
        setIntTitle("");
        setIntBody("");
        setIntFollowUp(false);
        setIntFollowUpDate("");
      } else {
        setIntError(result.error);
      }
    });
  }

  return (
    <div className="space-y-6">
      {/* Edit person form */}
      <form action={updateAction} className="fade-in-delay-1 space-y-4">
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="contactKind" value={contactKind} />

        {updateState?.error && (
          <p
            className="rounded-lg px-3 py-2 text-[0.875rem]"
            style={{ background: "var(--accent-tint)", color: "var(--accent-strong)" }}
          >
            {updateState.error}
          </p>
        )}

        <div
          className="space-y-3 rounded-xl p-4"
          style={{ background: "var(--bg-tint)", border: "1px solid var(--border-faint)" }}
        >
          <p
            className="text-[0.6875rem] font-semibold uppercase tracking-wider"
            style={{ color: "var(--text-faint)" }}
          >
            Basic info
          </p>

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
            <input
              name="displayName"
              type="text"
              required
              maxLength={200}
              defaultValue={person.displayName}
              className="field w-full"
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-[0.8125rem] font-medium" style={{ color: "var(--text-muted)" }}>
                First name
              </label>
              <input name="firstName" type="text" maxLength={100} defaultValue={person.firstName ?? ""} className="field w-full" />
            </div>
            <div>
              <label className="mb-1 block text-[0.8125rem] font-medium" style={{ color: "var(--text-muted)" }}>
                Last name
              </label>
              <input name="lastName" type="text" maxLength={100} defaultValue={person.lastName ?? ""} className="field w-full" />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-[0.8125rem] font-medium" style={{ color: "var(--text-muted)" }}>
                Relationship
              </label>
              <select name="relationshipType" defaultValue={person.relationshipType ?? ""} className="field w-full">
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
              <input
                name="organization"
                type="text"
                maxLength={200}
                defaultValue={person.organization ?? ""}
                className="field w-full"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-[0.8125rem] font-medium" style={{ color: "var(--text-muted)" }}>
              Birthday
            </label>
            <input
              name="birthday"
              type="date"
              defaultValue={
                person.birthday
                  ? new Date(person.birthday).toLocaleDateString("en-CA")
                  : ""
              }
              className="field"
            />
          </div>
        </div>

        <div
          className="space-y-3 rounded-xl p-4"
          style={{ background: "var(--bg-tint)", border: "1px solid var(--border-faint)" }}
        >
          <p
            className="text-[0.6875rem] font-semibold uppercase tracking-wider"
            style={{ color: "var(--text-faint)" }}
          >
            Context
          </p>

          <div>
            <label className="mb-1 block text-[0.8125rem] font-medium" style={{ color: "var(--text-muted)" }}>
              Notes
            </label>
            <textarea
              name="notes"
              rows={3}
              maxLength={5000}
              defaultValue={person.notes ?? ""}
              className="field w-full resize-none"
              placeholder="Context, backstory, anything to remember…"
            />
          </div>
          <div>
            <label className="mb-1 block text-[0.8125rem] font-medium" style={{ color: "var(--text-muted)" }}>
              Communication notes
            </label>
            <textarea
              name="communicationNotes"
              rows={2}
              maxLength={2000}
              defaultValue={person.communicationNotes ?? ""}
              className="field w-full resize-none"
              placeholder="How they prefer to communicate…"
            />
          </div>
          <div>
            <label className="mb-1 block text-[0.8125rem] font-medium" style={{ color: "var(--text-muted)" }}>
              Preferences
            </label>
            <textarea
              name="preferences"
              rows={2}
              maxLength={2000}
              defaultValue={person.preferences ?? ""}
              className="field w-full resize-none"
              placeholder="Likes, dislikes, dietary restrictions…"
            />
          </div>
          <div>
            <label className="mb-1 block text-[0.8125rem] font-medium" style={{ color: "var(--text-muted)" }}>
              Sensitivities
            </label>
            <textarea
              name="sensitivities"
              rows={2}
              maxLength={2000}
              defaultValue={person.sensitivities ?? ""}
              className="field w-full resize-none"
              placeholder="Topics to avoid, health considerations…"
            />
          </div>
        </div>

        <div className="flex gap-2">
          <button
            type="submit"
            disabled={updatePending}
            className="btn-ghost px-4 py-2 text-[0.875rem] font-medium"
            style={{ color: "var(--accent)" }}
          >
            {updatePending ? "Saving…" : "Save changes"}
          </button>
          <Link
            href={`/app/rolodex/${id}`}
            className="btn-ghost px-4 py-2 text-[0.875rem]"
            style={{ color: "var(--text-muted)" }}
          >
            Cancel
          </Link>
        </div>
      </form>

      {/* Add interaction */}
      <section className="fade-in-delay-2 space-y-3">
        <h2
          className="text-[0.6875rem] font-semibold uppercase tracking-wider"
          style={{ color: "var(--text-faint)" }}
        >
          Log interaction
        </h2>
        <form
          onSubmit={handleAddInteraction}
          className="space-y-3 rounded-xl p-4"
          style={{ background: "var(--bg-tint)", border: "1px solid var(--border-faint)" }}
        >
          {intError && (
            <p className="text-[0.8125rem]" style={{ color: "var(--accent-strong)" }}>
              {intError}
            </p>
          )}
          <input
            type="text"
            value={intTitle}
            onChange={(e) => setIntTitle(e.target.value)}
            required
            maxLength={300}
            placeholder="What happened? (e.g. 'Coffee catch-up')"
            className="field w-full"
          />
          <textarea
            value={intBody}
            onChange={(e) => setIntBody(e.target.value)}
            rows={2}
            maxLength={5000}
            placeholder="Notes…"
            className="field w-full resize-none text-[0.875rem]"
          />
          <label
            className="flex items-center gap-2 text-[0.875rem]"
            style={{ color: "var(--text-muted)" }}
          >
            <input
              type="checkbox"
              checked={intFollowUp}
              onChange={(e) => setIntFollowUp(e.target.checked)}
            />
            Follow-up needed
          </label>
          {intFollowUp && (
            <div>
              <label
                className="mb-1 block text-[0.8125rem]"
                style={{ color: "var(--text-muted)" }}
              >
                Follow-up by
              </label>
              <input
                type="date"
                value={intFollowUpDate}
                onChange={(e) => setIntFollowUpDate(e.target.value)}
                className="field"
              />
            </div>
          )}
          <button
            type="submit"
            disabled={!intTitle.trim()}
            className="btn-ghost px-3 py-1.5 text-[0.875rem] font-medium"
            style={{ color: "var(--accent)" }}
          >
            Log interaction
          </button>
        </form>
      </section>
    </div>
  );
}
