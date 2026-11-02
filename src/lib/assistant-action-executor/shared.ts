// Assistant action executor — Name resolvers, date helpers, and error/format helpers shared by the handlers.
// (Split out of the former single-file assistant-action-executor.ts.)

import "server-only";
import { z } from "zod";
import { listTimeCategories } from "@/lib/services/time-categories";
import { resolveCalendarBlockByTitle, type CalendarLinkSuggestion } from "@/lib/services/time-calendar";
import { listHabits } from "@/lib/services/habits";
import { getCalendarItem } from "@/lib/services/calendar";
import { listBoardProjects } from "@/lib/services/projects";
import { findPersonByName } from "@/lib/services/rolodex";
import { AmbiguityCandidate, ExecuteResult, PreviewResult } from "./types";

export type ResolveResult<T> =
  | { found: true; match: T }
  | { found: false; candidates: AmbiguityCandidate[]; suggestion?: string };
export type NameMatchKind = "exact" | "close" | "ambiguous" | "none";

export interface NameMatch<T> {
  kind: NameMatchKind;
  /** The single candidate for "exact" and "close"; null otherwise. */
  match: T | null;
  /** Close candidates: the one ("close") or the several ("ambiguous"). */
  candidates: T[];
}

/**
 * Classify a name against candidate items. `names` returns every name form an
 * item can be matched by (e.g. display name plus aliases); "exact" means some
 * form equals the query case-insensitively, "close" means exactly one item
 * has a form containing the query.
 */
export function classifyNameMatch<T>(
  items: T[],
  name: string,
  names: (item: T) => string[],
): NameMatch<T> {
  const lower = name.toLowerCase();
  const exact = items.filter((item) =>
    names(item).some((n) => n.toLowerCase() === lower),
  );
  if (exact.length === 1) return { kind: "exact", match: exact[0]!, candidates: [] };
  if (exact.length > 1) return { kind: "ambiguous", match: null, candidates: exact };
  const close = items.filter((item) =>
    names(item).some((n) => n.toLowerCase().includes(lower)),
  );
  if (close.length === 1) return { kind: "close", match: close[0]!, candidates: close };
  if (close.length > 1) return { kind: "ambiguous", match: null, candidates: close };
  return { kind: "none", match: null, candidates: [] };
}

/** Everything a caller needs: the classification plus the full item list. */
export interface ResolvedNames<T> {
  match: NameMatch<T>;
  all: T[];
}

export async function resolveProjectByName(
  userId: string,
  name: string,
): Promise<ResolveResult<{ id: string; name: string }>> {
  const projects = await listBoardProjects(userId);
  const lower = name.toLowerCase();

  const exact = projects.filter((p) => p.name.toLowerCase() === lower);
  if (exact.length === 1) return { found: true, match: exact[0]! };

  const partial = projects.filter((p) => p.name.toLowerCase().includes(lower));
  if (partial.length === 1) {
    // One close match: never pick it silently — hand back a suggestion so
    // the caller can ask rather than guess.
    const only = partial[0]!;
    return {
      found: false,
      candidates: [{ id: only.id, name: only.name }],
      suggestion: only.name,
    };
  }

  const pool = exact.length > 1 ? exact : partial;
  return {
    found: false,
    candidates: pool.map((p) => ({ id: p.id, name: p.name })),
  };
}

/**
 * Shared "project not found" message for project actions. Exact match wins;
 * a single close match becomes a "did you mean" suggestion; several matches
 * list candidates; zero matches point at the project list.
 */
export function projectResolutionError(
  name: string,
  candidates: AmbiguityCandidate[],
  suggestion: string | undefined,
  idHint: boolean,
): string {
  const retry = idHint
    ? " Retry with the exact project name, or pass projectId to pick one."
    : "";
  if (suggestion) {
    return `No exact project match for "${name}" — did you mean "${suggestion}"?${retry}`;
  }
  if (candidates.length > 0) {
    return `Ambiguous project match for "${name}" — ${candidates.length} projects match.${retry}`;
  }
  return `No project found matching "${name}". Use assistant_list_projects to see exact project names.`;
}

