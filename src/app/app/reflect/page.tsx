import Link from "next/link";
import { dayKey, moodColor, summarizeSnapshot } from "@/lib/reflect";
import {
  buildReflectionSnapshot,
  getReflection,
  listRecentMoods,
} from "@/lib/services/reflect";
import { resolveActiveUserId } from "@/lib/viewer-context";
import { ReflectionForm } from "./reflection-form";

export const dynamic = "force-dynamic";

export default async function ReflectPage() {
  const userId = await resolveActiveUserId();
  const now = new Date();
  const todayKey = dayKey(now);

  const [existing, context, recentMoods] = await Promise.all([
    getReflection(userId, todayKey),
    buildReflectionSnapshot(userId, now),
    listRecentMoods(userId, { days: 7 }),
  ]);

  // Last 7 day keys (oldest → today) for the mood-dot strip.
  const moodsByDay = Object.fromEntries(
    recentMoods.map((row) => [row.dateKey, row.mood]),
  );
  const last7Days = Array.from({ length: 7 }, (_, index) => {
    const day = new Date(now);
    day.setHours(0, 0, 0, 0);
    day.setDate(day.getDate() - (6 - index));
    return dayKey(day);
  });

  const todayLabel = now.toLocaleDateString([], {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="mx-auto max-w-[40rem] space-y-8">
      <header className="fade-in flex items-end justify-between gap-3">
        <div>
          <p
            className="text-[0.75rem] font-medium uppercase tracking-wider"
            style={{ color: "var(--text-faint)" }}
          >
            Reflect
          </p>
          <h1
            className="mt-1 text-[1.5rem] font-bold tracking-tight sm:text-[1.875rem]"
            style={{ color: "var(--text)", letterSpacing: "-0.025em" }}
          >
            {todayLabel}
          </h1>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <Link
            href="/app/reflect/history"
            className="flex items-center gap-1.5"
            title="Last 7 days of mood — tap for history"
            aria-label="Reflection history"
          >
            {last7Days.map((day) => {
              const mood = moodsByDay[day];
              return (
                <span
                  key={day}
                  className="h-2.5 w-2.5 rounded-full"
                  style={{
                    background: mood ? moodColor(mood) : "transparent",
                    border: mood ? "none" : "1px solid var(--border)",
                  }}
                />
              );
            })}
          </Link>
          <Link href="/app/reflect/history" className="btn-ghost shrink-0">
            History
          </Link>
        </div>
      </header>

      {/* Auto-captured context: the day so far, plus session notes. */}
      <section
        className="fade-in-delay-1 rounded-xl px-4 py-4 sm:px-5"
        style={{
          background: "var(--bg-tint)",
          border: "1px solid var(--border-faint)",
        }}
      >
        <p
          className="text-[0.6875rem] font-semibold uppercase tracking-wider"
          style={{ color: "var(--text-faint)" }}
        >
          Today so far
        </p>
        <p
          className="mt-1 text-[0.95rem] font-medium leading-[1.55]"
          style={{ color: "var(--text)" }}
        >
          {summarizeSnapshot(context)}
        </p>
        {context.entryNotes.length > 0 ? (
          <div className="mt-3 max-h-44 space-y-2 overflow-y-auto pr-1">
            {context.entryNotes.map((note, index) => (
              <div
                key={`${note.label}-${index}`}
                className="rounded-md px-3 py-2"
                style={{ background: "var(--bg-page)" }}
              >
                <p
                  className="text-[0.6875rem] font-semibold uppercase tracking-wider"
                  style={{ color: "var(--text-faint)" }}
                >
                  {note.label}
                </p>
                <p
                  className="mt-0.5 whitespace-pre-line text-[0.8125rem] leading-[1.5]"
                  style={{ color: "var(--text-muted)" }}
                >
                  {note.note}
                </p>
              </div>
            ))}
          </div>
        ) : null}
      </section>

      <section className="fade-in-delay-2">
        <ReflectionForm existing={existing} />
      </section>
    </div>
  );
}
