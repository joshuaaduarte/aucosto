"use client";

// One-tap start surface shared by the start form (idle) and the running
// card's switch panel. Every chip starts a session instantly — the service
// auto-stops whatever is running, so switching activities is a single tap.
//
// Section order is tuned for "open app → tap → tracking": today's habits and
// tasks come first (the highest-intent, zero-typing cases), then what's on the
// calendar, then recent sessions, then the life categories for free-form time.

import { useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { formatMinutes } from "@/lib/do";
import { quickStartEntry } from "./actions";

export type QuickStartCategory = {
  id: string;
  label: string;
  color: string;
};

export type QuickStartCalendarItem = {
  id: string;
  title: string;
  timeLabel: string;
  live: boolean;
};

export type QuickStartTask = {
  id: string;
  title: string;
  estimatedMinutes: number | null;
  projectName?: string | null;
  projectId?: string | null;
};

export type QuickStartHabit = {
  id: string;
  title: string;
  targetLabel: string;
  color: string;
};

export type QuickStartRecent = {
  label: string;
  category: string | null;
  color: string;
};

export type StartPayload = {
  label: string;
  category?: string;
  doItemId?: string;
  habitId?: string;
  projectId?: string;
};

export function QuickStartChips({
  categories = [],
  calendarItems = [],
  tasks = [],
  habits = [],
  recents = [],
  categoryManage,
  runningHabit = null,
  onSwitchHabitLogRequired,
}: {
  categories?: QuickStartCategory[];
  calendarItems?: QuickStartCalendarItem[];
  tasks?: QuickStartTask[];
  habits?: QuickStartHabit[];
  recents?: QuickStartRecent[];
  categoryManage?: ReactNode;
  /** The habit linked to the currently-running timer, when used as the
   * running card's switch panel — check/count habits need an explicit log
   * before switching away, so taps are routed to the parent instead. */
  runningHabit?: { id: string; isMinuteHabit: boolean } | null;
  onSwitchHabitLogRequired?: (payload: StartPayload) => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [startingKey, setStartingKey] = useState<string | null>(null);

  const start = (key: string, payload: StartPayload) => {
    if (pending) return;
    if (runningHabit && !runningHabit.isMinuteHabit && onSwitchHabitLogRequired) {
      onSwitchHabitLogRequired(payload);
      return;
    }
    setStartingKey(key);
    startTransition(async () => {
      const formData = new FormData();
      formData.set("label", payload.label);
      if (payload.category) formData.set("category", payload.category);
      if (payload.doItemId) formData.set("doItemId", payload.doItemId);
      if (payload.habitId) formData.set("habitId", payload.habitId);
      if (payload.projectId) formData.set("projectId", payload.projectId);
      await quickStartEntry(formData);
      setStartingKey(null);
      router.refresh();
    });
  };

  const chipStyle = (active: boolean) => ({
    background: "var(--bg-tint)",
    color: "var(--text-muted)",
    opacity: pending && !active ? 0.55 : 1,
  });

  return (
    <div className="space-y-3">
      {habits.length > 0 && (
        <ChipGroup label="Habits">
          {habits.map((habit) => {
            const key = `habit:${habit.id}`;
            return (
              <button
                key={key}
                type="button"
                disabled={pending}
                onClick={() =>
                  start(key, {
                    label: habit.title,
                    category: "habit",
                    habitId: habit.id,
                  })
                }
                className="inline-flex shrink-0 items-center gap-1.5 rounded px-2.5 py-1.5 text-[0.75rem] font-medium transition-colors [@media(pointer:coarse)]:min-h-[2.75rem]"
                style={chipStyle(startingKey === key)}
              >
                <span
                  className="h-1.5 w-1.5 shrink-0 rounded-full"
                  style={{ background: habit.color }}
                  aria-hidden
                />
                {startingKey === key ? "Starting..." : habit.title}
                <span style={{ color: "var(--text-faint)" }}>
                  {habit.targetLabel}
                </span>
              </button>
            );
          })}
        </ChipGroup>
      )}

      {tasks.length > 0 && (
        <ChipGroup label="Tasks">
          {tasks.map((task) => {
            const key = `task:${task.id}`;
            return (
              <button
                key={key}
                type="button"
                disabled={pending}
                onClick={() =>
                  start(key, {
                    label: task.title,
                    category: "do",
                    doItemId: task.id,
                    projectId: task.projectId ?? undefined,
                  })
                }
                className="inline-flex shrink-0 items-center gap-1.5 rounded px-2.5 py-1.5 text-[0.75rem] font-medium transition-colors [@media(pointer:coarse)]:min-h-[2.75rem]"
                style={chipStyle(startingKey === key)}
              >
                <span className="max-w-[16ch] truncate">
                  {startingKey === key ? "Starting..." : task.title}
                </span>
                {task.projectName ? (
                  <span className="max-w-[10ch] truncate" style={{ color: "var(--text-faint)" }}>
                    {task.projectName}
                  </span>
                ) : task.estimatedMinutes ? (
                  <span style={{ color: "var(--text-faint)" }}>
                    {formatMinutes(task.estimatedMinutes)}
                  </span>
                ) : null}
              </button>
            );
          })}
        </ChipGroup>
      )}

      {calendarItems.length > 0 && (
        <ChipGroup label="On the calendar">
          {calendarItems.map((item) => {
            const key = `cal:${item.id}`;
            return (
              <button
                key={key}
                type="button"
                disabled={pending}
                onClick={() =>
                  start(key, { label: item.title, category: "calendar" })
                }
                className="inline-flex shrink-0 items-center gap-1.5 rounded px-2.5 py-1.5 text-[0.75rem] font-medium transition-colors [@media(pointer:coarse)]:min-h-[2.75rem]"
                style={chipStyle(startingKey === key)}
              >
                <span
                  className={`h-1.5 w-1.5 shrink-0 rounded-full${item.live ? " ink-pulse" : ""}`}
                  style={{ background: "var(--accent)" }}
                  aria-hidden
                />
                <span className="max-w-[14ch] truncate">
                  {startingKey === key ? "Starting..." : item.title}
                </span>
                <span style={{ color: "var(--text-faint)" }}>
                  {item.timeLabel}
                </span>
              </button>
            );
          })}
        </ChipGroup>
      )}

      {recents.length > 0 && (
        <ChipGroup label="Recent">
          {recents.map((recent, index) => {
            const key = `recent:${index}:${recent.label}`;
            return (
              <button
                key={key}
                type="button"
                disabled={pending}
                onClick={() =>
                  start(key, {
                    label: recent.label,
                    category: recent.category ?? undefined,
                  })
                }
                className="inline-flex shrink-0 items-center gap-1.5 rounded px-2.5 py-1.5 text-[0.75rem] font-medium transition-colors [@media(pointer:coarse)]:min-h-[2.75rem]"
                style={chipStyle(startingKey === key)}
              >
                <span
                  className="h-1.5 w-1.5 shrink-0 rounded-full"
                  style={{ background: recent.color }}
                  aria-hidden
                />
                <span className="max-w-[16ch] truncate">
                  {startingKey === key ? "Starting..." : recent.label}
                </span>
              </button>
            );
          })}
        </ChipGroup>
      )}

      {categories.length > 0 && (
        <ChipGroup label="Life" action={categoryManage}>
          {categories.map((category) => {
            const key = `category:${category.id}`;
            return (
              <button
                key={key}
                type="button"
                disabled={pending}
                onClick={() =>
                  start(key, {
                    label: category.label,
                    category: category.id,
                  })
                }
                className="inline-flex shrink-0 items-center gap-1.5 rounded px-2.5 py-1.5 text-[0.75rem] font-medium transition-colors [@media(pointer:coarse)]:min-h-[2.75rem]"
                style={chipStyle(startingKey === key)}
              >
                <span
                  className="h-1.5 w-1.5 shrink-0 rounded-full"
                  style={{ background: category.color }}
                  aria-hidden
                />
                {startingKey === key ? "Starting..." : category.label}
              </button>
            );
          })}
        </ChipGroup>
      )}
    </div>
  );
}

function ChipGroup({
  label,
  action,
  children,
}: {
  label: string;
  action?: ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <p
          className="text-[0.6875rem] font-medium uppercase tracking-wider"
          style={{ color: "var(--text-faint)" }}
        >
          {label}
        </p>
        {action ? <span className="shrink-0">{action}</span> : null}
      </div>
      <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 no-scrollbar sm:flex-wrap sm:overflow-x-visible sm:pb-0">{children}</div>
    </div>
  );
}
