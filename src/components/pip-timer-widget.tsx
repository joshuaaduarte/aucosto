"use client";

// The Picture-in-Picture mini-app: a popped-out, two-screen slice of aucosto.
// It renders into the PiP document via its own React root (see
// PipLaunchButton), so it can't lean on any app context — all data arrives as
// a PipState snapshot and every mutation is an action the opener wired to a
// server action. Each mutating action returns a FRESH PipState, which this
// component swaps in (and flips the running/idle view), so the window re-renders
// itself after a stop/start without a remount.
//
// Styled with the app's own CSS tokens (--bg-*, --text-*, --accent*) and
// utilities (eyebrow, tabular, ink-pulse, hover-row, pill, field, btn-*,
// card-block, hairline-soft) — the host stylesheets are mirrored into this
// window, so they resolve and follow the same light/dark theme.

import { useEffect, useRef, useState } from "react";
import { formatDuration, formatHM } from "@/lib/time";
import { categoryColor } from "@/lib/time-categories";
import type {
  PipCategory,
  PipEvent,
  PipHabit,
  PipRunningEntry,
  PipState,
} from "@/app/app/_components/pip-data";

export type PipActions = {
  stop: () => Promise<PipState>;
  startCategory: (categoryId: string | null, title: string) => Promise<PipState>;
  startHabit: (habitId: string) => Promise<PipState>;
  logHabit: (habitId: string) => Promise<PipState>;
  saveNotes: (id: string, notes: string) => Promise<void>;
};

export function PipTimerWidget({
  initialState,
  actions,
}: {
  initialState: PipState;
  actions: PipActions;
}) {
  const [state, setState] = useState(initialState);
  const [view, setView] = useState<"running" | "idle">(
    initialState.runningEntry ? "running" : "idle",
  );
  const [busy, setBusy] = useState(false);

  async function run(work: () => Promise<PipState>, next: "running" | "idle") {
    if (busy) return;
    setBusy(true);
    try {
      const fresh = await work();
      setState(fresh);
      setView(fresh.runningEntry ? next : "idle");
    } finally {
      setBusy(false);
    }
  }

  const stop = () => run(actions.stop, "idle");
  const startCategory = (categoryId: string | null, title: string) =>
    run(() => actions.startCategory(categoryId, title), "running");
  const startHabit = (habitId: string) =>
    run(() => actions.startHabit(habitId), "running");
  const logHabit = async (habitId: string) => {
    const fresh = await actions.logHabit(habitId);
    setState(fresh);
  };

  if (view === "running" && state.runningEntry) {
    return (
      <Shell>
        <RunningScreen
          key={state.runningEntry.id}
          entry={state.runningEntry}
          habits={state.habits}
          totalMs={state.totalMs}
          events={state.upcomingEvents}
          busy={busy}
          onStop={stop}
          onSwitch={stop}
          onLogHabit={logHabit}
          onSaveNotes={actions.saveNotes}
        />
      </Shell>
    );
  }

  return (
    <Shell>
      <IdleScreen
        habits={state.habits}
        categories={state.categories}
        events={state.upcomingEvents}
        busy={busy}
        onStartHabit={startHabit}
        onStartCategory={startCategory}
      />
    </Shell>
  );
}

// ── Layout shell ──────────────────────────────────────────────────

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="flex h-screen w-screen flex-col gap-3 overflow-y-auto p-3"
      style={{
        background: "var(--bg-app)",
        color: "var(--text)",
        fontFamily:
          "var(--font-inter-tight), -apple-system, ui-sans-serif, system-ui, sans-serif",
        letterSpacing: "-0.005em",
      }}
    >
      {children}
    </div>
  );
}

function Divider() {
  return <div className="hairline-soft" />;
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="eyebrow px-0.5">{children}</p>;
}

// ── Running screen ────────────────────────────────────────────────

