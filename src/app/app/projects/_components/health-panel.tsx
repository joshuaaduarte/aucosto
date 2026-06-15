"use client";

import { useState } from "react";
import { formatBudgetMinutes } from "@/lib/projects";
import type { BoardProjectDetail, ProjectTaskRecord, ProjectTimeRow } from "@/lib/services/projects";
import { TaskList } from "./task-list";
import { StartProjectTimerButton } from "./start-project-timer-button";

type Tab = "tasks" | "time" | "health";

function relativeDay(at: Date, now: Date): string {
  const startOfDay = (d: Date) => {
    const next = new Date(d);
    next.setHours(0, 0, 0, 0);
    return next;
  };
  const diff = Math.round((startOfDay(now).getTime() - startOfDay(at).getTime()) / 86_400_000);
  if (diff <= 0) return "Today";
  if (diff === 1) return "Yesterday";
  if (diff < 7) return `${diff}d ago`;
  return at.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/**
 * The detail page body: a three-tab switch (Tasks · Time · Health) so the page
 * stays calm. Health surfaces the project's cross-tool pulse as a strip of
 * tappable tiles instead of a table.
 */
export function ProjectDetailBody({
  projectId,
  projectName,
  stripColor,
  tasks,
  timeEntries,
  health,
  running,
  now,
}: {
  projectId: string;
  projectName: string;
  stripColor: string;
  tasks: ProjectTaskRecord[];
  timeEntries: ProjectTimeRow[];
  health: BoardProjectDetail["health"];
  running: boolean;
  now: Date;
}) {
  const [tab, setTab] = useState<Tab>("tasks");
  const openTaskCount = tasks.filter((task) => !task.done).length;

  const tabs: { key: Tab; label: string; badge?: number }[] = [
    { key: "tasks", label: "Tasks", badge: openTaskCount || undefined },
    { key: "time", label: "Time" },
    { key: "health", label: "Health" },
  ];

  return (
    <div className="space-y-5">
      {/* Segmented tab bar */}
      <div
        className="inline-flex w-full gap-1 rounded-xl p-1 sm:w-auto"
        style={{ background: "var(--bg-tint)" }}
      >
        {tabs.map((entry) => {
          const active = tab === entry.key;
          return (
            <button
              key={entry.key}
              type="button"
              onClick={() => setTab(entry.key)}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg px-4 py-2 text-[0.8125rem] font-medium transition-all sm:flex-none"
              style={{
                background: active ? "var(--bg-page)" : "transparent",
                color: active ? "var(--text)" : "var(--text-muted)",
                boxShadow: active ? "var(--shadow-card)" : undefined,
              }}
            >
              {entry.label}
              {entry.badge ? (
                <span className="tabular text-[0.6875rem]" style={{ color: "var(--text-faint)" }}>
                  {entry.badge}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      {tab === "tasks" ? <TaskList projectId={projectId} tasks={tasks} /> : null}

      {tab === "time" ? (
        <TimePanel
          projectId={projectId}
          projectName={projectName}
          stripColor={stripColor}
          entries={timeEntries}
          running={running}
        />
      ) : null}

      {tab === "health" ? <HealthPanel health={health} now={now} /> : null}
    </div>
  );
}

function formatRange(start: Date, end: Date | null): string {
  const time = (d: Date) => d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  return end ? `${time(start)} – ${time(end)}` : `${time(start)} – running`;
}

function TimePanel({
  projectId,
  projectName,
  stripColor,
  entries,
  running,
}: {
  projectId: string;
  projectName: string;
  stripColor: string;
  entries: ProjectTimeRow[];
  running: boolean;
}) {
  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <StartProjectTimerButton projectId={projectId} running={running} />
      </div>
      {entries.length === 0 ? (
        <p className="py-6 text-center text-[0.8125rem]" style={{ color: "var(--text-muted)" }}>
          No time tracked yet. Start a timer above.
        </p>
      ) : (
        <ul>
          {entries.map((entry) => (
            <li
              key={entry.id}
              className="flex items-center gap-2.5 border-t py-2.5 text-[0.8125rem]"
              style={{ borderColor: "var(--border-faint)" }}
            >
              <span className="shrink-0 tabular" style={{ color: "var(--text-faint)" }}>
                {entry.startedAt.toLocaleDateString(undefined, { month: "short", day: "numeric" })}
              </span>
              <span className="min-w-0 flex-1 truncate tabular" style={{ color: "var(--text)" }}>
                {formatRange(entry.startedAt, entry.endedAt)}
              </span>
              <span
                className="inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 text-[0.6875rem] font-medium"
                style={{ background: "var(--bg-tint)", color: "var(--text-muted)" }}
              >
                <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: stripColor }} aria-hidden />
                {projectName}
              </span>
              <span
                className="shrink-0 tabular text-[0.75rem] font-semibold"
                style={{ color: entry.endedAt ? "var(--text-muted)" : "var(--accent-strong)" }}
              >
                {entry.endedAt ? formatBudgetMinutes(entry.minutes) : "•"}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

type Tile = {
  key: string;
  icon: string;
  value: string;
  label: string;
  detail: string;
  ring?: number | null;
};

/** Pulse tiles: the project's cross-tool signals, one tappable square each. */
function HealthPanel({
  health,
  now,
}: {
  health: BoardProjectDetail["health"];
  now: Date;
}) {
  const [openTile, setOpenTile] = useState<string | null>(null);

  const tiles: Tile[] = [
    {
      key: "total",
      icon: "⏱",
      value: formatBudgetMinutes(health.totalMinutes),
      label: "total logged",
      detail: health.timeBudgetMinutes
        ? `${(health.totalMinutes / 60).toFixed(1)}h of ${Math.round(health.timeBudgetMinutes / 60)}h budget used (${health.budgetPct ?? 0}%)`
        : "All time logged against this project.",
      ring: health.timeBudgetMinutes ? health.budgetPct ?? 0 : null,
    },
    {
      key: "week",
      icon: "🗓",
      value: formatBudgetMinutes(health.weekMinutes),
      label: "this week",
      detail: "Time logged in the last 7 days.",
    },
  ];

  if (health.calendarBlocksThisWeek > 0) {
    tiles.push({
      key: "blocks",
      icon: "📅",
      value: String(health.calendarBlocksThisWeek),
      label: health.calendarBlocksThisWeek === 1 ? "block" : "blocks",
      detail: `${health.calendarBlocksThisWeek} calendar block${health.calendarBlocksThisWeek === 1 ? "" : "s"} scheduled this week.`,
    });
  }

  if (health.linkedHabit) {
    tiles.push({
      key: "habit",
      icon: "🔥",
      value: String(health.linkedHabit.streak),
      label: "streak",
      detail: `Linked habit "${health.linkedHabit.title}" — ${health.linkedHabit.streak} day streak.`,
    });
  }

  if (health.lastDeepWork) {
    tiles.push({
      key: "last",
      icon: "🕐",
      value: relativeDay(health.lastDeepWork.at, now),
      label: "last session",
      detail: `${health.lastDeepWork.label}${health.lastDeepWork.minutes > 0 ? ` · ${formatBudgetMinutes(health.lastDeepWork.minutes)}` : ""}`,
    });
  }

  const detail = tiles.find((tile) => tile.key === openTile)?.detail;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {tiles.map((tile) => {
          const active = openTile === tile.key;
          const pct = tile.ring ?? null;
          return (
            <button
              key={tile.key}
              type="button"
              onClick={() => setOpenTile(active ? null : tile.key)}
              className="relative flex flex-col items-center justify-center gap-1 overflow-hidden rounded-xl border px-2 py-4 transition-colors"
              style={{
                borderColor: active ? "var(--text-faint)" : "var(--border-soft)",
                background: "var(--bg-page)",
              }}
            >
              <span className="text-[1.5rem] leading-none" aria-hidden>
                {tile.icon}
              </span>
              <span className="tabular text-[0.9375rem] font-semibold" style={{ color: "var(--text)" }}>
                {tile.value}
              </span>
              <span className="text-[0.6875rem]" style={{ color: "var(--text-faint)" }}>
                {tile.label}
              </span>
              {/* Budget burn arc */}
              {pct !== null ? (
                <span
                  aria-hidden
                  className="absolute inset-x-0 bottom-0 h-1"
                  style={{ background: "var(--bg-tint-strong)" }}
                >
                  <span
                    className="block h-full"
                    style={{
                      width: `${Math.min(100, Math.max(2, pct))}%`,
                      background: pct > 100 ? "#ef4444" : "var(--accent)",
                    }}
                  />
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
      {detail ? (
        <p className="text-[0.8125rem]" style={{ color: "var(--text-muted)" }}>
          {detail}
        </p>
      ) : null}
    </div>
  );
}
