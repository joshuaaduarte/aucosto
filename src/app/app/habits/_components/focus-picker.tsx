"use client";

// "Pick a few to focus on" — shown when there are more active habits than
// anyone keeps up with and none are marked yet. Saving marks the picks
// Focus and the rest Later (still listed, just collapsed and left out of the
// evening check-in). Reopenable from the "Later" section.

import { useState, useTransition } from "react";
import { splitLeadingEmoji } from "@/lib/habit-templates";
import { saveFocusPicksAction } from "../actions";

type PickerHabit = { id: string; title: string; strength: number };

export function FocusPicker({
  habits,
  suggested,
  title = "Too many habits to keep up with?",
  defaultOpen = true,
}: {
  habits: PickerHabit[];
  suggested: string[];
  title?: string;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const [picked, setPicked] = useState<Set<string>>(() => new Set(suggested));
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="btn-ghost h-8 px-2.5 text-[0.75rem]"
      >
        Change focus habits
      </button>
    );
  }

  const toggle = (id: string) =>
    setPicked((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const save = () =>
    startTransition(async () => {
      setError(null);
      const result = await saveFocusPicksAction([...picked]);
      if (!result.ok) setError(result.error);
    });

  return (
    <div
      className="rounded-[1rem] border px-4 py-4"
      style={{ borderColor: "var(--accent-tint-strong)", background: "var(--accent-tint)" }}
    >
      <p className="text-[0.95rem] font-semibold" style={{ color: "var(--text)" }}>
        {title}
      </p>
      <p className="mt-0.5 text-[0.8125rem]" style={{ color: "var(--text-muted)" }}>
        Pick three or four to focus on. The rest move to Later, out of the way, and you can bring
        them back any time.
      </p>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {habits.map((habit) => {
          const on = picked.has(habit.id);
          const { emoji, rest } = splitLeadingEmoji(habit.title);
          return (
            <button
              key={habit.id}
              type="button"
              aria-pressed={on}
              onClick={() => toggle(habit.id)}
              className="inline-flex h-9 items-center gap-1.5 rounded-full border px-3 text-[0.8125rem] font-medium transition-colors"
              style={{
                borderColor: on ? "var(--accent)" : "var(--border-faint)",
                background: on ? "var(--bg-page)" : "transparent",
                color: on ? "var(--text)" : "var(--text-muted)",
              }}
            >
              {on ? "✓ " : ""}
              {emoji ? `${emoji} ` : ""}
              {rest}
            </button>
          );
        })}
      </div>
      <div className="mt-3 flex items-center gap-2">
        <button
          type="button"
          disabled={pending || picked.size === 0}
          onClick={save}
          className="btn-ink h-9 rounded-full px-4 text-[0.8125rem]"
        >
          {pending ? "Saving…" : `Focus on ${picked.size}`}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="btn-ghost h-9 px-3 text-[0.75rem]"
        >
          Not now
        </button>
        {error ? (
          <span className="text-[0.75rem]" style={{ color: "var(--danger, #c0392b)" }}>
            {error}
          </span>
        ) : null}
      </div>
    </div>
  );
}