function RunningScreen({
  entry,
  habits,
  totalMs,
  events,
  busy,
  onStop,
  onSwitch,
  onLogHabit,
  onSaveNotes,
}: {
  entry: PipRunningEntry;
  habits: PipHabit[];
  totalMs: number;
  events: PipEvent[];
  busy: boolean;
  onStop: () => void;
  onSwitch: () => void;
  onLogHabit: (habitId: string) => Promise<void>;
  onSaveNotes: (id: string, notes: string) => Promise<void>;
}) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const elapsed = Math.max(0, now - entry.startedAtMs);

  // Auto-saving notes: debounce 800ms after the last keystroke, then flash
  // "Saved" for 1s. Seeded from the entry; this screen is keyed on entry.id by
  // the parent, so a new running entry remounts it with fresh notes.
  const [notes, setNotes] = useState(entry.notes ?? "");
  const [saved, setSaved] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (savedRef.current) clearTimeout(savedRef.current);
    },
    [],
  );

  function handleNotes(event: React.ChangeEvent<HTMLTextAreaElement>) {
    const value = event.target.value;
    setNotes(value);
    setSaved(false);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      await onSaveNotes(entry.id, value);
      setSaved(true);
      if (savedRef.current) clearTimeout(savedRef.current);
      savedRef.current = setTimeout(() => setSaved(false), 1000);
    }, 800);
  }

  return (
    <>
      {/* Timer block — the accent-tinted running card, popped out. */}
      <article
        className="rounded-md px-4 pb-3.5 pt-3"
        style={{
          background: "var(--accent-tint)",
          border: "1px solid var(--accent-tint-strong)",
        }}
      >
        <div className="flex items-center gap-2">
          <span
            className="ink-pulse inline-block h-1.5 w-1.5 rounded-full"
            style={{ background: entry.categoryColor }}
            aria-hidden
          />
          <span
            className="text-[0.625rem] font-semibold uppercase tracking-[0.08em]"
            style={{ color: "var(--accent-strong)" }}
          >
            Running{entry.categoryId ? ` · ${entry.categoryId}` : ""}
          </span>
        </div>

        <h1
          className="mt-1.5 truncate text-[1.125rem] font-bold tracking-tight"
          style={{ color: "var(--text)", letterSpacing: "-0.018em" }}
          title={entry.title}
        >
          {entry.title}
        </h1>
        <p
          className="tabular mt-1 text-[2.25rem] font-semibold leading-none"
          style={{ color: "var(--text)", letterSpacing: "-0.03em" }}
        >
          {formatDuration(elapsed)}
        </p>
        <p className="mt-1.5 text-[0.6875rem]" style={{ color: "var(--accent-strong)" }}>
          {formatHM(totalMs)} tracked today
        </p>

        <div className="mt-3.5 flex gap-2">
          <button
            type="button"
            onClick={onStop}
            disabled={busy}
            className="h-9 flex-1 rounded-md text-[0.8125rem] font-semibold disabled:opacity-50"
            style={{ background: "#dc2626", color: "#fff", border: "1px solid transparent" }}
          >
            {busy ? "…" : "Stop"}
          </button>
          <button
            type="button"
            onClick={onSwitch}
            disabled={busy}
            className="btn-ghost h-9 flex-1 rounded-md text-[0.8125rem]"
          >
            Switch
          </button>
        </div>

        {/* Auto-saving notes */}
        <div className="mt-3">
          <div className="mb-1 flex items-center justify-between px-0.5">
            <span className="eyebrow">Notes</span>
            <span
              className="text-[0.625rem] font-medium transition-opacity"
              style={{
                color: "var(--accent-strong)",
                opacity: saved ? 1 : 0,
              }}
              aria-live="polite"
            >
              Saved
            </span>
          </div>
          <textarea
            value={notes}
            onChange={handleNotes}
            rows={2}
            placeholder="Jot a thought…"
            aria-label="Notes for the running session"
            className="field w-full resize-none text-[0.8125rem]"
            style={{ minHeight: "auto" }}
          />
        </div>
      </article>

      {habits.length > 0 ? (
        <>
          <Divider />
          <HabitList
            habits={habits}
            busy={busy}
            mode="check"
            onTap={onLogHabit}
          />
        </>
      ) : null}

      {events.length > 0 ? (
        <>
          <Divider />
          <UpNext events={events} />
        </>
      ) : null}
    </>
  );
}

