import { resolveActiveUserId } from "@/lib/viewer-context";
import {
  RHYTHM_DEFINITIONS,
  RHYTHM_ORDER,
  formatRhythmDuration,
  type RhythmType,
} from "@/lib/rhythms";
import { categoryColor } from "@/lib/time-categories";
import {
  listActiveRhythms,
  listRecentRhythms,
  type RhythmSessionRecord,
} from "@/lib/services/rhythms";
import { startRhythmAction, endRhythmAction } from "./actions";
import { StartRhythmButton, EndRhythmButton } from "./rhythm-button";
import { ElapsedTime } from "./elapsed-time";

export const dynamic = "force-dynamic";

function formatStartedAt(value: Date): string {
  return value.toLocaleString(undefined, {
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

function RhythmCard({
  type,
  active,
  history,
}: {
  type: RhythmType;
  active: RhythmSessionRecord | undefined;
  history: RhythmSessionRecord[];
}) {
  const def = RHYTHM_DEFINITIONS[type];
  const accent = categoryColor(def.colorKey);
  const recent = history.slice(0, 5);

  return (
    <li
      className="flex flex-col rounded-md border p-4"
      style={{
        borderColor: "var(--border-faint)",
        borderLeft: `3px solid ${accent}`,
        background: "var(--bg-page)",
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span aria-hidden className="text-[1.5rem] leading-none">
            {def.icon}
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p
                className="text-[0.9375rem] font-semibold tracking-tight"
                style={{ color: "var(--text)" }}
              >
                {def.name}
              </p>
              {active ? (
                <span
                  className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[0.625rem] font-semibold uppercase tracking-wider"
                  style={{ background: "var(--accent-tint)", color: "var(--accent-strong)" }}
                >
                  <span
                    className="ink-pulse inline-block h-1.5 w-1.5 rounded-full"
                    style={{ background: "var(--accent)" }}
                  />
                  Active
                </span>
              ) : null}
            </div>
            <p
              className="mt-1 text-[0.8125rem] leading-relaxed"
              style={{ color: "var(--text-muted)" }}
            >
              {def.description}
            </p>
          </div>
        </div>
      </div>

      <div
        className="mt-4 flex items-center justify-between gap-3 rounded-md border px-3 py-2.5"
        style={{ borderColor: "var(--border-faint)", background: "var(--bg-tint)" }}
      >
        {active ? (
          <>
            <div className="min-w-0 text-[0.8125rem]" style={{ color: "var(--text-muted)" }}>
              <span style={{ color: "var(--text)" }}>
                <ElapsedTime startedAtMs={active.startedAt.getTime()} />
              </span>{" "}
              · since {formatStartedAt(active.startedAt)}
            </div>
            <EndRhythmButton sessionId={active.id} action={endRhythmAction} />
          </>
        ) : (
          <>
            <p className="text-[0.8125rem]" style={{ color: "var(--text-faint)" }}>
              {def.timed ? "Start the timer when you begin." : "Mark it when you flow through it."}
            </p>
            <StartRhythmButton type={type} action={startRhythmAction} />
          </>
        )}
      </div>

      <div className="mt-3">
        <p
          className="text-[0.6875rem] font-semibold uppercase tracking-wider"
          style={{ color: "var(--text-faint)" }}
        >
          Suggested flow
        </p>
        <ul className="mt-1.5 space-y-1">
          {def.checklist.map((item) => (
            <li
              key={item}
              className="flex items-start gap-2 text-[0.8125rem]"
              style={{ color: "var(--text-muted)" }}
            >
              <span
                aria-hidden
                className="mt-[0.45rem] inline-block h-1 w-1 shrink-0 rounded-full"
                style={{ background: accent }}
              />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-3">
        <p
          className="text-[0.6875rem] font-semibold uppercase tracking-wider"
          style={{ color: "var(--text-faint)" }}
        >
          Last 5
        </p>
        {recent.length === 0 ? (
          <p className="mt-1.5 text-[0.8125rem]" style={{ color: "var(--text-muted)" }}>
            No sessions logged yet.
          </p>
        ) : (
          <ul className="mt-1.5 space-y-1">
            {recent.map((session) => (
              <li
                key={session.id}
                className="flex items-baseline justify-between gap-3 text-[0.8125rem]"
                style={{ color: "var(--text-muted)" }}
              >
                <span className="truncate">{formatStartedAt(session.startedAt)}</span>
                <span
                  className="shrink-0 tabular"
                  style={{ color: session.endedAt ? "var(--text-muted)" : "var(--accent-strong)" }}
                >
                  {session.endedAt
                    ? def.timed
                      ? formatRhythmDuration(session.durationMinutes)
                      : "done"
                    : "running"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </li>
  );
}

export default async function RhythmsPage() {
  const userId = await resolveActiveUserId();
  const [activeByType, recent] = await Promise.all([
    listActiveRhythms(userId),
    listRecentRhythms(userId, { limit: 120 }),
  ]);

  const historyByType = new Map<RhythmType, RhythmSessionRecord[]>();
  for (const session of recent) {
    const list = historyByType.get(session.type) ?? [];
    list.push(session);
    historyByType.set(session.type, list);
  }

  const activeCount = activeByType.size;

  return (
    <div className="space-y-8">
      <header className="fade-in flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p
            className="text-[0.75rem] font-medium uppercase tracking-wider"
            style={{ color: "var(--text-faint)" }}
          >
            Rhythms
          </p>
          <h1
            className="mt-1 text-[1.5rem] font-bold tracking-tight sm:text-[1.875rem]"
            style={{ color: "var(--text)", letterSpacing: "-0.025em" }}
          >
            Life Rhythms
          </h1>
        </div>
        <p
          className="text-[0.8125rem] sm:max-w-[34rem] sm:text-right"
          style={{ color: "var(--text-muted)" }}
        >
          Guided flows for the day&apos;s natural transitions.
          {activeCount > 0
            ? ` ${activeCount} running now.`
            : " Start one when you move into a new part of the day."}
        </p>
      </header>

      <ul className="fade-in-delay-1 grid gap-3 lg:grid-cols-2">
        {RHYTHM_ORDER.map((type) => (
          <RhythmCard
            key={type}
            type={type}
            active={activeByType.get(type)}
            history={historyByType.get(type) ?? []}
          />
        ))}
      </ul>
    </div>
  );
}
