"use client";

// Evening check-in on the hub (Daylio's two taps): pick a mood face, then
// tick off the habits that happened. Replaces the "How was your day?" link
// while today is unrated after 6pm; the full reflection form stays one tap
// away for notes.

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MOOD_SCALE } from "@/lib/reflect";
import { quickMoodAction } from "../reflect/actions";
import { logHabitDone } from "../habits/actions";

export function EveningCheckIn({
  habits,
}: {
  /** Habits due today and not done yet. */
  habits: Array<{ id: string; title: string }>;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [mood, setMood] = useState<number | null>(null);
  const [done, setDone] = useState<Set<string>>(() => new Set());
  const [error, setError] = useState<string | null>(null);

  const pickMood = (value: number) => {
    setMood(value);
    setError(null);
    startTransition(async () => {
      const result = await quickMoodAction(value);
      if (!result.ok) {
        setMood(null);
        setError(result.error);
      }
    });
  };

  const tickHabit = (id: string) => {
    setDone((current) => new Set([...current, id]));
    startTransition(async () => {
      await logHabitDone(id);
    });
  };

  const openHabits = habits.filter((habit) => !done.has(habit.id));

  return (
    <section
      className="fade-in-delay-1 rounded-lg border px-4 py-3.5"
      style={{
        background: "var(--accent-tint)",
        borderColor: "var(--accent-tint-strong)",
        borderLeft: "3px solid var(--accent)",
      }}
    >
      {mood === null ? (
        <>
          <p className="text-[0.875rem] font-semibold" style={{ color: "var(--text)" }}>
            How was today?
          </p>
          <div className="mt-2 flex gap-1.5" role="group" aria-label="Today's mood">
            {MOOD_SCALE.map((step) => (
              <button
                key={step.value}
                type="button"
                disabled={pending}
                onClick={() => pickMood(step.value)}
                className="btn-icon h-11 w-11 rounded-full border text-[1.375rem]"
                style={{ borderColor: "var(--border-faint)", background: "var(--bg-page)" }}
                aria-label={step.label}
                title={step.label}
              >
                {step.emoji}
              </button>
            ))}
          </div>
        </>
      ) : (
        <>
          <p className="text-[0.875rem] font-semibold" style={{ color: "var(--text)" }}>
            {MOOD_SCALE.find((step) => step.value === mood)?.emoji} Saved.{" "}
            {openHabits.length > 0 ? "Which of these happened?" : "Nice work today."}
          </p>
          {openHabits.length > 0 ? (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {openHabits.map((habit) => (
                <button
                  key={habit.id}
                  type="button"
                  className="pill"
                  disabled={pending}
                  onClick={() => tickHabit(habit.id)}
                >
                  ✓ {habit.title}
                </button>
              ))}
            </div>
          ) : null}
          <div className="mt-2 flex gap-3 text-[0.8125rem]">
            <Link href="/app/reflect" style={{ color: "var(--text-muted)" }} className="underline underline-offset-2">
              Add a note
            </Link>
            <button
              type="button"
              className="underline underline-offset-2"
              style={{ color: "var(--text-muted)" }}
              onClick={() => router.refresh()}
            >
              Done
            </button>
          </div>
        </>
      )}
      {error ? (
        <p className="mt-2 text-[0.75rem]" role="status" style={{ color: "var(--text-muted)" }}>
          {error}
        </p>
      ) : null}
    </section>
  );
}