// ── Idle screen ───────────────────────────────────────────────────

function IdleScreen({
  habits,
  categories,
  events,
  busy,
  onStartHabit,
  onStartCategory,
}: {
  habits: PipHabit[];
  categories: PipCategory[];
  events: PipEvent[];
  busy: boolean;
  onStartHabit: (habitId: string) => void;
  onStartCategory: (categoryId: string | null, title: string) => void;
}) {
  const undone = habits.filter((habit) => !habit.done);
  const [picking, setPicking] = useState<PipCategory | null>(null);
  const [title, setTitle] = useState("");

  function begin(category: PipCategory) {
    setPicking(category);
    setTitle("");
  }

  function commit() {
    if (!picking) return;
    onStartCategory(picking.id, title.trim() || picking.name);
  }

  return (
    <>
      <h1
        className="px-0.5 pt-0.5 text-[1.125rem] font-bold tracking-tight"
        style={{ color: "var(--text)", letterSpacing: "-0.018em" }}
      >
        Start a timer
      </h1>

      {undone.length > 0 ? (
        <>
          <HabitList
            habits={undone}
            busy={busy}
            mode="start"
            onTap={async (habitId) => onStartHabit(habitId)}
          />
          <Divider />
        </>
      ) : null}

      <div className="flex flex-col gap-1">
        <SectionLabel>Categories</SectionLabel>
        {picking ? (
          <div
            className="card-block flex flex-col gap-2 p-2"
            style={{ background: "var(--bg-page)" }}
          >
            <div className="flex items-center gap-2 px-0.5">
              <span
                className="inline-block h-2 w-2 rounded-full"
                style={{ background: picking.color }}
                aria-hidden
              />
              <span className="text-[0.8125rem] font-medium" style={{ color: "var(--text)" }}>
                {picking.name}
              </span>
            </div>
            <input
              autoFocus
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") commit();
                if (event.key === "Escape") setPicking(null);
              }}
              placeholder="What are you working on?"
              aria-label="Entry name"
              className="field w-full text-[0.8125rem]"
              style={{ minHeight: "auto" }}
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={commit}
                disabled={busy}
                className="btn-ink h-8 flex-1 rounded-md text-[0.8125rem]"
              >
                {busy ? "Starting…" : "Start"}
              </button>
              <button
                type="button"
                onClick={() => setPicking(null)}
                disabled={busy}
                className="btn-ghost h-8 rounded-md px-3 text-[0.8125rem]"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {categories.map((category) => (
              <button
                key={category.id}
                type="button"
                onClick={() => begin(category)}
                disabled={busy}
                className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[0.75rem] font-medium disabled:opacity-50"
                style={{
                  borderColor: "var(--border)",
                  color: "var(--text)",
                  background: "var(--bg-page)",
                }}
              >
                <span
                  className="inline-block h-2 w-2 rounded-full"
                  style={{ background: category.color }}
                  aria-hidden
                />
                {category.name}
              </button>
            ))}
            {categories.length === 0 ? (
              <span className="text-[0.75rem]" style={{ color: "var(--text-faint)" }}>
                No categories yet.
              </span>
            ) : null}
          </div>
        )}
      </div>

      {events.length > 0 ? (
        <>
          <Divider />
          <UpNext events={events} />
        </>
      ) : null}
    </>
  );
}

// ── Shared sections ───────────────────────────────────────────────

