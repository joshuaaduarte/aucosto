"use client";

// Evening planning: name two or three blocks for tomorrow. Deliberately a
// single short form with no navigation — this is the deep-link target of the
// evening push, so the distance from notification to saved plan is one screen.

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { DEFAULT_PLAN_SLOTS } from "@/lib/day-plan";
import { savePlanAction } from "./actions";

type State = { ok?: true; blocks?: number; error?: string } | null;

const HOURS = Array.from({ length: 24 }, (_, hour) => hour);
const DURATIONS = [30, 45, 60, 90, 120, 180];

function hourLabel(hour: number): string {
  const suffix = hour < 12 ? "AM" : "PM";
  const display = hour % 12 === 0 ? 12 : hour % 12;
  return `${display}:00 ${suffix}`;
}

export function PlanForm({
  target,
  initial,
}: {
  target: "today" | "tomorrow";
  /** Existing plan, so re-opening the screen edits rather than duplicates. */
  initial: Array<{ title: string; startHour: number; durationMinutes: number }>;
}) {
  const router = useRouter();
  const [rows, setRows] = useState(() =>
    initial.length > 0
      ? initial
      : DEFAULT_PLAN_SLOTS.map((slot) => ({
          title: "",
          startHour: slot.startHour,
          durationMinutes: slot.durationMinutes,
        })),
  );

  const [state, formAction, pending] = useActionState<State, FormData>(
    async (_prev, formData) => {
      const result = await savePlanAction(formData);
      if (result && "ok" in result && result.ok) {
        router.refresh();
        return { ok: true, blocks: result.blocks };
      }
      return { error: (result as { error?: string })?.error ?? "Could not save." };
    },
    null,
  );

  function update(index: number, patch: Partial<(typeof rows)[number]>) {
    setRows((prev) =>
      prev.map((row, i) => (i === index ? { ...row, ...patch } : row)),
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="target" value={target} />

      <div className="space-y-3">
        {rows.map((row, index) => (
          <div
            key={index}
            className="rounded-lg border p-3"
            style={{
              borderColor: "var(--border-faint)",
              background: "var(--bg-page)",
            }}
          >
            <input
              name="title"
              value={row.title}
              onChange={(event) => update(index, { title: event.target.value })}
              placeholder={
                DEFAULT_PLAN_SLOTS[index]?.label ?? "What's the block?"
              }
              className="field w-full"
              autoComplete="off"
              maxLength={120}
            />
            <div className="mt-2 flex items-center gap-2">
              <select
                name="startHour"
                value={row.startHour}
                onChange={(event) =>
                  update(index, { startHour: Number(event.target.value) })
                }
                className="field"
                aria-label="Start time"
              >
                {HOURS.map((hour) => (
                  <option key={hour} value={hour}>
                    {hourLabel(hour)}
                  </option>
                ))}
              </select>
              <select
                name="durationMinutes"
                value={row.durationMinutes}
                onChange={(event) =>
                  update(index, { durationMinutes: Number(event.target.value) })
                }
                className="field"
                aria-label="Duration"
              >
                {DURATIONS.map((minutes) => (
                  <option key={minutes} value={minutes}>
                    {minutes < 60
                      ? `${minutes}m`
                      : `${minutes / 60}h${minutes % 60 ? ` ${minutes % 60}m` : ""}`}
                  </option>
                ))}
              </select>
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button type="submit" disabled={pending} className="btn-ink h-10 px-4">
          {pending ? "Saving…" : "Save the plan"}
        </button>
        {rows.length < 5 ? (
          <button
            type="button"
            className="btn-ghost h-10 px-3"
            onClick={() =>
              setRows((prev) => [
                ...prev,
                { title: "", startHour: 15, durationMinutes: 60 },
              ])
            }
          >
            Add a block
          </button>
        ) : null}
      </div>

      {state?.error ? (
        <p className="text-[0.8125rem]" style={{ color: "var(--danger, #ef4444)" }}>
          {state.error}
        </p>
      ) : null}
      {state?.ok ? (
        <p className="text-[0.8125rem]" style={{ color: "var(--text-muted)" }}>
          Saved {state.blocks} {state.blocks === 1 ? "block" : "blocks"}. You&apos;ll
          get a nudge in the morning to confirm.
        </p>
      ) : null}
    </form>
  );
}
