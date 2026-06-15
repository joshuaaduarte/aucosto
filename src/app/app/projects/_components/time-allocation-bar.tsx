"use client";

import { useEffect, useState } from "react";

export type AllocationSegmentView = {
  projectId: string | null;
  name: string;
  color: string;
  minutes: number;
  label: string;
  pct: number;
};

/**
 * A single thin (6px) stacked bar of time logged this week — one colored
 * segment per project, flush across the full width. No labels: tap a segment
 * to highlight its card. Segments grow in from zero width on mount.
 */
export function TimeAllocationBar({
  segments,
  highlightedId,
  onHighlight,
}: {
  segments: AllocationSegmentView[];
  highlightedId: string | null;
  onHighlight: (projectId: string | null) => void;
}) {
  const [grown, setGrown] = useState(false);

  useEffect(() => {
    const raf = requestAnimationFrame(() => setGrown(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  if (segments.length === 0) return null;

  return (
    <div
      className="flex h-1.5 w-full overflow-hidden rounded-full"
      style={{ background: "var(--bg-tint-strong)" }}
      onMouseLeave={() => onHighlight(null)}
    >
      {segments.map((segment) => {
        const active = highlightedId !== null && highlightedId === segment.projectId;
        return (
          <button
            key={segment.projectId ?? "untagged"}
            type="button"
            onClick={() => onHighlight(active ? null : segment.projectId)}
            onMouseEnter={() => onHighlight(segment.projectId)}
            onFocus={() => onHighlight(segment.projectId)}
            onBlur={() => onHighlight(null)}
            aria-label={`${segment.name}: ${segment.label}`}
            title={`${segment.name} · ${segment.label}`}
            className="h-full transition-[width,opacity] duration-700 ease-out"
            style={{
              width: grown ? `${segment.pct}%` : "0%",
              background: segment.color,
              opacity: highlightedId === null || active ? 1 : 0.3,
            }}
          />
        );
      })}
    </div>
  );
}
