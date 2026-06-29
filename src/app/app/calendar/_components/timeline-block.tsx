"use client";

// Interactive timeline block. Tapping a tracked entry opens the shared
// entry edit modal; tapping a planned block opens a compact edit sheet
// (title/time, mark done, delete); tapping the running block jumps to the
// time page where the live session controls are.

import {
  type MouseEvent as ReactMouseEvent,
  useEffect,
  useRef,
  useState,
  useTransition,
} from "react";
import { createPortal } from "react-dom";
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
  createCalendarBlockAction,
  deleteCalendarItemAction,
  updateCalendarBlockAction,
} from "../actions";
import { CategoryPicker, type PickableCategory } from "./category-picker";
import type { TimelineBlock } from "../_lib/timeline";

export type TimelineItemPayload = {
  id: string;
  title: string;
  dateValue: string;
  startValue: string;
  endValue: string;
  status: string;
  /** Assigned TimeCategory id (raw-SQL column), or null. */
  categoryId: string | null;
};

export type TimelineBlockPayload =
  | { type: "entry"; entry: EditableEntry }
  | { type: "running" }
  | { type: "item"; item: TimelineItemPayload };

export function TimelineBlockButton({
  block,
  variant,
  heightPx,
  narrow,
  payload,
  tasks,
  categories = [],
}: {
  block: TimelineBlock;
  variant: "planned" | "actual";
  /** Rendered pixel height — drives how much detail the block can show. */
  heightPx: number;
  /** Narrow column: thin colour strip + single line, full detail on hover. */
  narrow: boolean;
  payload: TimelineBlockPayload;
  tasks: LinkableTask[];
  /** TimeCategory options for the planned-block edit sheet's picker. */
  categories?: PickableCategory[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  // Hover popover (narrow columns only). Captured in viewport coords and
  // portalled to <body> so the lane's overflow-clip can't trap it.
  const [pop, setPop] = useState<{
    left: number;
    top: number;
    flip: boolean;
  } | null>(null);

  // Detail tiers for full (1D) blocks: tiny (label only) under ~30px, time on a
  // second line under ~62px, category chip once there's real room.
  const showTime = !narrow && heightPx >= 30;
  const showCategory = !narrow && heightPx >= 62;
  // Below ~18px the 11px title line can't render without being clipped to an
  // unreadable sliver, so hide it entirely and leave just the colour strip
  // (hover/tap still surfaces the detail). Narrow columns are a designed
  // single-line strip affordance, so they always keep their label.
  const showTitle = narrow || heightPx >= 18;

  const category = payload.type === "entry" ? payload.entry.category : null;
  const notes = payload.type === "entry" ? payload.entry.notes : null;

  const onEnter = (event: ReactMouseEvent<HTMLButtonElement>) => {
    if (!narrow) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const CARD_W = 240;
    let left = rect.left;
    if (left + CARD_W > window.innerWidth - 8) {
      left = window.innerWidth - 8 - CARD_W;
    }
    left = Math.max(8, left);
    // Flip above the block when there isn't comfortable room below.
    const flip = rect.bottom + 160 > window.innerHeight;
    setPop({ left, top: flip ? rect.top : rect.bottom, flip });
  };

  return (
    <>
      <button
        type="button"
        // Keep block taps from starting a drag-create on the lane underneath.
        onPointerDown={(event) => event.stopPropagation()}
        onMouseEnter={onEnter}
        onMouseLeave={() => setPop(null)}
        onClick={(event) => {
          event.stopPropagation();
          setPop(null);
          if (payload.type === "running") {
            router.push("/app/time");
            return;
          }
          setOpen(true);
        }}
        className={`absolute overflow-hidden rounded text-left min-h-[15px] [@media(pointer:coarse)]:min-h-[2.75rem] ${
          narrow ? "px-1 py-0.5" : "px-1.5 py-0.5"
        }`}
        style={{
          top: `${block.topPct}%`,
          height: `${block.heightPct}%`,
          left: `calc(${block.leftPct}% + 4px)`,
          width: `calc(${block.widthPct}% - 8px)`,
          background:
            narrow || variant === "planned"
              ? "var(--bg-page)"
              : `color-mix(in srgb, ${block.color} 22%, var(--bg-page))`,
          border:
            !narrow && variant === "planned"
              ? "1px solid var(--border-soft)"
              : undefined,
          borderLeftWidth: narrow ? "6px" : "3px",
          borderLeftStyle: "solid",
          borderLeftColor: block.color,
          opacity: block.muted ? 0.55 : 1,
        }}
        title={`${block.title} · ${block.detail}`}
      >
        {showTitle ? (
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
        ) : null}
        {showTime ? (
          <p
            className="truncate text-[0.625rem] leading-tight"
            style={{ color: "var(--text-faint)" }}
          >
            {block.detail}
          </p>
        ) : null}
        {showCategory && category ? (
          <span
            className="mt-1 inline-flex max-w-full items-center gap-1 truncate rounded-sm px-1 py-0.5 text-[0.5625rem] font-semibold uppercase tracking-wide"
            style={{
              background: `color-mix(in srgb, ${block.color} 16%, transparent)`,
              color: "var(--text-muted)",
            }}
          >
            {category}
          </span>
        ) : null}
      </button>

      {pop && typeof document !== "undefined"
        ? createPortal(
            <div
              className="pointer-events-none fixed z-50 rounded-md border p-2.5 shadow-lg"
              style={{
                left: pop.left,
                top: pop.top,
                width: 240,
                transform: pop.flip
                  ? "translateY(calc(-100% - 6px))"
                  : "translateY(6px)",
                background: "var(--bg-page)",
                borderColor: "var(--border-soft)",
              }}
              role="tooltip"
            >
              <p
                className="text-[0.8125rem] font-semibold leading-snug"
                style={{ color: "var(--text)" }}
              >
                {block.title}
              </p>
              <p
                className="mt-0.5 text-[0.6875rem] tabular"
                style={{ color: "var(--text-muted)" }}
              >
                {block.detail}
              </p>
              <p
                className="mt-1 flex items-center gap-1.5 text-[0.6875rem]"
                style={{ color: "var(--text-faint)" }}
              >
                <span
                  className="inline-block h-2 w-2 shrink-0 rounded-full"
                  style={{ background: block.color }}
                  aria-hidden
                />
                {category ?? (variant === "planned" ? "Planned" : "Tracked")}
              </p>
              {notes ? (
                <p
                  className="mt-1.5 line-clamp-3 text-[0.6875rem] leading-snug"
                  style={{ color: "var(--text-muted)" }}
                >
                  {notes}
                </p>
              ) : null}
            </div>,
            document.body,
          )
        : null}

      {open && payload.type === "entry" ? (
        <EntryModal
          title={`Edit ${payload.entry.label}`}
          entry={payload.entry}
          tasks={tasks}
          onClose={() => setOpen(false)}
        />
      ) : null}

      {open && payload.type === "item" ? (
        <CalendarBlockModal
          mode="edit"
          item={payload.item}
          categories={categories}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </>
  );
}

/** Prefill for a new block dragged out on the timeline grid. */
export type BlockDefaults = { date: string; start: string; end: string };

/**
 * Shared create/edit sheet for a planned calendar block. Editing surfaces the
 * Delete / Done controls and submits `updateCalendarBlockAction`; creating (the
 * drag-to-create flow) prefills the dragged window and submits
 * `createCalendarBlockAction`. Both expose the same category picker.
 */
export function CalendarBlockModal({
  mode,
  item,
  defaults,
  categories = [],
  onClose,
}: {
  mode: "create" | "edit";
  /** Required for edit mode. */
  item?: TimelineItemPayload;
  /** Required for create mode — the dragged-out window. */
  defaults?: BlockDefaults;
  categories?: PickableCategory[];
  onClose: () => void;
}) {
  useBodyScrollLock();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [deleteArmed, setDeleteArmed] = useState(false);
  const [categoryId, setCategoryId] = useState(item?.categoryId ?? "");
  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!deleteArmed) return;
    const timer = window.setTimeout(() => setDeleteArmed(false), 3000);
    return () => window.clearTimeout(timer);
  }, [deleteArmed]);

  // Dragging out a window prefills the times — drop the cursor on the title so
  // the block can be named and saved without reaching for the mouse.
  useEffect(() => {
    if (mode === "create") titleRef.current?.focus();
  }, [mode]);

  const run = (action: (formData: FormData) => Promise<unknown>) => {
    if (!item) return;
    startTransition(async () => {
      const formData = new FormData();
      formData.set("id", item.id);
      await action(formData);
      router.refresh();
      onClose();
    });
  };

  const fieldKey = item?.id ?? "new";
  const headingId = `timeline-item-title-${fieldKey}`;

  return createPortal(
    <div className="calendar-modal-backdrop" role="presentation" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
        className="calendar-modal"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p
              className="text-[0.6875rem] font-semibold uppercase tracking-wider"
              style={{ color: "var(--text-faint)" }}
            >
              {mode === "create" ? "New block" : "Planned block"}
            </p>
            <h2
              id={headingId}
              className="mt-1 text-[1.125rem] font-semibold tracking-tight"
              style={{ color: "var(--text)" }}
            >
              {mode === "create" ? "Plan a block" : item?.title}
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
            if (mode === "create") {
              await createCalendarBlockAction(formData);
            } else {
              await updateCalendarBlockAction(formData);
            }
            router.refresh();
            onClose();
          }}
          className="mt-5 space-y-4"
          onSubmit={(event) => {
            fillIsoWindowFields(event.currentTarget);
          }}
        >
          {item ? <input type="hidden" name="id" value={item.id} /> : null}
          <input type="hidden" name="categoryId" value={categoryId} />
          <input type="hidden" name="startsAtIso" defaultValue="" />
          <input type="hidden" name="endsAtIso" defaultValue="" />

          <div className="space-y-1.5">
            <label
              className="block text-[0.75rem] font-medium"
              style={{ color: "var(--text-muted)" }}
              htmlFor={`timeline-item-name-${fieldKey}`}
            >
              Title
            </label>
            <input
              ref={titleRef}
              id={`timeline-item-name-${fieldKey}`}
              name="title"
              required
              placeholder={mode === "create" ? "Deep work, workout, errands..." : undefined}
              defaultValue={item?.title ?? ""}
              className="field"
            />
          </div>

          <CategoryPicker
            categories={categories}
            value={categoryId}
            onChange={setCategoryId}
          />

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div className="col-span-2 space-y-1.5 sm:col-span-1">
              <label
                className="block text-[0.75rem] font-medium"
                style={{ color: "var(--text-muted)" }}
                htmlFor={`timeline-item-date-${fieldKey}`}
              >
                Date
              </label>
              <input
                id={`timeline-item-date-${fieldKey}`}
                name="date"
                type="date"
                required
                defaultValue={item?.dateValue ?? defaults?.date}
                className="field"
              />
            </div>
            <div className="space-y-1.5">
              <label
                className="block text-[0.75rem] font-medium"
                style={{ color: "var(--text-muted)" }}
                htmlFor={`timeline-item-start-${fieldKey}`}
              >
                Start
              </label>
              <input
                id={`timeline-item-start-${fieldKey}`}
                name="start"
                type="time"
                required
                defaultValue={item?.startValue ?? defaults?.start}
                className="field"
              />
            </div>
            <div className="space-y-1.5">
              <label
                className="block text-[0.75rem] font-medium"
                style={{ color: "var(--text-muted)" }}
                htmlFor={`timeline-item-end-${fieldKey}`}
              >
                End
              </label>
              <input
                id={`timeline-item-end-${fieldKey}`}
                name="end"
                type="time"
                required
                defaultValue={item?.endValue ?? defaults?.end}
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
              {mode === "edit" && item ? (
                <>
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
                </>
              ) : (
                <button
                  type="button"
                  disabled={pending}
                  onClick={onClose}
                  className="btn-ghost"
                >
                  Cancel
                </button>
              )}
            </div>
            <button type="submit" disabled={pending} className="btn-ink">
              {pending ? "Saving..." : mode === "create" ? "Add block" : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}