function HabitList({
  habits,
  busy,
  mode,
  onTap,
}: {
  habits: PipHabit[];
  busy: boolean;
  // "check" → tap logs the habit done (running screen); "start" → tap starts a
  // habit timer (idle screen).
  mode: "check" | "start";
  onTap: (habitId: string) => void | Promise<void>;
}) {
  const [pending, setPending] = useState<Record<string, boolean>>({});

  async function tap(habit: PipHabit) {
    if (busy || pending[habit.id] || (mode === "check" && habit.done)) return;
    setPending((prev) => ({ ...prev, [habit.id]: true }));
    try {
      await onTap(habit.id);
    } finally {
      setPending((prev) => ({ ...prev, [habit.id]: false }));
    }
  }

  return (
    <div className="card-block px-2 py-2" style={{ background: "var(--bg-page)" }}>
      <p className="eyebrow mb-1 px-1">Habits</p>
      <ul className="flex flex-col">
        {habits.map((habit) => {
          const done = mode === "check" && habit.done;
          const isPending = Boolean(pending[habit.id]);
          return (
            <li key={habit.id}>
              <button
                type="button"
                onClick={() => tap(habit)}
                disabled={done || isPending || busy}
                className="hover-row flex w-full items-center gap-2.5 px-1.5 py-1.5 text-left enabled:cursor-pointer disabled:cursor-default"
                aria-label={
                  done
                    ? `${habit.name} — done`
                    : mode === "start"
                      ? `Start ${habit.name}`
                      : `Mark ${habit.name} done`
                }
              >
                <HabitDot color={habit.color} done={done} pending={isPending} />
                <span
                  className="min-w-0 flex-1 truncate text-[0.8125rem]"
                  style={{
                    color: done ? "var(--text-faint)" : "var(--text)",
                    textDecorationLine: done ? "line-through" : "none",
                  }}
                >
                  {habit.name}
                </span>
                {mode === "start" ? (
                  <span
                    className="shrink-0 text-[0.6875rem] font-medium"
                    style={{ color: "var(--accent-strong)" }}
                  >
                    Start
                  </span>
                ) : habit.streak > 0 ? (
                  <span className="pill tabular shrink-0">🔥 {habit.streak}</span>
                ) : null}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function UpNext({ events }: { events: PipEvent[] }) {
  return (
    <div className="flex flex-col gap-1">
      <SectionLabel>Up Next</SectionLabel>
      <ul className="flex flex-col">
        {events.slice(0, 3).map((event) => (
          <EventRow key={event.id} event={event} />
        ))}
      </ul>
    </div>
  );
}

function EventRow({ event }: { event: PipEvent }) {
  const start = new Date(event.startTime);
  const end = new Date(event.endTime);
  const time = start.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
  const typeColor =
    event.type === "habit"
      ? categoryColor("habit")
      : event.type === "task"
        ? categoryColor("do")
        : categoryColor("calendar");
  const right =
    event.type === "block"
      ? formatGap(end.getTime() - start.getTime())
      : `(${event.type})`;

  return (
    <li className="flex items-center gap-2 px-1 py-1">
      <span
        className="inline-block h-2 w-2 shrink-0 rounded-full"
        style={{ background: typeColor }}
        aria-hidden
      />
      <span
        className="tabular shrink-0 text-[0.75rem]"
        style={{ color: "var(--text-muted)", width: "3.75rem" }}
      >
        {time}
      </span>
      <span
        className="min-w-0 flex-1 truncate text-[0.8125rem]"
        style={{ color: "var(--text)" }}
      >
        {event.title}
      </span>
      <span
        className="shrink-0 text-[0.75rem]"
        style={{ color: "var(--text-faint)" }}
      >
        {right}
      </span>
    </li>
  );
}

/** Compact duration: "30m", "1h", "1h 30m". */
function formatGap(ms: number) {
  const minutes = Math.max(0, Math.round(ms / 60000));
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours}h ${rest}m` : `${hours}h`;
}

/** 15px status marker: hollow ring (tappable) → filled check (done). */
function HabitDot({
  color,
  done,
  pending,
}: {
  color: string;
  done: boolean;
  pending: boolean;
}) {
  if (done) {
    return (
      <span
        className="inline-flex h-[15px] w-[15px] shrink-0 items-center justify-center rounded-full"
        style={{ background: color }}
        aria-hidden
      >
        <svg
          width="9"
          height="9"
          viewBox="0 0 16 16"
          fill="none"
          stroke="#fff"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M3 8.5 6.5 12 13 4.5" />
        </svg>
      </span>
    );
  }
  return (
    <span
      className="inline-block h-[15px] w-[15px] shrink-0 rounded-full border-2"
      style={{
        borderColor: color,
        opacity: pending ? 1 : 0.7,
        background: pending ? color : "transparent",
      }}
      aria-hidden
    />
  );
}