/**
 * Resolve a project by explicit id (wins when given) or by name. Used by
 * every project action so id formats and not-found behavior are identical.
 */
export async function resolveProjectRef(
  userId: string,
  ref: { projectName?: string; projectId?: string },
): Promise<
  | { ok: true; project: { id: string; name: string } }
  | { ok: false; error: string; candidates: AmbiguityCandidate[] }
> {
  if (ref.projectId) {
    const projects = await listBoardProjects(userId);
    const found = projects.find((p) => p.id === ref.projectId);
    if (!found) {
      return {
        ok: false,
        error: `Project id "${ref.projectId}" not found. Use assistant_list_projects to see valid project ids.`,
        candidates: [],
      };
    }
    return { ok: true, project: found };
  }
  const resolved = await resolveProjectByName(userId, ref.projectName!);
  if (resolved.found) return { ok: true, project: resolved.match };
  return {
    ok: false,
    error: projectResolutionError(
      ref.projectName!,
      resolved.candidates,
      resolved.suggestion,
      true,
    ),
    candidates: resolved.candidates,
  };
}

export async function resolveHabitByName(
  userId: string,
  name: string,
): Promise<
  ResolvedNames<{ id: string; title: string; bucket: string | null }>
> {
  const habits = await listHabits(userId);
  return {
    match: classifyNameMatch(habits, name, (h) => [h.title]),
    all: habits,
  };
}

/** Person name forms: display name plus first/last name and aliases. */
export function personNameForms(p: {
  displayName: string;
  firstName?: string | null;
  lastName?: string | null;
  aliases: string[];
}): string[] {
  return [
    p.displayName,
    ...(p.firstName ? [p.firstName] : []),
    ...(p.lastName ? [p.lastName] : []),
    ...p.aliases,
  ];
}

export const KNOWN_LIST_LIMIT = 8;

/** " Known projects: "A", "B" (+2 more)." — empty string when there's nothing. */
export function formatKnownList(names: string[], label: string): string {
  if (names.length === 0) return "";
  const shown = names.slice(0, KNOWN_LIST_LIMIT);
  const more =
    names.length > shown.length ? ` (+${names.length - shown.length} more)` : "";
  return ` Known ${label}: ${shown.map((n) => `"${n}"`).join(", ")}${more}.`;
}

export interface RequiredNameOpts<T> {
  label: string;
  input: string;
  toCandidate: (item: T) => AmbiguityCandidate;
  nameOf: (item: T) => string;
  /** Extra guidance appended to the no-match error (e.g. where to list ids). */
  hint?: string;
}

/**
 * Required-name failure: exact wins (caller handles it); a single close match
 * becomes a "did you mean …?" error (never picked silently); ambiguous lists
 * candidates; none lists what exists. Always ok:false with candidates.
 */
export function requiredNameError<T>(
  resolved: ResolvedNames<T>,
  opts: RequiredNameOpts<T>,
): PreviewResult {
  const { label, input } = opts;
  const { match, all } = resolved;
  if (match.kind === "close") {
    const item = match.match!;
    return errAmbiguous(
      `No ${label} exactly matching "${input}" — did you mean "${opts.nameOf(item)}"? Pass the exact name and retry.`,
      [opts.toCandidate(item)],
    );
  }
  if (match.kind === "ambiguous") {
    const names = match.candidates.map((c) => `"${opts.nameOf(c)}"`).join(", ");
    return errAmbiguous(
      `Ambiguous ${label} match for "${input}" — pass the exact name: ${names}.`,
      match.candidates.map(opts.toCandidate),
    );
  }
  const hint = opts.hint ? ` ${opts.hint}` : "";
  return errAmbiguous(
    `No ${label} found matching "${input}".${formatKnownList(all.map(opts.nameOf), `${label}s`)}${hint}`,
    [],
  );
}

