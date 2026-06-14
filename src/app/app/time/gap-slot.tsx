"use client";

// Inline gap slots: untracked stretches rendered between time-entry rows so the
// whole day reads as a continuous sequence of tracked time + holes. Tapping a
// slot opens a focused quick-fill sheet with two honest paths:
//   1. Log it   — one activity covered the whole gap.
//   2. Split it — break the gap into several entries, one chunk at a time.
// Unlike the live "most recent gap" card, there's no "I'm still doing it" —
// these are historical gaps, already closed by a later entry.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import { backfillEntry, backfillSegment } from "./actions";
import type { QuickStartCategory } from "./quick-start-chips";
import { useBodyScrollLock } from "../_components/use-body-scroll-lock";

function formatDuration(minutes: number) {
  const safe = Math.max(0, Math.round(minutes));
  const h = Math.floor(safe / 60);
  const m = safe % 60;
  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h`;
  return `${m}m`;
}

function fmtTime(date: Date) {
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function sameCalendarDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

// Range label for a gap. Same-day stays compact ("9:00 AM – 11:15 AM"); a gap
// that straddles midnight spells out the dates so the overnight context is
// obvious ("Jun 13 11:00 PM – Jun 14 7:30 AM").
function formatGapRange(start: Date, end: Date) {
  if (sameCalendarDay(start, end)) {
    return `${fmtTime(start)} – ${fmtTime(end)}`;
  }
  const fmtDate = (date: Date) =>
    date.toLocaleDateString([], { month: "short", day: "numeric" });
  return `${fmtDate(start)} ${fmtTime(start)} – ${fmtDate(end)} ${fmtTime(end)}`;
}

// "HH:mm" in the browser's timezone — keeps wall-clock math in the browser,
// matching the entry editor's convention.
function hhmm(date: Date) {
  return date.toLocaleTimeString("en-CA", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export function GapSlotRow({
  gapStartIso,
  gapEndIso,
  gapMinutes,
  categories,
}: {
  gapStartIso: string;
  gapEndIso: string;
  gapMinutes: number;
  categories: QuickStartCategory[];
}) {
  const [open, setOpen] = useState(false);

  const gapStart = new Date(gapStartIso);
  const gapEnd = new Date(gapEndIso);
  const durationLabel = formatDuration(gapMinutes);
  const rangeLabel = formatGapRange(gapStart, gapEnd);

  return (
    <li className="list-none">
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="group/gap flex min-h-[44px] w-full items-center gap-3 rounded-md px-3 py-2.5 text-left transition-colors hover:bg-bg-hover"
        style={{ border: "1px dashed var(--border-soft)" }}
        aria-label={`Fill ${durationLabel} of untracked time, ${rangeLabel}`}
      >
        <span
          className="h-1.5 w-1.5 shrink-0 rounded-full"
          style={{ background: "var(--text-faint)", opacity: 0.6 }}
          aria-hidden
        />
        <span className="min-w-0 flex-1">
          <span
            className="block text-[0.8125rem] font-medium tracking-tight"
            style={{ color: "var(--text-muted)" }}
          >
            {durationLabel} untracked
          </span>
          <span
            className="mt-0.5 block text-[0.6875rem]"
            style={{ color: "var(--text-faint)" }}
          >
            {rangeLabel}
          </span>
        </span>
        <span
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full transition-colors group-hover/gap:text-text"
          style={{
            border: "1px dashed var(--border-soft)",
            color: "var(--text-faint)",
          }}
          aria-hidden
        >
          <IconPlus />
        </span>
      </button>

      {open ? (
        <GapFillModal
          gapStartIso={gapStartIso}
          gapEndIso={gapEndIso}
          durationLabel={durationLabel}
          rangeLabel={rangeLabel}
          categories={categories}
          // The modal calls router.refresh() itself when anything was saved;
          // here we only need to close.
          onClose={() => setOpen(false)}
        />
      ) : null}
    </li>
  );
}

function GapFillModal({
  gapStartIso,
  gapEndIso,
  durationLabel,
  rangeLabel,
  categories,
  onClose,
}: {
  gapStartIso: string;
  gapEndIso: string;
  durationLabel: string;
  rangeLabel: string;
  categories: QuickStartCategory[];
  onClose: (refresh: boolean) => void;
}) {
  const router = useRouter();
  const [view, setView] = useState<"fill" | "split">("fill");
  useBodyScrollLock();

  const close = (refresh: boolean) => {
    if (refresh) router.refresh();
    onClose(refresh);
  };

  return createPortal(
    <div className="calendar-modal-backdrop" role="presentation" onClick={() => close(false)}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="gap-slot-title"
        className="calendar-modal"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p
              className="text-[0.6875rem] font-semibold uppercase tracking-wider"
              style={{ color: "var(--text-faint)" }}
            >
              Untracked time
            </p>
            <h2
              id="gap-slot-title"
              className="mt-1 text-[1.125rem] font-semibold tracking-tight"
              style={{ color: "var(--text)" }}
            >
              {durationLabel} · {rangeLabel}
            </h2>
          </div>
          <button
            type="button"
            className="btn-icon h-8 w-8 rounded-full border"
            style={{ borderColor: "var(--border-faint)" }}
            onClick={() => close(false)}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {view === "fill" ? (
          <FillView
            gapStartIso={gapStartIso}
            gapEndIso={gapEndIso}
            categories={categories}
            onSplit={() => setView("split")}
            onClose={close}
          />
        ) : (
          <SplitView
            gapStartIso={gapStartIso}
            gapEndIso={gapEndIso}
            categories={categories}
            onClose={close}
          />
        )}
      </div>
    </div>,
    document.body,
  );
}

// ── Shared bits ────────────────────────────────────────────────────────────

function CategoryChips({
  categories,
  selected,
  onSelect,
}: {
  categories: QuickStartCategory[];
  selected: string;
  onSelect: (category: QuickStartCategory) => void;
}) {
  return (
    <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 sm:flex-wrap sm:overflow-visible">
      {categories.map((category) => {
        const active = selected === category.id;
        return (
          <button
            key={category.id}
            type="button"
            onClick={() => onSelect(category)}
            className="inline-flex shrink-0 items-center gap-1.5 rounded px-2 py-1.5 text-[0.75rem] font-medium transition-colors"
            style={{
              background: active ? "var(--bg-tint-strong)" : "var(--bg-tint)",
              color: active ? "var(--text)" : "var(--text-muted)",
              boxShadow: active ? `inset 0 0 0 1px ${category.color}` : undefined,
            }}
          >
            <span
              className="h-1.5 w-1.5 rounded-full"
              style={{ background: category.color }}
              aria-hidden
            />
            {category.label}
          </button>
        );
      })}
    </div>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label
      className="block text-[0.75rem] font-medium"
      style={{ color: "var(--text-muted)" }}
    >
      {children}
    </label>
  );
}

function ErrorNote({ message }: { message: string }) {
  return (
    <p
      className="rounded-md px-3 py-2 text-[0.8125rem]"
      style={{
        background: "var(--accent-tint)",
        color: "var(--accent-strong)",
        border: "1px solid var(--accent-tint-strong)",
      }}
    >
      {message}
    </p>
  );
}

// ── "Log it" — one entry for the whole gap ──────────────────────────────────

function FillView({
  gapStartIso,
  gapEndIso,
  categories,
  onSplit,
  onClose,
}: {
  gapStartIso: string;
  gapEndIso: string;
  categories: QuickStartCategory[];
  onSplit: () => void;
  onClose: (refresh: boolean) => void;
}) {
  const [pending, startTransition] = useTransition();
  const [label, setLabel] = useState("");
  const [category, setCategory] = useState("");
  const [error, setError] = useState<string | null>(null);

  const pickCategory = (picked: QuickStartCategory) => {
    setCategory((current) => (current === picked.id ? "" : picked.id));
    setLabel((current) => (current.trim() ? current : picked.label));
  };

  const submit = () => {
    if (pending) return;
    const trimmed = label.trim();
    if (!trimmed) {
      setError("Add a label so you know what it was.");
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        const formData = new FormData();
        formData.set("label", trimmed);
        if (category) formData.set("category", category);
        formData.set("startedAt", gapStartIso);
        formData.set("endedAt", gapEndIso);
        await backfillEntry(formData);
        onClose(true);
      } catch (caught) {
        setError(
          caught instanceof Error ? caught.message : "Could not save entry.",
        );
      }
    });
  };

  return (
    <div className="mt-4 space-y-4">
      <div className="space-y-1.5">
        <FieldLabel>What were you doing?</FieldLabel>
        <input
          type="text"
          value={label}
          onChange={(event) => setLabel(event.target.value)}
          placeholder="e.g. Lunch, deep work, errands..."
          className="field"
          autoFocus
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              submit();
            }
          }}
        />
      </div>

      <div className="space-y-1.5">
        <FieldLabel>Category (optional)</FieldLabel>
        <CategoryChips
          categories={categories}
          selected={category}
          onSelect={pickCategory}
        />
      </div>

      {error ? <ErrorNote message={error} /> : null}

      <div
        className="sticky bottom-0 -mx-4 mt-2 flex items-center justify-between gap-3 border-t px-4 pb-1 pt-3 sm:-mx-5 sm:px-5"
        style={{
          background: "var(--bg-page)",
          borderColor: "var(--border-faint)",
        }}
      >
        <button
          type="button"
          className="btn-ghost"
          disabled={pending}
          onClick={onSplit}
        >
          Split it
        </button>
        <button
          type="button"
          className="btn-ink flex-1 sm:flex-none"
          disabled={pending}
          onClick={submit}
        >
          {pending ? "Saving..." : "Log it"}
        </button>
      </div>
    </div>
  );
}

// ── "Split it" — fill the gap one chunk at a time ───────────────────────────

function SplitView({
  gapStartIso,
  gapEndIso,
  categories,
  onClose,
}: {
  gapStartIso: string;
  gapEndIso: string;
  categories: QuickStartCategory[];
  onClose: (refresh: boolean) => void;
}) {
  const gapStart = new Date(gapStartIso);
  const gapEnd = new Date(gapEndIso);

  const [pending, startTransition] = useTransition();
  // The cursor walks forward through the gap as each chunk is logged. Local
  // state so the (non-revalidating) segment writes never reset our place.
  const [cursorIso, setCursorIso] = useState(gapStartIso);
  const [label, setLabel] = useState("");
  const [category, setCategory] = useState("");
  const [endValue, setEndValue] = useState(hhmm(gapEnd));
  const [error, setError] = useState<string | null>(null);
  const [savedCount, setSavedCount] = useState(0);

  const cursor = new Date(cursorIso);
  const totalMs = gapEnd.getTime() - gapStart.getTime();
  const filledMs = Math.min(totalMs, cursor.getTime() - gapStart.getTime());
  const remainingMs = Math.max(0, gapEnd.getTime() - cursor.getTime());
  const remainingMinutes = Math.round(remainingMs / 60000);
  const pct = totalMs > 0 ? Math.min(100, (filledMs / totalMs) * 100) : 100;
  const allFilled = remainingMinutes < 1;

  const pickCategory = (picked: QuickStartCategory) => {
    setCategory((current) => (current === picked.id ? "" : picked.id));
    setLabel((current) => (current.trim() ? current : picked.label));
  };

  // Resolve the "HH:mm" end field to an absolute Date after the cursor,
  // clamped to the end of the gap.
  const resolveEnd = (): Date | null => {
    const [h, m] = endValue.split(":").map(Number);
    if (h === undefined || m === undefined || !Number.isFinite(h) || !Number.isFinite(m)) return null;
    const end = new Date(cursor);
    end.setHours(h, m, 0, 0);
    if (end.getTime() <= cursor.getTime()) end.setDate(end.getDate() + 1);
    if (end.getTime() > gapEnd.getTime()) return new Date(gapEnd);
    return end;
  };

  const setDurationFromNow = (minutes: number) => {
    const candidate = new Date(cursor.getTime() + minutes * 60000);
    const capped = candidate > gapEnd ? gapEnd : candidate;
    setEndValue(hhmm(capped));
  };

  const durationPresets = [15, 30, 60, 120].filter(
    (mins) => cursor.getTime() + mins * 60000 < gapEnd.getTime(),
  );

  const addSegment = () => {
    if (pending) return;
    const trimmed = label.trim();
    if (!trimmed) {
      setError("Add a label for this chunk.");
      return;
    }
    const end = resolveEnd();
    if (!end || end.getTime() <= cursor.getTime()) {
      setError("End time must be after the start.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const formData = new FormData();
      formData.set("label", trimmed);
      if (category) formData.set("category", category);
      formData.set("startedAt", cursor.toISOString());
      formData.set("endedAt", end.toISOString());
      const result = await backfillSegment(formData);
      if (!result.ok) {
        setError(result.error ?? "Could not save entry.");
        return;
      }
      setCursorIso(end.toISOString());
      setSavedCount((count) => count + 1);
      setLabel("");
      setCategory("");
      setEndValue(hhmm(gapEnd));
    });
  };

  return (
    <div className="mt-4 space-y-4">
      <div className="space-y-1.5">
        <div className="flex items-baseline justify-between gap-2">
          <p
            className="text-[0.8125rem] font-semibold tracking-tight"
            style={{ color: "var(--text)" }}
          >
            {allFilled
              ? "All time accounted for"
              : `${formatDuration(remainingMinutes)} still unaccounted for`}
          </p>
          <p className="text-[0.75rem]" style={{ color: "var(--text-faint)" }}>
            {savedCount > 0
              ? `${savedCount} ${savedCount === 1 ? "entry" : "entries"} added`
              : null}
          </p>
        </div>
        <div
          className="h-1.5 w-full overflow-hidden rounded-full"
          style={{ background: "var(--bg-tint-strong)" }}
        >
          <div
            className="h-full rounded-full transition-all"
            style={{ width: `${pct}%`, background: "var(--accent)" }}
          />
        </div>
      </div>

      {allFilled ? (
        <div
          className="rounded-md px-3 py-3 text-center"
          style={{ background: "var(--bg-tint)" }}
        >
          <p
            className="text-[0.875rem] font-semibold tracking-tight"
            style={{ color: "var(--text)" }}
          >
            The whole gap is filled.
          </p>
          <p className="mt-0.5 text-[0.75rem]" style={{ color: "var(--text-muted)" }}>
            Nice — every minute is accounted for.
          </p>
        </div>
      ) : (
        <>
          <div className="space-y-1.5">
            <FieldLabel>
              Next entry starts at {fmtTime(cursor)} — what was it?
            </FieldLabel>
            <input
              type="text"
              value={label}
              onChange={(event) => setLabel(event.target.value)}
              placeholder="e.g. Breakfast, shower, commute..."
              className="field"
              autoFocus
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  addSegment();
                }
              }}
            />
          </div>

          <div className="space-y-1.5">
            <FieldLabel>Category (optional)</FieldLabel>
            <CategoryChips
              categories={categories}
              selected={category}
              onSelect={pickCategory}
            />
          </div>

          <div className="space-y-1.5">
            <FieldLabel>Ends at</FieldLabel>
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="time"
                value={endValue}
                onChange={(event) => setEndValue(event.target.value)}
                className="field"
                style={{ maxWidth: "9rem" }}
              />
              {durationPresets.map((mins) => (
                <button
                  key={mins}
                  type="button"
                  onClick={() => setDurationFromNow(mins)}
                  className="rounded px-2 py-1.5 text-[0.75rem] font-medium transition-colors"
                  style={{ background: "var(--bg-tint)", color: "var(--text-muted)" }}
                >
                  +{formatDuration(mins)}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setEndValue(hhmm(gapEnd))}
                className="rounded px-2 py-1.5 text-[0.75rem] font-medium transition-colors"
                style={{ background: "var(--bg-tint)", color: "var(--text-muted)" }}
              >
                To end
              </button>
            </div>
          </div>
        </>
      )}

      {error ? <ErrorNote message={error} /> : null}

      <div
        className="sticky bottom-0 -mx-4 mt-2 flex items-center justify-between gap-3 border-t px-4 pb-1 pt-3 sm:-mx-5 sm:px-5"
        style={{
          background: "var(--bg-page)",
          borderColor: "var(--border-faint)",
        }}
      >
        <button
          type="button"
          className="btn-ghost"
          disabled={pending}
          onClick={() => onClose(savedCount > 0)}
        >
          {allFilled ? "Close" : "Done"}
        </button>
        {!allFilled ? (
          <button
            type="button"
            className="btn-ink flex-1 sm:flex-none"
            disabled={pending}
            onClick={addSegment}
          >
            {pending ? "Saving..." : "Add & continue"}
          </button>
        ) : null}
      </div>
    </div>
  );
}

// ── Icons ────────────────────────────────────────────────────────────────────

function IconPlus() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden>
      <path d="M7 3v8M3 7h8" />
    </svg>
  );
}
