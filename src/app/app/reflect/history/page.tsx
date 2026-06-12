import Link from "next/link";
import {
  MOOD_SCALE,
  RATING_FIELDS,
  moodColor,
  moodEmoji,
  summarizeSnapshot,
} from "@/lib/reflect";
import {
  listReflections,
  type DailyReflectionRecord,
} from "@/lib/services/reflect";
import { resolveActiveUserId } from "@/lib/viewer-context";

export const dynamic = "force-dynamic";

function formatDateKey(dateKey: string): string {
  return new Date(`${dateKey}T12:00:00`).toLocaleDateString([], {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export default async function ReflectHistoryPage() {
  const userId = await resolveActiveUserId();
  const reflections = await listReflections(userId, { limit: 90 });

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
            History
          </h1>
        </div>
        <Link href="/app/reflect" className="btn-ghost shrink-0">
          Today
        </Link>
      </header>

      {reflections.length === 0 ? (
        <p className="fade-in-delay-1 text-[0.9rem]" style={{ color: "var(--text-muted)" }}>
          No reflections yet. The first one takes about a minute —{" "}
          <Link
            href="/app/reflect"
            className="font-medium underline underline-offset-2"
            style={{ color: "var(--text)" }}
          >
            reflect on today
          </Link>
          .
        </p>
      ) : (
        <ul className="fade-in-delay-1 space-y-2">
          {reflections.map((reflection) => (
            <HistoryRow key={reflection.id} reflection={reflection} />
          ))}
        </ul>
      )}
    </div>
  );
}

function HistoryRow({ reflection }: { reflection: DailyReflectionRecord }) {
  const ratings: Array<{ label: string; value: number }> = RATING_FIELDS.map(
    ({ field, label }) => ({ label, value: reflection[field] }),
  );
  const prose = [
    { label: "What went well", text: reflection.wentWell },
    { label: "Carry forward", text: reflection.carryForward },
    { label: "Notes", text: reflection.freeNotes },
  ].filter((section) => section.text && section.text.trim().length > 0);

  return (
    <li
      className="rounded-lg border"
      style={{
        borderColor: "var(--border-faint)",
        background: "var(--bg-page)",
        borderLeft: `3px solid ${moodColor(reflection.mood)}`,
      }}
    >
      <details>
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3.5 py-3">
          <span className="flex min-w-0 items-center gap-2.5">
            <span className="text-[1.05rem]" aria-hidden>
              {moodEmoji(reflection.mood)}
            </span>
            <span
              className="truncate text-[0.9rem] font-medium"
              style={{ color: "var(--text)" }}
            >
              {formatDateKey(reflection.dateKey)}
            </span>
          </span>
          <span className="flex shrink-0 items-center gap-2">
            {ratings.map((rating) => (
              <span
                key={rating.label}
                title={`${rating.label}: ${MOOD_SCALE.find((s) => s.value === rating.value)?.label ?? rating.value}`}
                className="inline-flex items-center gap-1 text-[0.7rem] tabular"
                style={{ color: "var(--text-faint)" }}
              >
                <span
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ background: moodColor(rating.value) }}
                  aria-hidden
                />
                {rating.value}
              </span>
            ))}
          </span>
        </summary>

        <div
          className="space-y-3 border-t px-3.5 py-3"
          style={{ borderColor: "var(--border-faint)" }}
        >
          {reflection.contextSnapshot ? (
            <p className="text-[0.78rem]" style={{ color: "var(--text-faint)" }}>
              {summarizeSnapshot(reflection.contextSnapshot)}
            </p>
          ) : null}
          {prose.length === 0 ? (
            <p className="text-[0.8125rem]" style={{ color: "var(--text-muted)" }}>
              Ratings only — no notes that day.
            </p>
          ) : (
            prose.map((section) => (
              <div key={section.label}>
                <p
                  className="text-[0.6875rem] font-semibold uppercase tracking-wider"
                  style={{ color: "var(--text-faint)" }}
                >
                  {section.label}
                </p>
                <p
                  className="mt-0.5 whitespace-pre-line text-[0.85rem] leading-[1.55]"
                  style={{ color: "var(--text-muted)" }}
                >
                  {section.text}
                </p>
              </div>
            ))
          )}
        </div>
      </details>
    </li>
  );
}