export interface OptionalNameOpts<T> {
  label: string;
  input: string;
  nameOf: (item: T) => string;
  /** Explains what happens without the link, e.g. "task will be created without a project". */
  skipNote?: string;
}

/**
 * Optional-link warning: returns null when the match is exact (caller links
 * it); otherwise a warn-and-skip message — a close match suggests the exact
 * name instead of linking, never silently picks.
 */
export function optionalNameWarning<T>(
  resolved: ResolvedNames<T>,
  opts: OptionalNameOpts<T>,
): string | null {
  const { label, input, skipNote } = opts;
  const { match } = resolved;
  const tail = skipNote ? ` ${skipNote}` : "";
  if (match.kind === "exact") return null;
  if (match.kind === "close") {
    return `"${input}" is close to "${opts.nameOf(match.match!)}" but not an exact match — not linked.${tail} Pass the exact name to link it.`;
  }
  if (match.kind === "ambiguous") {
    const names = match.candidates.map((c) => opts.nameOf(c)).join(", ");
    return `Multiple ${label}s matched "${input}" (${names}) — skipping to avoid a wrong link.${tail}`;
  }
  return `No ${label} matched "${input}" — skipping.${tail}`;
}

/**
 * Resolve display names to Rolodex person IDs. Exact matches (display name,
 * first/last name, or alias) win; a single close match warns and is skipped
 * with a suggestion; zero or ambiguous matches warn and skip. Never fails the
 * whole action, never guesses.
 */
export async function resolvePeopleByNames(
  userId: string,
  names: string[],
): Promise<{ personIds: string[]; labels: string[]; warnings: string[] }> {
  const ids: string[] = [];
  const labels: string[] = [];
  const warnings: string[] = [];
  for (const raw of names) {
    const name = raw.trim();
    if (!name) continue;
    const matches = await findPersonByName(userId, name);
    const m = classifyNameMatch(matches, name, personNameForms);
    if (m.kind === "exact") {
      ids.push(m.match!.id);
      labels.push(m.match!.displayName);
    } else if (m.kind === "close") {
      warnings.push(
        `"${name}" is close to "${m.match!.displayName}" but not an exact match — not linked. Pass the exact name to link them.`,
      );
    } else if (m.kind === "ambiguous") {
      warnings.push(
        `Multiple people matched "${name}" (${m.candidates
          .map((p) => p.displayName)
          .join(", ")}) — skipping to avoid a wrong link`,
      );
    } else {
      warnings.push(
        `No Rolodex person matched "${name}" — no one linked for that name`,
      );
    }
  }
  return {
    personIds: [...new Set(ids)],
    labels: [...new Set(labels)],
    warnings,
  };
}

/**
 * Resolve a category name against the user's time categories. An exact
 * (case-insensitive) match is normalized to the stored name; a single close
 * or ambiguous match warns and is skipped (never silently remapped); with no
 * match at all the raw value is kept — categories are free text in the app,
 * so this saves it as a new category — with a warning naming the existing
 * categories.
 */
export async function resolveCategoryName(
  userId: string,
  raw: string | undefined,
): Promise<{ category: string | null; warnings: string[] }> {
  const warnings: string[] = [];
  const name = raw?.trim();
  if (!name) return { category: null, warnings };
  let categories: { name: string }[] = [];
  try {
    categories = await listTimeCategories(userId);
  } catch (error) {
    console.error("[assistant] listTimeCategories failed", error);
  }
  const m = classifyNameMatch(categories, name, (c) => [c.name]);
  if (m.kind === "exact") return { category: m.match!.name, warnings };
  const known = formatKnownList(
    categories.map((c) => c.name),
    "categories",
  );
  if (m.kind === "close") {
    warnings.push(
      `Category "${name}" is close to "${m.match!.name}" but not an exact match — not set. Pass the exact category name.${known}`,
    );
    return { category: null, warnings };
  }
  if (m.kind === "ambiguous") {
    warnings.push(
      `Category "${name}" matched several categories (${m.candidates
        .map((c) => c.name)
        .join(", ")}) — not set. Pass the exact category name.`,
    );
    return { category: null, warnings };
  }
  warnings.push(
    `Category "${name}" is not one of your existing categories — it will be saved as a new category.${known}`,
  );
  return { category: name, warnings };
}

