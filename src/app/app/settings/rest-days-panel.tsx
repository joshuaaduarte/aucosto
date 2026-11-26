"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setRestDaysAction } from "../streak-actions";

// Plan time off ahead (a trip, a sick week). Rest days come out of the
// weekly goal and habit streaks skip over them. Today or later only.

function dayLabel(key: string): string {
  const [y, m, d] = key.split("-").map(Number) as [number, number, number];
  return new Date(y, m - 1, d, 12).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export function RestDaysPanel({
  todayKey,
  maxKey,
  upcoming,
}: {
  todayKey: string;
  maxKey: string;
  upcoming: string[];
}) {
  const [from, setFrom] = useState(todayKey);
  const [to, setTo] = useState(todayKey);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const save = (input: { from: string; to: string; rest: boolean }) =>
    startTransition(async () => {
      setError(null);
      const result = await setRestDaysAction(input);
      if (!result.ok) setError(result.error);
      else router.refresh();
    });

  return (
    <div className="space-y-4">
      <p className="text-[0.8125rem] leading-[1.5]" style={{ color: "var(--text-muted)" }}>
        A rest day lowers that week&apos;s goal by one day, and habit streaks skip over it. Five or
        more in one week pauses the week. Set them on the day or ahead of time.
      </p>
      <form
        className="flex flex-wrap items-end gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          save({ from, to: to < from ? from : to, rest: true });
        }}
      >
        <label className="space-y-1 text-[0.75rem]" style={{ color: "var(--text-faint)" }}>
          <span className="block">First day</span>
          <input
            type="date"
            className="field"
            value={from}
            min={todayKey}
            max={maxKey}
            onChange={(event) => setFrom(event.target.value)}
            name="from"
          />
        </label>
        <label className="space-y-1 text-[0.75rem]" style={{ color: "var(--text-faint)" }}>
          <span className="block">Last day</span>
          <input
            type="date"
            className="field"
            value={to}
            min={from || todayKey}
            max={maxKey}
            onChange={(event) => setTo(event.target.value)}
            name="to"
          />
        </label>
        <button type="submit" className="btn-ink h-9 rounded-full px-4 text-[0.8125rem]" disabled={pending}>
          {pending ? "Saving…" : "Add rest days"}
        </button>
      </form>
      {error ? (
        <p className="text-[0.8125rem]" style={{ color: "var(--attention)" }}>
          {error}
        </p>
      ) : null}
      {upcoming.length ? (
        <ul className="flex flex-wrap gap-2" data-testid="rest-days-list">
          {upcoming.map((day) => (
            <li
              key={day}
              className="inline-flex items-center gap-1.5 rounded-full border py-1 pl-3 pr-1 text-[0.8125rem]"
              style={{ borderColor: "var(--border-soft)", color: "var(--text)" }}
            >
              {dayLabel(day)}
              <button
                type="button"
                className="btn-ghost h-6 w-6 rounded-full text-[0.75rem]"
                aria-label={`Remove ${dayLabel(day)}`}
                disabled={pending}
                onClick={() => save({ from: day, to: day, rest: false })}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-[0.8125rem]" style={{ color: "var(--text-faint)" }}>
          No rest days coming up.
        </p>
      )}
    </div>
  );
}
