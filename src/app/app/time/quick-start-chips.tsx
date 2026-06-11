"use client";

// One-tap start surface shared by the start form (idle) and the running
// card's switch panel. Every chip starts a session instantly — the service
// auto-stops whatever is running, so switching activities is a single tap.

import { useState, useTransition } from "react";
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
};

export type QuickStartHabit = {
  id: string;
  title: string;
  targetLabel: string;
};

type StartPayload = {
  label: string;
  category?: string;
  doItemId?: string;
  habitId?: string;
};

export function QuickStartChips({
  categories = [],
  calendarItems = [],
  tasks = [],
  habits = [],
}: {
  categories?: QuickStartCategory[];
  calendarItems?: QuickStartCalendarItem[];
  tasks?: QuickStartTask[];
  habits?: QuickStartHabit[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [startingKey, setStartingKey] = useState<string | null>(null);

  const start = (key: string, payload: StartPayload) => {
    if (pending) return;
    setStartingKey(key);
    startTransition(async () => {
      const formData = new FormData();
      formData.set("label", payload.label);
      if (payload.category) formData.set("category", payload.category);
      if (payload.doItemId) formData.set("doItemId", payload.doItemId);
      if (payload.habitId) formData.set("habitId", payload.habitId);
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
                className="inline-flex items-center gap-1.5 rounded px-2 py-1 text-[0.75rem] font-medium transition-colors"
                style={chipStyle(startingKey === key)}
              >
                <span
                  className={`h-1.5 w-1.5 shrink-0 rounded-full${item.live ? " ink-pulse" : ""}`}
                  style={{ background: "var(--accent)" }}
                  aria-hidden
                />
                {startingKey === key ? "Starting..." : item.title}
                <span style={{ color: "var(--text-faint)" }}>
                  {item.timeLabel}
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
                  })
                }
                className="inline-flex items-center rounded px-2 py-1 text-[0.75rem] font-medium transition-colors"
                style={chipStyle(startingKey === key)}
              >
                {startingKey === key ? "Starting..." : task.title}
                {task.estimatedMinutes
                  ? ` · ${formatMinutes(task.estimatedMinutes)}`
                  : ""}
              </button>
            );
          })}
        </ChipGroup>
      )}

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
                className="inline-flex items-center rounded px-2 py-1 text-[0.75rem] font-medium transition-colors"
                style={chipStyle(startingKey === key)}
              >
                {startingKey === key ? "Starting..." : habit.title}
                {` · ${habit.targetLabel}`}
              </button>
            );
          })}
        </ChipGroup>
      )}

      {categories.length > 0 && (
        <ChipGroup label="Life">
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
                className="inline-flex items-center gap-1.5 rounded px-2 py-1 text-[0.75rem] font-medium transition-colors"
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
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <p
        className="text-[0.6875rem] font-medium uppercase tracking-wider"
        style={{ color: "var(--text-faint)" }}
      >
        {label}
      </p>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}
