import Link from "next/link";
import { moodColor, moodEmoji } from "@/lib/reflect";

// Hub reflection strip: last 7 days of mood as colored dots (tap → history)
// plus the day's state — a soft "How was your day?" nudge after 6pm, or a
// "Reflected ✓" indicator once today is saved.

export function ReflectSection({
  days,
  moodsByDay,
  reflectedToday,
  isEvening,
  streak = 0,
}: {
  /** Last 7 local day keys, oldest first (today last). */
  days: string[];
  moodsByDay: Record<string, number>;
  reflectedToday: boolean;
  isEvening: boolean;
  /** Consecutive-day reflection streak (today or yesterday anchored). */
  streak?: number;
}) {
  const showNudge = isEvening && !reflectedToday;

  return (
    <section
      className="fade-in-delay-1 flex flex-wrap items-center justify-between gap-3 rounded-lg border px-4 py-3"
      style={{
        background: showNudge ? "var(--accent-tint)" : "var(--bg-page)",
        borderColor: showNudge
          ? "var(--accent-tint-strong)"
          : "var(--border-faint)",
        borderLeft: `3px solid ${showNudge ? "var(--accent)" : "var(--border-soft)"}`,
      }}
    >
      <Link
        href="/app/reflect/history"
        className="flex min-w-0 items-center gap-3"
        title="Reflection history"
      >
        <span
          className="text-[0.6875rem] font-semibold uppercase tracking-wider"
          style={{ color: "var(--text-faint)" }}
        >
          Reflection
        </span>
        <span className="flex items-center gap-1.5" aria-label="Last 7 days of mood">
          {days.map((day) => {
            const mood = moodsByDay[day];
            return (
              <span
                key={day}
                title={mood ? `${day}: ${moodEmoji(mood)}` : `${day}: no reflection`}
                className="h-2.5 w-2.5 rounded-full"
                style={{
                  background: mood ? moodColor(mood) : "transparent",
                  border: mood
                    ? "none"
                    : "1px solid var(--border)",
                }}
              />
            );
          })}
        </span>
        {streak >= 2 ? (
          <span
            className="shrink-0 rounded-full px-2 py-0.5 text-[0.6875rem] font-semibold tabular"
            style={{ background: "var(--bg-tint)", color: "var(--text-muted)" }}
            title={`${streak} days reflected in a row`}
          >
            🔥 {streak}
          </span>
        ) : null}
      </Link>

      {reflectedToday ? (
        <Link
          href="/app/reflect"
          className="inline-flex items-center gap-1.5 text-[0.8125rem] font-medium"
          style={{ color: "var(--text-muted)" }}
        >
          Reflected ✓
        </Link>
      ) : showNudge ? (
        <Link href="/app/reflect" className="btn-ink h-9 px-3.5 text-[0.8125rem]">
          How was your day?
        </Link>
      ) : (
        <Link
          href="/app/reflect"
          className="text-[0.8125rem] font-medium"
          style={{ color: "var(--text-faint)" }}
        >
          Reflect
        </Link>
      )}
    </section>
  );
}
