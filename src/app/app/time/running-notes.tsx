"use client";

// Frictionless notes on the running session — jot context while the timer
// keeps ticking. Collapsed to a soft "Add a note…" affordance until tapped (or
// until there's already a note to show), then an auto-growing textarea that
// saves itself: 1s after you stop typing, and again on blur. No button, no
// spinner, no confirmation. Optimistic — the text you type is the source of
// truth; the save is fire-and-forget (see updateEntryNotes).

import { useEffect, useRef, useState } from "react";
import { MentionTextarea } from "@/components/mention-textarea";
import { updateEntryNotes } from "./actions";

export function RunningNotes({
  entryId,
  initialNotes,
}: {
  entryId: string;
  initialNotes: string | null;
}) {
  const seeded = (initialNotes ?? "").trim();
  const [notes, setNotes] = useState(initialNotes ?? "");
  const [expanded, setExpanded] = useState(seeded.length > 0);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSaved = useRef(initialNotes ?? "");
  // Mirrors the latest text so the unmount flush (which can't read fresh state
  // from its empty-deps closure) saves what's actually in the box.
  const latest = useRef(initialNotes ?? "");

  const resize = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  };

  // Fit the textarea to its content whenever it appears or the text changes.
  useEffect(() => {
    if (expanded) resize();
  }, [expanded, notes]);

  // Flush any pending edit if the card unmounts (e.g. timer stopped or the
  // user switched to a new session before the debounce fired or a blur landed).
  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
      if (latest.current !== lastSaved.current) {
        lastSaved.current = latest.current;
        void updateEntryNotes(entryId, latest.current);
      }
    };
  }, [entryId]);

  const save = (value: string) => {
    if (value === lastSaved.current) return;
    lastSaved.current = value;
    void updateEntryNotes(entryId, value);
  };

  const handleChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = event.target.value;
    setNotes(value);
    latest.current = value;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => save(value), 1000);
  };

  const handleBlur = () => {
    if (timer.current) clearTimeout(timer.current);
    save(notes);
    // Collapse back to the affordance only when nothing was written.
    if (!notes.trim()) setExpanded(false);
  };

  if (!expanded) {
    return (
      <button
        type="button"
        onClick={() => {
          setExpanded(true);
          requestAnimationFrame(() => textareaRef.current?.focus());
        }}
        className="mt-3 inline-flex items-center gap-1.5 text-[0.8125rem] transition-colors"
        style={{ color: "var(--text-faint)" }}
      >
        <span aria-hidden>📝</span>
        Add a note…
      </button>
    );
  }

  return (
    <div className="mt-3">
      <MentionTextarea
        ref={textareaRef}
        rows={1}
        value={notes}
        onChange={handleChange}
        onBlur={handleBlur}
        placeholder="Add a note…"
        aria-label="Notes for this session"
        className="field w-full resize-none overflow-hidden"
        style={{ minHeight: "2.5rem" }}
        helperText="Type @ to link a Rolodex person."
      />
    </div>
  );
}
