"use client";

// Frictionless notes on the running session — jot context while the timer
// keeps ticking. Collapsed to a soft "Add a note…" affordance until tapped (or
// until there's already a note to show), then an auto-growing textarea that
// saves itself: 1s after you stop typing, and again on blur. No button, no
// spinner, no confirmation. Optimistic — the text you type is the source of
// truth; the save is fire-and-forget (see updateEntryNotes).
//
// Also wires up slash commands (see use-slash-commands.ts): "/do <text>" +
// Enter creates a task and swaps the line for a "[[task: ...]]" placeholder;
// "/habit" opens a picker of the user's habits (fetched from
// /api/slash/habits) and logs a check-in on selection.

import { useEffect, useMemo, useRef, useState } from "react";
import { MentionTextarea } from "@/components/mention-textarea";
import { useBodyScrollLock } from "@/app/app/_components/use-body-scroll-lock";
import { createDoItemAction } from "@/app/app/do/actions";
import { quickLogHabitAction } from "@/app/app/habits/actions";
import { useSlashCommands, type SlashCommand } from "@/lib/use-slash-commands";
import { updateEntryNotes } from "./actions";

type SlashHabit = { id: string; name: string };

let cachedHabits: SlashHabit[] | null = null;
let pendingHabits: Promise<SlashHabit[]> | null = null;

async function loadHabits(): Promise<SlashHabit[]> {
  if (cachedHabits) return cachedHabits;
  if (!pendingHabits) {
    pendingHabits = fetch("/api/slash/habits", { credentials: "same-origin" })
      .then((res) => (res.ok ? res.json() : { habits: [] }))
      .then((data) => {
        cachedHabits = Array.isArray(data.habits) ? data.habits : [];
        return cachedHabits ?? [];
      })
      .catch(() => []);
  }
  return pendingHabits;
}

function currentLineStart(value: string, cursor: number) {
  return value.lastIndexOf("\n", Math.max(cursor - 1, 0)) + 1;
}

