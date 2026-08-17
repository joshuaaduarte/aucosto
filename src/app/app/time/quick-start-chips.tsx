"use client";

// One-tap start surface shared by the start form (idle) and the running
// card's switch panel. Every chip starts a session instantly — the service
// auto-stops whatever is running, so switching activities is a single tap.
//
// Section order is tuned for "open app → tap → tracking": today's habits and
// tasks come first (the highest-intent, zero-typing cases), then what's on the
// calendar, then recent sessions, then the life categories for free-form time.

import { useState, useTransition, type CSSProperties, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { formatMinutes } from "@/lib/do";
import { quickStartEntry } from "./actions";
import { useBodyScrollLock } from "../_components/use-body-scroll-lock";

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

export type QuickStartPrediction = {
  key: string;
  label: string;
  category: string;
  reason: string;
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
  predictions = [],
  categoryManage,
  mode = "start",
  runningHabit = null,
  onSwitchHabitLogRequired,
}: {
  categories?: QuickStartCategory[];
  calendarItems?: QuickStartCalendarItem[];
  tasks?: QuickStartTask[];
  habits?: QuickStartHabit[];
  recents?: QuickStartRecent[];
  predictions?: QuickStartPrediction[];
  categoryManage?: ReactNode;
  mode?: "start" | "switch";
  /** The habit linked to the currently-running timer, when used as the
   * running card's switch panel — check/count habits need an explicit log
   * before switching away, so taps are routed to the parent instead. */
  runningHabit?: { id: string; isMinuteHabit: boolean } | null;
  onSwitchHabitLogRequired?: (payload: StartPayload) => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [startingKey, setStartingKey] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  useBodyScrollLock(pickerOpen);

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

  const allOptions: QuickStartOption[] = [
    ...predictions.map((prediction) => ({
      key: `prediction:${prediction.key}`,
      label: prediction.label,
      detail: "Likely now",
      reason: prediction.reason,
      color: "var(--accent)",
      payload: { label: prediction.label, category: prediction.category },
      rank: 100,
      group: "Now" as const,
    })),
    ...habits.map((habit) => ({
      key: `habit:${habit.id}`,
      label: habit.title,
      detail: habit.targetLabel,
      color: habit.color,
      payload: { label: habit.title, category: "habit", habitId: habit.id },
      rank: 86,
      group: "Planned" as const,
    })),
    ...tasks.map((task) => ({
      key: `task:${task.id}`,
      label: task.title,
      detail: task.projectName ?? (task.estimatedMinutes ? formatMinutes(task.estimatedMinutes) : "Task"),
      color: "var(--accent)",
      payload: {
        label: task.title,
        category: "do",
        doItemId: task.id,
        projectId: task.projectId ?? undefined,
      },
      rank: 78,
      group: "Planned" as const,
    })),
    ...calendarItems.map((item) => ({
      key: `cal:${item.id}`,
      label: item.title,
      detail: item.live ? "On calendar now" : item.timeLabel,
      color: "var(--accent)",
      payload: { label: item.title, category: "calendar" },
      rank: item.live ? 92 : 72,
      group: "Planned" as const,
    })),
    ...recents.map((recent, index) => ({
      key: `recent:${index}:${recent.label}`,
      label: recent.label,
      detail: "Recent",
      color: recent.color,
      payload: {
        label: recent.label,
        category: recent.category ?? undefined,
      },
      rank: 58,
      group: "Recent" as const,
    })),
    ...categories.map((category) => ({
      key: `category:${category.id}`,
      label: category.label,
      detail: "Category",
      color: category.color,
      payload: {
        label: category.label,
        category: category.id,
      },
      rank: 30,
      group: "Categories" as const,
    })),
  ];

  const uniqueOptions = dedupeOptions(allOptions).sort((a, b) => b.rank - a.rank);
  const primary = uniqueOptions[0] ?? null;
  const alternatives = uniqueOptions.slice(1, 4);
  const isSwitchMode = mode === "switch";
  const verb = isSwitchMode ? "Switch to" : "Start";

  return (
    <div className="space-y-3">
      {primary ? (
        <button
          type="button"
          disabled={pending}
          onClick={() => start(primary.key, primary.payload)}
          className="group flex w-full items-center justify-between gap-3 rounded-md border px-4 py-3 text-left transition-colors [@media(pointer:coarse)]:min-h-[3.5rem]"
          style={{
            background: "var(--bg-page)",
            borderColor: "var(--border-soft)",
            opacity: pending && startingKey !== primary.key ? 0.55 : 1,
          }}
        >
          <span className="flex min-w-0 items-center gap-3">
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ background: primary.color }}
              aria-hidden
            />
            <span className="min-w-0">
              <span
                className="block truncate text-[0.9375rem] font-semibold"
                style={{ color: "var(--text)" }}
              >
                {startingKey === primary.key ? "Starting..." : `${verb} ${primary.label}`}
              </span>
              <span
                className="mt-0.5 block truncate text-[0.75rem]"
                style={{ color: "var(--text-faint)" }}
              >
                {primary.reason ?? primary.detail}
              </span>
            </span>
          </span>
          <span
            className="shrink-0 rounded px-2 py-1 text-[0.6875rem] font-semibold uppercase tracking-wider"
            style={{ background: "var(--accent-tint)", color: "var(--accent-strong)" }}
          >
            {isSwitchMode ? "Switch" : "Start"}
          </span>
        </button>
      ) : null}

      <div className="flex items-center gap-2">
        <div className="min-w-0 flex flex-1 gap-1.5 overflow-x-auto no-scrollbar">
          {alternatives.map((option) => (
            <OptionChip
              key={option.key}
              option={option}
              active={startingKey === option.key}
              disabled={pending}
              onStart={() => start(option.key, option.payload)}
              style={chipStyle(startingKey === option.key)}
            />
          ))}
        </div>
        {uniqueOptions.length > 0 ? (
          <button
            type="button"
            className="btn-ghost shrink-0 px-2.5 py-1.5 text-[0.75rem]"
            onClick={() => setPickerOpen(true)}
          >
            More
          </button>
        ) : null}
      </div>

      {pickerOpen ? (
        <div
          className="calendar-modal-backdrop"
          role="presentation"
          onClick={() => setPickerOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="quick-start-picker-title"
            className="calendar-modal"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p
                  className="text-[0.6875rem] font-semibold uppercase tracking-wider"
                  style={{ color: "var(--text-faint)" }}
                >
                  {isSwitchMode ? "Switch timer" : "Start timer"}
                </p>
                <h2
                  id="quick-start-picker-title"
                  className="mt-1 text-[1.125rem] font-semibold tracking-tight"
                  style={{ color: "var(--text)" }}
                >
                  Pick what is happening
                </h2>
              </div>
              <button
                type="button"
                className="btn-icon h-8 w-8 rounded-full border"
                style={{ borderColor: "var(--border-faint)" }}
                onClick={() => setPickerOpen(false)}
                aria-label="Close start picker"
              >
                x
              </button>
            </div>

            <div className="mt-5 space-y-5">
              {["Now", "Planned", "Recent", "Categories"].map((group) => {
                const groupOptions = uniqueOptions.filter((option) => option.group === group);
                if (groupOptions.length === 0) return null;
                return (
                  <PickerGroup key={group} label={group}>
                    {groupOptions.map((option) => (
                      <button
                        key={option.key}
                        type="button"
                        disabled={pending}
                        onClick={() => {
                          setPickerOpen(false);
                          start(option.key, option.payload);
                        }}
                        className="flex w-full items-center justify-between gap-3 rounded px-3 py-2.5 text-left transition-colors"
                        style={{ background: "var(--bg-tint)", color: "var(--text)" }}
                      >
                        <span className="flex min-w-0 items-center gap-2.5">
                          <span
                            className="h-2 w-2 shrink-0 rounded-full"
                            style={{ background: option.color }}
                            aria-hidden
                          />
                          <span className="min-w-0">
                            <span className="block truncate text-[0.875rem] font-medium">
                              {option.label}
                            </span>
                            <span
                              className="block truncate text-[0.75rem]"
                              style={{ color: "var(--text-faint)" }}
                            >
                              {option.reason ?? option.detail}
                            </span>
                          </span>
                        </span>
                        <span className="text-[0.75rem]" style={{ color: "var(--text-faint)" }}>
                          {isSwitchMode ? "Switch" : "Start"}
                        </span>
                      </button>
                    ))}
                  </PickerGroup>
                );
              })}
              {categoryManage ? (
                <div className="border-t pt-4" style={{ borderColor: "var(--border-faint)" }}>
                  {categoryManage}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

type QuickStartOption = {
  key: string;
  label: string;
  detail: string;
  reason?: string;
  color: string;
  payload: StartPayload;
  rank: number;
  group: "Now" | "Planned" | "Recent" | "Categories";
};

function dedupeOptions(options: QuickStartOption[]) {
  const seen = new Set<string>();
  const result: QuickStartOption[] = [];
  for (const option of options) {
    const key = `${option.payload.category ?? ""}:${option.payload.doItemId ?? ""}:${option.payload.habitId ?? ""}:${option.label.trim().toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(option);
  }
  return result;
}

function OptionChip({
  option,
  active,
  disabled,
  onStart,
  style,
}: {
  option: QuickStartOption;
  active: boolean;
  disabled: boolean;
  onStart: () => void;
  style: CSSProperties;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onStart}
      className="inline-flex shrink-0 items-center gap-1.5 rounded px-2.5 py-1.5 text-[0.75rem] font-medium transition-colors [@media(pointer:coarse)]:min-h-[2.75rem]"
      style={style}
      title={option.reason ?? option.detail}
    >
      <span
        className="h-1.5 w-1.5 shrink-0 rounded-full"
        style={{ background: option.color }}
        aria-hidden
      />
      <span className="max-w-[16ch] truncate">
        {active ? "Starting..." : option.label}
      </span>
    </button>
  );
}

function PickerGroup({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <p
        className="text-[0.6875rem] font-semibold uppercase tracking-wider"
        style={{ color: "var(--text-faint)" }}
      >
        {label}
      </p>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}
