"use client";

// Multi-line wellbeing chart with togglable series (mood / energy /
// productivity / overall), drawn from 7-day rolling averages. Gaps in the
// data split the line rather than interpolating across silence.

import { useState } from "react";
import type { WellbeingMetricKey } from "@/lib/insights";

const SERIES: Array<{ key: WellbeingMetricKey; label: string; color: string }> = [
  { key: "mood", label: "Mood", color: "#10b981" },
  { key: "energyLevel", label: "Energy", color: "#3b82f6" },
  { key: "productivityRating", label: "Productivity", color: "#8b5cf6" },
  { key: "dayRating", label: "Overall", color: "#f59e0b" },
];

const W = 100;
const H = 40;

function pathsFor(values: Array<number | null>): string[] {
  const segments: string[] = [];
  let current: string[] = [];
  values.forEach((value, index) => {
    if (value === null) {
      if (current.length > 1) segments.push(current.join(" "));
      current = [];
      return;
    }
    const x = values.length > 1 ? (index / (values.length - 1)) * W : W / 2;
    const y = H - 3 - ((value - 1) / 4) * (H - 8);
    current.push(`${x.toFixed(1)},${y.toFixed(1)}`);
  });
  if (current.length > 1) segments.push(current.join(" "));
  return segments;
}

export function WellbeingChart({
  series,
}: {
  series: Record<WellbeingMetricKey, { rolling: Array<number | null> }>;
}) {
  const [visible, setVisible] = useState<Record<string, boolean>>({
    mood: true,
    energyLevel: false,
    productivityRating: false,
    dayRating: true,
  });

  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-1.5">
        {SERIES.map((line) => {
          const on = visible[line.key];
          return (
            <button
              key={line.key}
              type="button"
              onClick={() =>
                setVisible((prev) => ({ ...prev, [line.key]: !prev[line.key] }))
              }
              aria-pressed={on}
              className="inline-flex items-center gap-1.5 rounded px-2 py-1 text-[0.72rem] font-medium transition-colors"
              style={{
                background: on ? "var(--bg-tint-strong)" : "var(--bg-tint)",
                color: on ? "var(--text)" : "var(--text-faint)",
              }}
            >
              <span
                className="h-1.5 w-1.5 rounded-full"
                style={{ background: line.color, opacity: on ? 1 : 0.4 }}
                aria-hidden
              />
              {line.label}
            </button>
          );
        })}
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        className="h-36 w-full sm:h-44"
        role="img"
        aria-label="Wellbeing ratings over time (7-day rolling average)"
      >
        {/* gridlines at ratings 1..5 */}
        {[1, 2, 3, 4, 5].map((rating) => {
          const y = H - 3 - ((rating - 1) / 4) * (H - 8);
          return (
            <line
              key={rating}
              x1="0"
              x2={W}
              y1={y}
              y2={y}
              stroke="var(--border-faint)"
              strokeWidth="0.3"
            />
          );
        })}
        {SERIES.filter((line) => visible[line.key]).map((line) =>
          pathsFor(series[line.key].rolling).map((points, index) => (
            <polyline
              key={`${line.key}-${index}`}
              points={points}
              fill="none"
              stroke={line.color}
              strokeWidth="1.4"
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
          )),
        )}
      </svg>
      <div
        className="mt-1 flex justify-between text-[0.625rem]"
        style={{ color: "var(--text-faint)" }}
      >
        <span>1 = rough</span>
        <span>5 = great · 7-day rolling average</span>
      </div>
    </div>
  );
}
