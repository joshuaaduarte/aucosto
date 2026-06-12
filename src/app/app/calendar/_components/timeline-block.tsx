"use client";

// Interactive timeline block. Tapping a tracked entry opens the shared
// entry edit modal; tapping a planned block opens a compact edit sheet
// (title/time, mark done, delete); tapping the running block jumps to the
// time page where the live session controls are.

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  EntryModal,
  type EditableEntry,
  type LinkableTask,
} from "../../time/entry-editor";
import { fillIsoWindowFields } from "@/lib/wall-clock";
import { useBodyScrollLock } from "../../_components/use-body-scroll-lock";
import {
  completeCalendarItemAction,
  deleteCalendarItemAction,
  updateCalendarBlockAction,
} from "../actions";
import type { TimelineBlock } from "../_lib/timeline";

export type TimelineItemPayload = {
  id: string;
  title: string;
  dateValue: string;
  startValue: string;
  endValue: string;
  status: string;
};

export type TimelineBlockPayload =
  | { type: "entry"; entry: EditableEntry }
  | { type: "running" }
  | { type: "item"; item: TimelineItemPayload };

export function TimelineBlockButton({
  block,
  variant,
  compact,
  payload,
  tasks,
}: {
  block: TimelineBlock;
  variant: "planned" | "actual";
  compact: boolean;
  payload: TimelineBlockPayload;
  tasks: LinkableTask[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => {
          if (payload.type === "running") {
            router.push("/app/time");
            return;
          }
          setOpen(true);
        }}
        className="absolute overflow-hidden rounded px-1.5 py-0.5 text-left"
        style={{
          top: `${block.topPct}%`,
          height: `${block.heightPct}%`,
          left: `calc(${block.leftPct}% + 4px)`,
          width: `calc(${block.widthPct}% - 8px)`,
          minHeight: "15px",
          background:
            variant === "actual"
              ? `color-mix(in srgb, ${block.color} 22%, var(--bg-page))`
              : "var(--bg-page)",
          border:
            variant === "planned" ? "1px solid var(--border-soft)" : undefined,
          borderLeftWidth: "3px",
          borderLeftStyle: "solid",
          borderLeftColor: block.color,
          opacity: block.muted ? 0.55 : 1,
        }}
        title={`${block.title} · ${block.detail}`}
      >
        <p
          className="truncate text-[0.6875rem] font-medium leading-tight"
          style={{ color: "var(--text)" }}
        >
          {block.running ? (
            <span
              className="ink-pulse mr-1 inline-block h-1.5 w-1.5 rounded-full align-middle"
              style={{ background: "var(--accent)" }}
              aria-hidden
            />
          ) : null}
          {block.title}
        </p>
        {!compact ? (
          <p
            className="truncate text-[0.625rem] leading-tight"
            style={{ color: "var(--text-faint)" }}
          >
            {block.detail}
          </p>
        ) : null}
      </button>

      {open && payload.type === "entry" ? (
        <EntryModal
          title={`Edit ${payload.entry.label}`}
          entry={payload.entry}
          tasks={tasks}
          onClose={() => setOpen(false)}
        />
      ) : null}

      {open && payload.type === "item" ? (
        <PlannedBlockModal
          item={payload.item}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </>
  );
}

function PlannedBlockModal({
  item,
  onClose,
}: {
  item: TimelineItemPayload;
  onClose: () => void;
}) {
  useBodyScrollLock();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [deleteArmed, setDeleteArmed] = useState(false);

  useEffect(() => {
    if (!deleteArmed) return;
    const timer = window.setTimeout(() => setDeleteArmed(false), 3000);
    return () => window.clearTimeout(timer);
  }, [deleteArmed]);

  const run = (action: (formData: FormData) => Promise<unknown>) => {
    startTransition(async () => {
      const formData = new FormData();
      formData.set("id", item.id);
      await action(formData);
      router.refresh();
      onClose();
    });
  };

  return (
    <div className="calendar-modal-backdrop" role="presentation" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={`timeline-item-title-${item.id}`}
        className="calendar-modal"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p
              className="text-[0.6875rem] font-semibold uppercase tracking-wider"
              style={{ color: "var(--text-faint)" }}
            >
              Planned block
            </p>
            <h2
              id={`timeline-item-title-${item.id}`}
              className="mt-1 text-[1.125rem] font-semibold tracking-tight"
              style={{ color: "var(--text)" }}
            >
              {item.title}
            </h2>
          </div>
          <button
            type="button"
            className="btn-icon h-8 w-8 rounded-full border"
            style={{ borderColor: "var(--border-faint)" }}
            onClick={onClose}
            aria-label="Close block editor"
          >
            x
          </button>
        </div>

        <form
          action={async (formData) => {
            await updateCalendarBlockAction(formData);
            router.refresh();
            onClose();
          }}
          className="mt-5 space-y-4"
          onSubmit={(event) => {
            fillIsoWindowFields(event.currentTarget);
          }}
        >
          <input type="hidden" name="id" value={item.id} />
          <input type="hidden" name="startsAtIso" defaultValue="" />
          <input type="hidden" name="endsAtIso" defaultValue="" />

          <div className="space-y-1.5">
            <label
              className="block text-[0.75rem] font-medium"
              style={{ color: "var(--text-muted)" }}
              htmlFor={`timeline-item-name-${item.id}`}
            >
              Title
            </label>
            <input
              id={`timeline-item-name-${item.id}`}
              name="title"
              required
              defaultValue={item.title}
              className="field"
            />
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div className="col-span-2 space-y-1.5 sm:col-span-1">
              <label
                className="block text-[0.75rem] font-medium"
                style={{ color: "var(--text-muted)" }}
                htmlFor={`timeline-item-date-${item.id}`}
              >
                Date
              </label>
              <input
                id={`timeline-item-date-${item.id}`}
                name="date"
                type="date"
                required
                defaultValue={item.dateValue}
                className="field"
              />
            </div>
            <div className="space-y-1.5">
              <label
                className="block text-[0.75rem] font-medium"
                style={{ color: "var(--text-muted)" }}
                htmlFor={`timeline-item-start-${item.id}`}
              >
                Start
              </label>
              <input
                id={`timeline-item-start-${item.id}`}
                name="start"
                type="time"
                required
                defaultValue={item.startValue}
                className="field"
              />
            </div>
            <div className="space-y-1.5">
              <label
                className="block text-[0.75rem] font-medium"
                style={{ color: "var(--text-muted)" }}
                htmlFor={`timeline-item-end-${item.id}`}
              >
                End
              </label>
              <input
                id={`timeline-item-end-${item.id}`}
                name="end"
                type="time"
                required
                defaultValue={item.endValue}
                className="field"
              />
            </div>
          </div>

          <div
            className="sticky bottom-0 -mx-4 mt-2 flex flex-wrap items-center justify-between gap-2 border-t px-4 pb-1 pt-3 sm:-mx-5 sm:px-5"
            style={{
              background: "var(--bg-page)",
              borderColor: "var(--border-faint)",
            }}
          >
            <div className="flex gap-2">
              <button
                type="button"
                disabled={pending}
                onClick={() => {
                  if (!deleteArmed) {
                    setDeleteArmed(true);
                    return;
                  }
                  run(deleteCalendarItemAction);
                }}
                className="btn-ghost"
                style={
                  deleteArmed
                    ? {
                        color: "var(--accent-strong)",
                        background: "var(--accent-tint)",
                      }
                    : undefined
                }
              >
                {deleteArmed ? "Sure?" : "Delete"}
              </button>
              {item.status !== "done" ? (
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => run(completeCalendarItemAction)}
                  className="btn-ghost"
                >
                  Done
                </button>
              ) : null}
            </div>
            <button type="submit" disabled={pending} className="btn-ink">
              {pending ? "Saving..." : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