// ── Calendar link resolution (planned vs actual) ────────────────────────────

export interface ResolvedCalendarLink {
  /** Backing CalendarItem id, or null when no link was established. */
  eventId: string | null;
  title: string | null;
  warnings: string[];
  /** Suffix for the preview text, e.g. ` · for "Standup"`. */
  linkedNote: string;
}

/**
 * Resolve an explicit calendarEventId (validated against the user's calendar;
 * virtual recurrence ids resolve to the parent row) or a fuzzy calendarTitle
 * (matched against today's blocks, warn-and-skip). An explicit id always wins;
 * an unknown id warns and skips — never fails, never guesses.
 */
export async function resolveCalendarLinkInput(
  userId: string,
  input: { calendarEventId?: string; calendarTitle?: string },
): Promise<ResolvedCalendarLink> {
  const warnings: string[] = [];
  const { calendarEventId, calendarTitle } = input;

  if (calendarEventId) {
    if (calendarTitle) {
      warnings.push("calendarTitle ignored — explicit calendarEventId provided");
    }
    const item = await getCalendarItem(userId, calendarEventId);
    if (!item) {
      warnings.push(
        `Calendar event "${calendarEventId}" not found — continuing without a calendar link. List events via GET /api/assistant/calendar to get a valid event id`,
      );
      return { eventId: null, title: null, warnings, linkedNote: "" };
    }
    return {
      eventId: item.id,
      title: item.title,
      warnings,
      linkedNote: ` · for "${item.title}"`,
    };
  }

  if (calendarTitle) {
    const resolved = await resolveCalendarBlockByTitle(userId, calendarTitle);
    warnings.push(...resolved.warnings);
    if (resolved.eventId) {
      return {
        eventId: resolved.eventId,
        title: resolved.title,
        warnings,
        linkedNote: ` · for "${resolved.title}"`,
      };
    }
    return { eventId: null, title: null, warnings, linkedNote: "" };
  }

  return { eventId: null, title: null, warnings, linkedNote: "" };
}

/** Pass a suggestedCalendarLink through normalized input safely. */
export function coerceCalendarSuggestion(
  value: unknown,
): CalendarLinkSuggestion | null {
  if (
    typeof value === "object" &&
    value !== null &&
    typeof (value as Record<string, unknown>).eventId === "string" &&
    typeof (value as Record<string, unknown>).title === "string"
  ) {
    const v = value as { eventId: string; title: string };
    return { eventId: v.eventId, title: v.title };
  }
  return null;
}

// ── Date helpers ──────────────────────────────────────────────────────────

/**
 * Parse "YYYY-MM-DD" + "HH:MM" as app-local time, strictly. Rejects impossible
 * times ("24:00") and impossible dates ("2026-02-30") that the native Date
 * parser silently rolls over into a different day.
 */
export function parseLocalDateTimeStrict(
  date: string,
  time: string,
): { ok: true; date: Date } | { ok: false; error: string } {
  const tm = /^(\d{2}):(\d{2})$/.exec(time);
  const hh = tm ? Number(tm[1]) : NaN;
  const mm = tm ? Number(tm[2]) : NaN;
  if (!tm || hh > 23 || mm > 59) {
    return {
      ok: false,
      error: `"${time}" is not a valid time — use HH:MM from 00:00 to 23:59`,
    };
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return {
      ok: false,
      error: `"${date}" is not a valid date — use YYYY-MM-DD (e.g. 2026-10-16)`,
    };
  }
  const d = new Date(`${date}T${time}:00`);
  if (Number.isNaN(d.getTime())) {
    return { ok: false, error: `"${date} ${time}" is not a valid date/time` };
  }
  if (localDatePart(d) !== date) {
    return { ok: false, error: `"${date}" is not a real calendar date` };
  }
  return { ok: true, date: d };
}

