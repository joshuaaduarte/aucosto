"use client";

// One vertical lane of the day timeline (planned OR tracked). Renders the
// hour grid, any read-only rhythm context, the live "now" line, and the
// positioned blocks. The tracked lane additionally supports click-drag to
// carve out a new time entry (snapping to 15-minute steps) which opens the
// shared EntryModal with the dragged range pre-filled.

import { type PointerEvent as ReactPointerEvent, useRef, useState } from "react";
import type { LinkableTask } from "../../time/entry-editor";
import { EntryModal } from "../../time/entry-editor";
import type { TimelineBlock, TimelineHourMark } from "../_lib/timeline";
import {
  TimelineBlockButton,
  type TimelineBlockPayload,
} from "./timeline-block";
import { TimelineNowLine } from "./timeline-now-line";

const SNAP_MINUTES = 15;
const DEFAULT_SLOT_MINUTES = 30;

function snap(minutes: number, totalMinutes: number): number {
  const snapped = Math.round(minutes / SNAP_MINUTES) * SNAP_MINUTES;
  return Math.min(totalMinutes, Math.max(0, snapped));
}

function dateField(date: Date): string {
  return date.toLocaleDateString("en-CA");
}

function timeField(date: Date): string {
  return date.toLocaleTimeString("en-CA", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function rangeLabel(start: Date, end: Date): string {
  const fmt = (d: Date) =>
    d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  return `${fmt(start)} – ${fmt(end)}`;
}

export function TimelineLane({
  blocks,
  hourMarks,
  windowStartIso,
  windowEndIso,
  height,
  variant,
  narrow = false,
  payloads,
  tasks,
  context = [],
  enableCreate = false,
}: {
  blocks: TimelineBlock[];
  hourMarks: TimelineHourMark[];
  windowStartIso: string;
  windowEndIso: string;
  height: number;
  variant: "planned" | "actual";
  /** Narrow column: thin colour-strip blocks with a hover popover. */
  narrow?: boolean;
  payloads: Record<string, TimelineBlockPayload>;
  tasks: LinkableTask[];
  /** Read-only rhythm context drawn behind the tracked blocks. */
  context?: TimelineBlock[];
  /** Tracked lane only: allow dragging out a new entry. */
  enableCreate?: boolean;
}) {
  const laneRef = useRef<HTMLDivElement>(null);
  const anchorRef = useRef(0);
  const [drag, setDrag] = useState<{ startMin: number; endMin: number } | null>(
    null,
  );
  const [pending, setPending] = useState<{
    date: string;
    start: string;
    end: string;
  } | null>(null);

  const windowStartMs = new Date(windowStartIso).getTime();
  const windowEndMs = new Date(windowEndIso).getTime();
  const totalMinutes = Math.max(1, (windowEndMs - windowStartMs) / 60_000);

  const minutesFromEvent = (clientY: number): number => {
    const rect = laneRef.current?.getBoundingClientRect();
    if (!rect || rect.height <= 0) return 0;
    const y = Math.min(rect.height, Math.max(0, clientY - rect.top));
    return snap((y / rect.height) * totalMinutes, totalMinutes);
  };

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!enableCreate) return;
    // Primary button / touch / pen only; let block taps bubble out (they
    // stop propagation themselves).
    if (event.button !== 0) return;
    const min = minutesFromEvent(event.clientY);
    anchorRef.current = min;
    setDrag({ startMin: min, endMin: min });
    laneRef.current?.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!drag) return;
    const min = minutesFromEvent(event.clientY);
    setDrag({
      startMin: Math.min(anchorRef.current, min),
      endMin: Math.max(anchorRef.current, min),
    });
  };

  const handlePointerUp = () => {
    if (!drag) return;
    let startMin = drag.startMin;
    let endMin = drag.endMin;
    // A click (or sub-15-min drag) becomes a default 30-minute slot.
    if (endMin - startMin < SNAP_MINUTES) {
      startMin = Math.min(
        anchorRef.current,
        Math.max(0, totalMinutes - DEFAULT_SLOT_MINUTES),
      );
      endMin = Math.min(totalMinutes, startMin + DEFAULT_SLOT_MINUTES);
    }
    const startDate = new Date(windowStartMs + startMin * 60_000);
    const endDate = new Date(windowStartMs + endMin * 60_000);
    setDrag(null);
    setPending({
      date: dateField(startDate),
      start: timeField(startDate),
      end: timeField(endDate),
    });
  };

  const previewTop = drag ? (drag.startMin / totalMinutes) * height : 0;
  const previewHeight = drag
    ? ((drag.endMin - drag.startMin) / totalMinutes) * height
    : 0;

  return (
    <>
      <div
        ref={laneRef}
        // flex-col so the empty-state child can grow (flex-1) and centre itself
        // within the lane's fixed height. overflow-hidden clips the absolutely
        // positioned blocks to the rounded bounds. The grid/blocks are absolute,
        // so they're out of flow and unaffected by the flex layout.
        className="relative flex flex-col overflow-hidden rounded"
        style={{
          height,
          background: "var(--bg-tint)",
          touchAction: enableCreate ? "none" : undefined,
          cursor: enableCreate ? "crosshair" : undefined,
          userSelect: enableCreate ? "none" : undefined,
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={() => setDrag(null)}
      >
        {hourMarks.map((mark) => (
          <div
            key={mark.hour}
            className="absolute inset-x-0"
            style={{
              top: `${mark.topPct}%`,
              borderTop: "1px solid var(--border-faint)",
            }}
            aria-hidden
          />
        ))}

        {/* Rhythm context: soft, striped, non-interactive backdrop. */}
        {context.map((block) => (
          <div
            key={block.id}
            className="absolute left-0 right-0 flex items-start justify-end overflow-hidden rounded-sm px-1.5 py-0.5"
            style={{
              top: `${block.topPct}%`,
              height: `${block.heightPct}%`,
              background: `repeating-linear-gradient(45deg, ${block.color}1f, ${block.color}1f 6px, ${block.color}0f 6px, ${block.color}0f 12px)`,
              borderLeft: `2px solid ${block.color}66`,
              pointerEvents: "none",
            }}
            aria-hidden
          >
            <span
              className="text-[0.5625rem] font-semibold uppercase tracking-wider"
              style={{ color: block.color }}
            >
              {block.title}
            </span>
          </div>
        ))}

        <TimelineNowLine
          windowStartIso={windowStartIso}
          windowEndIso={windowEndIso}
        />

        {/* Drag-to-create preview. */}
        {drag ? (
          <div
            className="pointer-events-none absolute inset-x-0.5 z-20 flex items-start justify-center rounded-sm"
            style={{
              top: previewTop,
              height: Math.max(previewHeight, 2),
              background: "color-mix(in srgb, var(--accent) 24%, transparent)",
              border: "1px solid var(--accent)",
            }}
            aria-hidden
          >
            {previewHeight > 16 ? (
              <span
                className="mt-0.5 text-[0.5625rem] font-semibold tabular"
                style={{ color: "var(--accent-strong)" }}
              >
                {rangeLabel(
                  new Date(windowStartMs + drag.startMin * 60_000),
                  new Date(windowStartMs + drag.endMin * 60_000),
                )}
              </span>
            ) : null}
          </div>
        ) : null}

        {blocks.map((block) => {
          const blockPx = (block.heightPct / 100) * height;
          const payload = payloads[block.id];
          if (!payload) return null;
          return (
            <TimelineBlockButton
              key={block.id}
              block={block}
              variant={variant}
              heightPx={blockPx}
              narrow={narrow}
              payload={payload}
              tasks={tasks}
            />
          );
        })}

        {blocks.length === 0 && !drag ? (
          // Grow to fill the lane and centre the hint statically within it.
          // flex-1 makes this the only flow child that expands to the lane's
          // full height; items/justify-center park the text in the middle. It
          // scrolls naturally with the page rather than tracking the viewport.
          // pointer-events stay off so taps fall through to the lane
          // (drag-to-create) beneath.
          <div className="pointer-events-none flex flex-1 items-center justify-center px-2">
            <p
              className="text-center text-[0.6875rem]"
              style={{ color: "var(--text-faint)" }}
            >
              {variant === "planned"
                ? "Nothing planned"
                : enableCreate
                  ? "Drag to log time"
                  : "Nothing tracked yet"}
            </p>
          </div>
        ) : null}
      </div>

      {pending ? (
        <EntryModal
          title="Log time"
          entry={null}
          defaults={pending}
          tasks={tasks}
          onClose={() => setPending(null)}
        />
      ) : null}
    </>
  );
}
