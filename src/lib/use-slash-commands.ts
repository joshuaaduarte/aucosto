"use client";

// Detects a "/" trigger in a textarea (à la MentionTextarea's "@" detection,
// but deliberately kept separate — see mention-textarea.tsx) and offers the
// registered top-level slash commands, filtered by whatever's typed after
// the slash. Purely derived from (value, cursor): no internal open/closed
// state, so callers that need explicit dismissal (e.g. a follow-up picker)
// should track that themselves rather than expecting this hook to do it.

import { useMemo } from "react";

export type SlashCommandId = "do" | "habit";

export type SlashCommand = {
  id: SlashCommandId;
  label: string;
  hint: string;
};

export const SLASH_COMMANDS: SlashCommand[] = [
  { id: "do", label: "/do", hint: "Create a task" },
  { id: "habit", label: "/habit", hint: "Log a habit" },
];

export type SlashMatch = { start: number; end: number; query: string };

/** Pure trigger detection — exported for unit testing. */
export function detectSlashTrigger(value: string, cursor: number): SlashMatch | null {
  const before = value.slice(0, cursor);
  // Don't trigger while inside an unclosed @[mention] bracket.
  if (/@\[[^\]\n]*$/.test(before)) return null;
  const match = /\/(\w*)$/.exec(before);
  if (!match) return null;
  return { start: match.index, end: cursor, query: (match[1] ?? "").toLowerCase() };
}

export function useSlashCommands(
  value: string,
  cursor: number,
  onReplace: (nextValue: string, nextCursor: number) => void,
) {
  const match = useMemo(() => detectSlashTrigger(value, cursor), [value, cursor]);

  const commands = useMemo(
    () => (match ? SLASH_COMMANDS.filter((cmd) => cmd.id.startsWith(match.query)) : []),
    [match],
  );

  function selectCommand(cmd: SlashCommand) {
    if (!match) return;
    const insert = `/${cmd.id} `;
    const nextValue = value.slice(0, match.start) + insert + value.slice(match.end);
    onReplace(nextValue, match.start + insert.length);
  }

  return {
    isOpen: commands.length > 0,
    query: match?.query ?? "",
    commands,
    selectCommand,
    replaceRange: match ? { start: match.start, end: match.end } : null,
  };
}