/** "Thing" not found by id, with a pointer to where valid ids come from. */
export function idNotFound(what: string, id: string, listHint: string): string {
  return `${what} "${id}" not found — ${listHint}`;
}

// Extract local "YYYY-MM-DD" / "HH:MM" parts from a Date (same TZ assumption).
export function localDatePart(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function localTimePart(d: Date): string {
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

// ── Preview handlers ──────────────────────────────────────────────────────

export async function resolvePersonByName(
  userId: string,
  name: string,
): Promise<ResolveResult<{ id: string; name: string }>> {
  const persons = await findPersonByName(userId, name);
  const lower = name.toLowerCase();

  const exact = persons.filter((p) => p.displayName.toLowerCase() === lower);
  if (exact.length === 1) return { found: true, match: { id: exact[0]!.id, name: exact[0]!.displayName } };

  const partial = persons.filter((p) => p.displayName.toLowerCase().includes(lower));
  if (partial.length === 1) {
    // One close match: never pick it silently — hand back a suggestion so
    // the caller can ask rather than guess.
    const only = partial[0]!;
    return {
      found: false,
      candidates: [{ id: only.id, name: only.displayName }],
      suggestion: only.displayName,
    };
  }

  const pool = exact.length > 1 ? exact : partial;
  return {
    found: false,
    candidates: pool.map((p) => ({ id: p.id, name: p.displayName })),
  };
}

/**
 * Shared "contact not found" message for Rolodex actions. Exact display-name
 * match wins; a single close match becomes a "did you mean" suggestion;
 * several matches list candidates; zero matches point at creation.
 */
export function personResolutionError(
  name: string,
  candidates: AmbiguityCandidate[],
  suggestion: string | undefined,
): string {
  if (suggestion) {
    return `No exact contact match for "${name}" — did you mean "${suggestion}"? Retry with the exact display name.`;
  }
  if (candidates.length > 0) {
    return `Ambiguous contact match for "${name}" — ${candidates.length} contacts match. Retry with the exact display name.`;
  }
  return `No contact found matching "${name}". Check the spelling, or create them with create_rolodex_person.`;
}

// ── Project planning preview/execute handlers ─────────────────────────────

export function err(message: string): PreviewResult {
  return {
    ok: false,
    error: message,
    previewText: "",
    normalizedInput: {},
    warnings: [],
  };
}

/**
 * Turn a Zod validation failure into an actionable error: every issue names
 * the offending field and what was wrong with it (including valid enum values
 * and expected formats), so the caller knows exactly what to fix.
 */
export function formatZodError(error: z.ZodError): string {
  const parts = error.issues.map((issue) => {
    const path = issue.path.length > 0 ? issue.path.join(".") : "input";
    return `"${path}": ${issue.message}`;
  });
  return `Invalid input: ${parts.join("; ")}`;
}

export function zodErr(error: z.ZodError): PreviewResult {
  return err(formatZodError(error));
}

export function errAmbiguous(message: string, candidates: AmbiguityCandidate[]): PreviewResult {
  return {
    ok: false,
    error: message,
    candidates,
    previewText: "",
    normalizedInput: {},
    warnings: [],
  };
}

export function err2(message: string): ExecuteResult {
  return { ok: false, error: message, recordId: null, recordType: null, summary: "" };
}

// ── Formatting helpers ────────────────────────────────────────────────────

export function fmtClock(date: Date): string {
  return date.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

export function fmtMinutes(minutes: number): string {
  const v = Math.max(0, Math.round(minutes));
  if (v === 0) return "0m";
  const h = Math.floor(v / 60);
  const m = v % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

// ── Dispatch tables ───────────────────────────────────────────────────────