export function RunningNotes({
  entryId,
  initialNotes,
}: {
  entryId: string;
  initialNotes: string | null;
}) {
  const seeded = (initialNotes ?? "").trim();
  const [notes, setNotes] = useState(initialNotes ?? "");
  const [cursor, setCursor] = useState(0);
  const [expanded, setExpanded] = useState(seeded.length > 0);
  const [focused, setFocused] = useState(false);
  useBodyScrollLock(focused);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSaved = useRef(initialNotes ?? "");
  // Mirrors the latest text so the unmount flush (which can't read fresh state
  // from its empty-deps closure) saves what's actually in the box.
  const latest = useRef(initialNotes ?? "");

  const [slashIndex, setSlashIndex] = useState(0);
  const [habitPicker, setHabitPicker] = useState<{ start: number } | null>(null);
  const [habitList, setHabitList] = useState<SlashHabit[]>([]);
  const [habitLoading, setHabitLoading] = useState(false);
  const [habitIndex, setHabitIndex] = useState(0);

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

  // Splices text directly into the DOM node via the native value setter, then
  // dispatches "input" so React (and MentionTextarea's own @ tracking) sees
  // the change — same technique as MentionTextarea's own choose().
  function spliceTextarea(nextValue: string, nextCursor: number) {
    const el = textareaRef.current;
    if (!el) return;
    const nativeSetter = Object.getOwnPropertyDescriptor(
      window.HTMLTextAreaElement.prototype,
      "value",
    )?.set;
    nativeSetter?.call(el, nextValue);
    el.dispatchEvent(new Event("input", { bubbles: true }));
    setCursor(nextCursor);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(nextCursor, nextCursor);
    });
  }

  const slash = useSlashCommands(notes, cursor, spliceTextarea);

  useEffect(() => {
    setSlashIndex(0);
  }, [slash.query]);

  const habitQuery = useMemo(() => {
    if (!habitPicker) return "";
    const raw = notes.slice(habitPicker.start, Math.max(cursor, habitPicker.start));
    const match = /^\/habit\s*(.*)$/i.exec(raw);
    return match ? (match[1] ?? "").trim().toLowerCase() : "";
  }, [habitPicker, notes, cursor]);

  const filteredHabits = useMemo(() => {
    if (!habitPicker) return [];
    if (!habitQuery) return habitList.slice(0, 6);
    return habitList.filter((habit) => habit.name.toLowerCase().includes(habitQuery)).slice(0, 6);
  }, [habitPicker, habitList, habitQuery]);

  useEffect(() => {
    setHabitIndex(0);
  }, [habitQuery]);

  function openHabitPicker(start: number) {
    setHabitPicker({ start });
    setHabitIndex(0);
    setHabitLoading(true);
    void loadHabits().then((list) => {
      setHabitList(list);
      setHabitLoading(false);
    });
  }

  async function executeDoCommand(text: string, start: number, end: number) {
    const placeholder = `[[task: ${text}]]`;
    spliceTextarea(notes.slice(0, start) + placeholder + notes.slice(end), start + placeholder.length);
    const formData = new FormData();
    formData.set("title", text);
    try {
      await createDoItemAction(undefined, formData);
    } catch (error) {
      console.error("[running-notes] /do command failed", error);
    }
  }

  async function chooseHabit(habit: SlashHabit) {
    if (!habitPicker) return;
    const { start } = habitPicker;
    const end = Math.max(cursor, start);
    const placeholder = "[[habit logged]]";
    spliceTextarea(notes.slice(0, start) + placeholder + notes.slice(end), start + placeholder.length);
    setHabitPicker(null);
    const formData = new FormData();
    formData.set("id", habit.id);
    try {
      await quickLogHabitAction(formData);
    } catch (error) {
      console.error("[running-notes] /habit command failed", error);
    }
  }

  function handleSelectSlashCommand(cmd: SlashCommand) {
    const range = slash.replaceRange;
    slash.selectCommand(cmd);
    if (cmd.id === "habit" && range) {
      openHabitPicker(range.start);
    }
  }

  function handleTextareaKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (habitPicker) {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setHabitIndex((index) => Math.min(index + 1, Math.max(filteredHabits.length - 1, 0)));
        return;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        setHabitIndex((index) => Math.max(index - 1, 0));
        return;
      }
      if (event.key === "Enter") {
        event.preventDefault();
        const habit = filteredHabits[habitIndex];
        if (habit) void chooseHabit(habit);
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        setHabitPicker(null);
        return;
      }
      return;
    }

    if (slash.isOpen) {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setSlashIndex((index) => Math.min(index + 1, slash.commands.length - 1));
        return;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        setSlashIndex((index) => Math.max(index - 1, 0));
        return;
      }
      if (event.key === "Enter" || event.key === "Tab") {
        event.preventDefault();
        const cmd = slash.commands[slashIndex] ?? slash.commands[0];
        if (cmd) handleSelectSlashCommand(cmd);
        return;
      }
      return;
    }

    if (event.key === "Enter" && !event.shiftKey) {
      const lineStart = currentLineStart(notes, cursor);
      const lineSoFar = notes.slice(lineStart, cursor);
      const doMatch = /^\/do\s+(.+)$/i.exec(lineSoFar);
      if (doMatch) {
        event.preventDefault();
        void executeDoCommand(doMatch[1]!.trim(), lineStart, cursor);
        return;
      }
      const habitMatch = /^\/habit(?:\s+.*)?$/i.exec(lineSoFar);
      if (habitMatch) {
        event.preventDefault();
        openHabitPicker(lineStart);
      }
    }
  }

  const handleChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = event.target.value;
    setNotes(value);
    setCursor(event.target.selectionStart ?? value.length);
    latest.current = value;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => save(value), 1000);
  };

  const handleBlur = () => {
    setFocused(false);
    if (timer.current) clearTimeout(timer.current);
    save(notes);
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
        onKeyDown={handleTextareaKeyDown}
        onFocus={() => setFocused(true)}
        onBlur={handleBlur}
        placeholder="Add a note…"
        aria-label="Notes for this session"
        className="field w-full resize-none overflow-hidden"
        style={{ minHeight: "2.5rem", overscrollBehavior: "contain" }}
        helperText="Type @ to link a person · @insight to capture a takeaway · / for commands"
      />

      {habitPicker ? (
        <div
          role="listbox"
          className="mt-1 max-h-48 overflow-hidden overflow-y-auto rounded-md border shadow-lg"
          style={{ background: "var(--bg-page)", borderColor: "var(--border-soft)" }}
        >
          {habitLoading ? (
            <div className="px-3 py-2 text-[0.8125rem]" style={{ color: "var(--text-muted)" }}>
              Loading habits…
            </div>
          ) : filteredHabits.length > 0 ? (
            filteredHabits.map((habit, index) => (
              <button
                key={habit.id}
                type="button"
                role="option"
                aria-selected={index === habitIndex}
                onMouseDown={(event) => {
                  event.preventDefault();
                  void chooseHabit(habit);
                }}
                className="flex w-full items-center px-3 py-2 text-left text-[0.8125rem]"
                style={{
                  background: index === habitIndex ? "var(--bg-hover)" : "transparent",
                  color: "var(--text)",
                }}
              >
                {habit.name}
              </button>
            ))
          ) : (
            <div className="px-3 py-2 text-[0.8125rem]" style={{ color: "var(--text-muted)" }}>
              No habits match.
            </div>
          )}
        </div>
      ) : slash.isOpen ? (
        <div
          role="listbox"
          className="mt-1 overflow-hidden rounded-md border shadow-lg"
          style={{ background: "var(--bg-page)", borderColor: "var(--border-soft)" }}
        >
          {slash.commands.map((cmd, index) => (
            <button
              key={cmd.id}
              type="button"
              role="option"
              aria-selected={index === slashIndex}
              onMouseDown={(event) => {
                event.preventDefault();
                handleSelectSlashCommand(cmd);
              }}
              className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-[0.8125rem]"
              style={{
                background: index === slashIndex ? "var(--bg-hover)" : "transparent",
                color: "var(--text)",
              }}
            >
              <span className="font-medium">{cmd.label}</span>
              <span className="text-[0.75rem]" style={{ color: "var(--text-muted)" }}>
                {cmd.hint}
              </span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
