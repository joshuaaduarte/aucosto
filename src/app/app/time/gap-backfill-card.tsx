"use client";

// Untracked-time recovery. When the tracker spots a gap ("2h 15m untracked ·
// 9:30 AM – 11:45 AM") it offers three honest paths instead of one guess:
//   1. Fill with one entry      — one activity covered the whole block.
//   2. Fill with multiple entries — split the block, one chunk at a time.
//   3. I'm still doing it        — log up to now AND keep a timer running.
// Each opens a focused bottom-sheet (centered dialog on desktop). Dismiss
// hides the card until the next gap.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import {
  backfillEntry,
  backfillSegment,
  backfillAndContinue,
} from "./actions";
import type { QuickStartCategory } from "./quick-start-chips";
import { useBodyScrollLock } from "../_components/use-body-scroll-lock";

type Mode = "one" | "multi" | "continue";

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

// "HH:mm" in the browser's timezone — matches the entry editor's convention so
// wall-clock math stays in the browser, never the (possibly mismatched) server.
function hhmm(date: Date) {
  return date.toLocaleTimeString("en-CA", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export function GapBackfillCard({
  gapStartIso,
  gapEndIso,
  gapMinutes,
  categories,
  sinceWakeup = false,
}: {
  gapStartIso: string;
  /** End of the gap — the page's "now" when it rendered. */
  gapEndIso: string;
  gapMinutes: number;
  categories: QuickStartCategory[];
  /** Gap is anchored at this morning's wake time, not the last entry. */
  sinceWakeup?: boolean;
}) {
  const router = useRouter();
  const [dismissed, setDismissed] = useState(false);
  const [mode, setMode] = useState<Mode | null>(null);

  if (dismissed) return null;

  const gapStart = new Date(gapStartIso);
  const gapEnd = new Date(gapEndIso);
  const durationLabel = formatDuration(gapMinutes);
  const rangeLabel = `${fmtTime(gapStart)} – ${fmtTime(gapEnd)}`;

  const close = (refresh: boolean) => {
    setMode(null);
    if (refresh) router.refresh();
  };

  const options: {
    mode: Mode;
    title: string;
    description: string;
    icon: React.ReactNode;
  }[] = [
    {
      mode: "one",
      title: "Fill with one entry",
      description: "One activity covered the whole block.",
      icon: <IconSingle />,
    },
    {
      mode: "multi",
      title: "Fill with multiple entries",
      description: "Split the block into separate activities.",
      icon: <IconSplit />,
    },
    {
      mode: "continue",
      title: "I'm still doing it",
      description: "Log up to now and keep the timer running.",
      icon: <IconPlay />,
    },
  ];

  return (
    <>
      <article
        className="rounded-md px-5 py-4"
        style={{
          background: "var(--bg-page)",
          border: "1px dashed var(--border-soft)",
        }}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p
              className="text-[0.6875rem] font-semibold uppercase tracking-wider"
              style={{ color: "var(--text-faint)" }}
            >
              {sinceWakeup ? "Since you woke up" : "Untracked time"}
            </p>
            <p
              className="mt-1 text-[1.0625rem] font-semibold tracking-tight"
              style={{ color: "var(--text)" }}
            >
              {durationLabel} untracked
            </p>
            <p
              className="mt-0.5 text-[0.8125rem]"
              style={{ color: "var(--text-muted)" }}
            >
              {rangeLabel}
            </p>
          </div>
          <button
            type="button"
            className="btn-icon h-7 w-7 shrink-0 rounded-full border text-[0.75rem]"
            style={{
              borderColor: "var(--border-faint)",
              color: "var(--text-faint)",
            }}
            onClick={() => setDismissed(true)}
            aria-label="Dismiss untracked time"
          >
            ×
          </button>
        </div>

        <div className="mt-4 grid gap-2">
          {options.map((option) => (
            <button
              key={option.mode}
              type="button"
              onClick={() => setMode(option.mode)}
              className="group flex items-center gap-3 rounded-lg border px-3.5 py-3 text-left transition-colors"
              style={{
                borderColor: "var(--border-faint)",
                background: "var(--bg-tint)",
              }}
            >
              <span
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
                style={{
                  background: "var(--bg-page)",
                  border: "1px solid var(--border-faint)",
                  color: "var(--text-muted)",
                }}
                aria-hidden
              >
                {option.icon}
              </span>
              <span className="min-w-0 flex-1">
                <span
                  className="block text-[0.875rem] font-semibold tracking-tight"
                  style={{ color: "var(--text)" }}
                >
                  {option.title}
                </span>
                <span
                  className="mt-0.5 block text-[0.75rem]"
                  style={{ color: "var(--text-muted)" }}
                >
                  {option.description}
                </span>
              </span>
              <span
                className="shrink-0 transition-transform group-hover:translate-x-0.5"
                style={{ color: "var(--text-faint)" }}
                aria-hidden
              >
                <IconChevron />
              </span>
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="mt-3 text-[0.75rem] font-medium underline-offset-2 hover:underline"
          style={{ color: "var(--text-faint)" }}
        >
          Skip — leave it untracked
        </button>
      </article>

      {mode === "one" || mode === "continue" ? (
        <SimpleFillModal
          mode={mode}
          gapStartIso={gapStartIso}
          gapEndIso={gapEndIso}
          durationLabel={durationLabel}
          rangeLabel={rangeLabel}
          categories={categories}
          onClose={close}
        />
      ) : null}

      {mode === "multi" ? (
        <MultiFillModal
          gapStartIso={gapStartIso}
          gapEndIso={gapEndIso}
          categories={categories}
          onClose={close}
        />
      ) : null}
    </>
  );
}

// ── Shared bits ───────────────────────────────────────────────────────────

function ModalShell({
  eyebrow,
  title,
  onClose,
  children,
}: {
  eyebrow: string;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  useBodyScrollLock();
  return createPortal(
    <div className="calendar-modal-backdrop" role="presentation" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="gap-fill-title"
        className="calendar-modal"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p
              className="text-[0.6875rem] font-semibold uppercase tracking-wider"
              style={{ color: "var(--text-faint)" }}
            >
              {eyebrow}
            </p>
            <h2
              id="gap-fill-title"
              className="mt-1 text-[1.125rem] font-semibold tracking-tight"
              style={{ color: "var(--text)" }}
            >
              {title}
            </h2>
          </div>
          <button
            type="button"
            className="btn-icon h-8 w-8 rounded-full border"
            style={{ borderColor: "var(--border-faint)" }}
            onClick={onClose}
            aria-label="Close"
          >
            ×
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  );
}

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

// ── Option 1 (one entry) + Option 3 (still doing it) ───────────────────────

function SimpleFillModal({
  mode,
  gapStartIso,
  gapEndIso,
  durationLabel,
  rangeLabel,
  categories,
  onClose,
}: {
  mode: "one" | "continue";
  gapStartIso: string;
  gapEndIso: string;
  durationLabel: string;
  rangeLabel: string;
  categories: QuickStartCategory[];
  onClose: (refresh: boolean) => void;
}) {
  const [pending, startTransition] = useTransition();
  const [label, setLabel] = useState("");
  const [category, setCategory] = useState("");
  const [error, setError] = useState<string | null>(null);

  const isContinue = mode === "continue";

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
        if (isContinue) {
          await backfillAndContinue(formData);
        } else {
          formData.set("endedAt", gapEndIso);
          await backfillEntry(formData);
        }
        onClose(true);
      } catch (caught) {
        setError(
          caught instanceof Error ? caught.message : "Could not save entry.",
        );
      }
    });
  };

  return (
    <ModalShell
      eyebrow={isContinue ? "Still going" : "Fill the gap"}
      title={isContinue ? "Log it and keep going" : "One entry for the block"}
      onClose={() => onClose(false)}
    >
      <div className="mt-4 space-y-4">
        <div
          className="rounded-md px-3 py-2.5"
          style={{ background: "var(--bg-tint)" }}
        >
          <p
            className="text-[0.8125rem] font-semibold tracking-tight"
            style={{ color: "var(--text)" }}
          >
            {isContinue ? (
              <>
                {durationLabel} so far · {rangeLabel.split(" – ")[0]} – now
              </>
            ) : (
              <>
                {durationLabel} · {rangeLabel}
              </>
            )}
          </p>
          <p
            className="mt-0.5 text-[0.75rem]"
            style={{ color: "var(--text-muted)" }}
          >
            {isContinue
              ? "We'll log this much, then start a fresh timer for the same thing."
              : "One entry will cover the whole block."}
          </p>
        </div>

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
            onClick={() => onClose(false)}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn-ink flex-1 sm:flex-none"
            disabled={pending}
            onClick={submit}
          >
            {pending
              ? "Saving..."
              : isContinue
                ? "Log & start timer"
                : "Save entry"}
          </button>
        </div>
      </div>
    </ModalShell>
  );
}

// ── Option 2 (multiple entries) ────────────────────────────────────────────

function MultiFillModal({
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
  // The cursor walks forward through the gap as each chunk is logged. It lives
  // in local state so the (intentionally non-revalidating) segment writes never
  // reset our place.
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
  // clamped to the end of the gap. An end at/before the cursor rolls to the
  // next day (a gap can straddle midnight).
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
      // Advance to where this chunk ended and reset the form for the next one.
      setCursorIso(end.toISOString());
      setSavedCount((count) => count + 1);
      setLabel("");
      setCategory("");
      setEndValue(hhmm(gapEnd));
    });
  };

  return (
    <ModalShell
      eyebrow="Fill the gap"
      title="Break it into entries"
      onClose={() => onClose(savedCount > 0)}
    >
      <div className="mt-4 space-y-4">
        {/* Progress through the gap */}
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
            <p
              className="text-[0.75rem]"
              style={{ color: "var(--text-faint)" }}
            >
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
            <p
              className="mt-0.5 text-[0.75rem]"
              style={{ color: "var(--text-muted)" }}
            >
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
                    style={{
                      background: "var(--bg-tint)",
                      color: "var(--text-muted)",
                    }}
                  >
                    +{formatDuration(mins)}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setEndValue(hhmm(gapEnd))}
                  className="rounded px-2 py-1.5 text-[0.75rem] font-medium transition-colors"
                  style={{
                    background: "var(--bg-tint)",
                    color: "var(--text-muted)",
                  }}
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
    </ModalShell>
  );
}

// ── Icons ───────────────────────────────────────────────────────────────────

function IconSingle() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" aria-hidden>
      <rect x="2.5" y="5.5" width="11" height="5" rx="1.2" />
    </svg>
  );
}

function IconSplit() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" aria-hidden>
      <rect x="2.5" y="5.5" width="4" height="5" rx="1" />
      <rect x="9.5" y="5.5" width="4" height="5" rx="1" />
    </svg>
  );
}

function IconPlay() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M5 3.5l7 4.5-7 4.5z" />
    </svg>
  );
}

function IconChevron() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M5 3l4 4-4 4" />
    </svg>
  );
}
