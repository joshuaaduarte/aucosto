// Assistant action executor — Shared result types.
// (Split out of the former single-file assistant-action-executor.ts.)

import "server-only";
import { type CalendarLinkSuggestion } from "@/lib/services/time-calendar";

// ── Types ─────────────────────────────────────────────────────────────────

export type AmbiguityCandidate = { id: string; name: string; [key: string]: string };

export interface PreviewResult {
  ok: boolean;
  error?: string;
  candidates?: AmbiguityCandidate[];
  previewText: string;
  normalizedInput: Record<string, unknown>;
  warnings: string[];
  /**
   * A calendar block the assistant may want to link this entry to. Suggested
   * only — the entry is never linked without an explicit calendarEventId /
   * calendarTitle confirmed by the assistant.
   */
  suggestedCalendarLink?: CalendarLinkSuggestion | null;
}

export interface ExecuteResult {
  ok: boolean;
  error?: string;
  recordId: string | null;
  recordType: string | null;
  summary: string;
  /**
   * Same as PreviewResult.suggestedCalendarLink: surfaced here too because
   * the execute path re-validates and the assistant still needs to decide.
   */
  suggestedCalendarLink?: CalendarLinkSuggestion | null;
  /**
   * For batch actions (e.g. log_time_entries): per-entry results in input
   * order. Entries that failed mid-batch carry `error` and a null recordId —
   * nothing is silently dropped.
   */
  entries?: LogTimeEntryBatchResult[];
}

/** Per-entry outcome for a batch time-entry write, in input order. */
export interface LogTimeEntryBatchResult {
  index: number;
  title: string;
  recordId: string | null;
  error?: string;
}

// ── Input schemas ─────────────────────────────────────────────────────────
