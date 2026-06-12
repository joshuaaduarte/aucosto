"use client";

// The reflection form: four emoji-anchored 1–5 scales, three optional prose
// fields, full-width save on mobile. Pre-filled and editable when today's
// reflection already exists.

import { useActionState, useState } from "react";
import {
  MOOD_SCALE,
  RATING_FIELDS,
  type ReflectionRatingField,
} from "@/lib/reflect";
import { saveReflectionAction, type ReflectionFormState } from "./actions";

const initialState: ReflectionFormState = undefined;

type Ratings = Record<ReflectionRatingField, number | null>;

export function ReflectionForm({
  existing,
}: {
  existing: {
    mood: number;
    energyLevel: number;
    productivityRating: number;
    dayRating: number;
    wentWell: string | null;
    carryForward: string | null;
    freeNotes: string | null;
  } | null;
}) {
  const [state, formAction, pending] = useActionState(
    saveReflectionAction,
    initialState,
  );
  const [ratings, setRatings] = useState<Ratings>({
    mood: existing?.mood ?? null,
    energyLevel: existing?.energyLevel ?? null,
    productivityRating: existing?.productivityRating ?? null,
    dayRating: existing?.dayRating ?? null,
  });
  const saved = state && "ok" in state && state.ok;
  const allRated = RATING_FIELDS.every(
    ({ field }) => ratings[field] !== null,
  );

  return (
    <form action={formAction} className="space-y-6">
      {RATING_FIELDS.map(({ field, label, question }) => (
        <fieldset key={field}>
          <legend className="flex items-baseline gap-2">
            <span
              className="text-[0.6875rem] font-semibold uppercase tracking-wider"
              style={{ color: "var(--text-faint)" }}
            >
              {label}
            </span>
            <span
              className="text-[0.8125rem]"
              style={{ color: "var(--text-muted)" }}
            >
              {question}
            </span>
          </legend>
          <input type="hidden" name={field} value={ratings[field] ?? ""} />
          <div className="mt-2 flex gap-1.5">
            {MOOD_SCALE.map((step) => {
              const active = ratings[field] === step.value;
              return (
                <button
                  key={step.value}
                  type="button"
                  onClick={() =>
                    setRatings((prev) => ({ ...prev, [field]: step.value }))
                  }
                  aria-pressed={active}
                  aria-label={`${label}: ${step.label}`}
                  title={step.label}
                  className="flex h-11 flex-1 items-center justify-center rounded-md text-[1.25rem] transition-transform sm:max-w-[4.5rem]"
                  style={{
                    background: active ? "var(--bg-tint-strong)" : "var(--bg-tint)",
                    boxShadow: active ? `inset 0 0 0 2px ${step.color}` : undefined,
                    transform: active ? "scale(1.06)" : undefined,
                    filter: active ? "none" : "grayscale(0.45)",
                    opacity: active ? 1 : 0.75,
                  }}
                >
                  {step.emoji}
                </button>
              );
            })}
          </div>
        </fieldset>
      ))}

      <TextField
        id="reflect-went-well"
        name="wentWell"
        label="What went well?"
        placeholder="Even one small thing counts..."
        defaultValue={existing?.wentWell ?? ""}
      />
      <TextField
        id="reflect-carry-forward"
        name="carryForward"
        label="What to carry forward?"
        placeholder="Something to bring into tomorrow..."
        defaultValue={existing?.carryForward ?? ""}
      />
      <TextField
        id="reflect-free-notes"
        name="freeNotes"
        label="Anything else?"
        placeholder="Free space..."
        defaultValue={existing?.freeNotes ?? ""}
      />

      {state && "error" in state && state.error ? (
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

      <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-[0.78rem]" style={{ color: "var(--text-faint)" }}>
          {saved
            ? "Saved. Edit any time today — it stays one reflection per day."
            : existing
              ? "Editing today's reflection."
              : allRated
                ? "Ready to save."
                : "Tap a face on each scale."}
        </p>
        <button
          type="submit"
          disabled={pending || !allRated}
          className="btn-ink w-full sm:w-auto"
        >
          {pending
            ? "Saving..."
            : existing || saved
              ? "Update reflection"
              : "Save reflection"}
        </button>
      </div>
    </form>
  );
}

function TextField({
  id,
  name,
  label,
  placeholder,
  defaultValue,
}: {
  id: string;
  name: string;
  label: string;
  placeholder: string;
  defaultValue: string;
}) {
  return (
    <div className="space-y-1.5">
      <label
        htmlFor={id}
        className="block text-[0.75rem] font-medium"
        style={{ color: "var(--text-muted)" }}
      >
        {label}{" "}
        <span style={{ color: "var(--text-faint)" }}>(optional)</span>
      </label>
      <textarea
        id={id}
        name={name}
        defaultValue={defaultValue}
        placeholder={placeholder}
        className="field min-h-[88px] resize-y"
      />
    </div>
  );
}
