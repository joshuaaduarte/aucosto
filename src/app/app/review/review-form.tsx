"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PRIORITY_LIMIT, REVIEW_NOTE_LIMIT } from "@/lib/weekly-review";
import { saveWeeklyReview } from "./actions";

export type ReviewCandidate = { id: string; title: string; detail: string };

type Pick = { kind: "task"; id: string; title: string } | { kind: "new"; title: string };

function pickKey(pick: Pick): string {
  return pick.kind === "task" ? pick.id : `new:${pick.title}`;
}

export function ReviewForm({
  nextWeekLabel,
  candidates,
  suggestedCount,
  initialIds,
  initialNote,
  savedAt,
}: {
  nextWeekLabel: string;
  candidates: ReviewCandidate[];
  suggestedCount: number;
  initialIds: string[];
  initialNote: string;
  savedAt: string | null;
}) {
  const router = useRouter();
  const byId = useMemo(() => new Map(candidates.map((c) => [c.id, c])), [candidates]);
  const [picks, setPicks] = useState<Pick[]>(() =>
    initialIds.flatMap((id) => {
      const candidate = byId.get(id);
      return candidate ? [{ kind: "task" as const, id, title: candidate.title }] : [];
    }),
  );
  const [note, setNote] = useState(initialNote);
  const [query, setQuery] = useState("");
  const [showAll, setShowAll] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(
    savedAt ? { tone: "ok", text: "Saved. Change the picks and save again any time this week." } : null,
  );
  const [pending, startTransition] = useTransition();

  const full = picks.length >= PRIORITY_LIMIT;
  const pickedIds = new Set(picks.flatMap((pick) => (pick.kind === "task" ? [pick.id] : [])));
  const trimmedQuery = query.trim();
  const needle = trimmedQuery.toLowerCase();
  const matching = needle
    ? candidates.filter((c) => c.title.toLowerCase().includes(needle))
    : showAll
      ? candidates
      : candidates.slice(0, suggestedCount);
  const visible = matching.filter((c) => !pickedIds.has(c.id)).slice(0, needle || showAll ? 40 : 8);
  const exactMatch = candidates.some((c) => c.title.toLowerCase() === needle);

  function add(pick: Pick) {
    if (full) return;
    if (picks.some((existing) => pickKey(existing) === pickKey(pick))) return;
    setPicks([...picks, pick]);
    setQuery("");
    setMessage(null);
  }

  function remove(key: string) {
    setPicks(picks.filter((pick) => pickKey(pick) !== key));
    setMessage(null);
  }

  function save() {
    setMessage(null);
    startTransition(async () => {
      const result = await saveWeeklyReview({
        priorityIds: picks.flatMap((pick) => (pick.kind === "task" ? [pick.id] : [])),
        newTitles: picks.flatMap((pick) => (pick.kind === "new" ? [pick.title] : [])),
        note,
      });
      if (!result.ok) {
        setMessage({ tone: "error", text: result.error });
        return;
      }
      const parts = [
        result.priorityCount > 0
          ? `${result.priorityCount === 1 ? "Your pick is" : "Your picks are"} on the Do List's Today lane`
          : "Review saved",
      ];
      if (result.habitLogged) parts.push("your Weekly review habit is ticked");
      setMessage({ tone: "ok", text: `${parts.join(", and ")}.` });
      router.refresh();
    });
  }

  return (
    <section
      className="rounded-md border p-4 sm:p-5"
      style={{ borderColor: "var(--border)", background: "var(--bg-page)" }}
      aria-labelledby="review-next-week"
    >
      <p
        className="text-[0.6875rem] font-semibold uppercase tracking-wider"
        style={{ color: "var(--text-faint)" }}
      >
        Next week · {nextWeekLabel}
      </p>
      <h2
        id="review-next-week"
        className="mt-1 text-[1.125rem] font-semibold tracking-tight"
        style={{ color: "var(--text)" }}
      >
        Pick the three things that matter most
      </h2>
      <p className="mt-1 text-[0.84rem]" style={{ color: "var(--text-muted)" }}>
        They move to the top of your Do List and show on Today all week.
      </p>

      <ol className="mt-4 space-y-2">
        {Array.from({ length: PRIORITY_LIMIT }, (_, index) => {
          const pick = picks[index];
          return (
            <li
              key={pick ? pickKey(pick) : `empty-${index}`}
              className="flex min-h-[2.75rem] items-center gap-3 rounded-md border px-3 py-2"
              style={{
                borderColor: pick ? "var(--border-soft)" : "var(--border-faint)",
                borderStyle: pick ? "solid" : "dashed",
                background: pick ? "var(--bg-tint)" : "transparent",
              }}
            >
              <span
                className="w-4 shrink-0 text-center text-[0.84rem] font-semibold tabular-nums"
                style={{ color: "var(--text-faint)" }}
              >
                {index + 1}
              </span>
              {pick ? (
                <>
                  <span className="min-w-0 flex-1 text-[0.9rem]" style={{ color: "var(--text)" }}>
                    {pick.title}
                    {pick.kind === "new" ? (
                      <span className="ml-2 text-[0.72rem]" style={{ color: "var(--text-faint)" }}>
                        new task
                      </span>
                    ) : null}
                  </span>
                  <button
                    type="button"
                    onClick={() => remove(pickKey(pick))}
                    className="btn-ghost h-8 shrink-0 px-2 text-[0.78rem]"
                    aria-label={`Remove ${pick.title}`}
                  >
                    Remove
                  </button>
                </>
              ) : (
                <span className="text-[0.84rem]" style={{ color: "var(--text-faint)" }}>
                  {index === picks.length ? "Choose below, or type a new one" : "Empty"}
                </span>
              )}
            </li>
          );
        })}
      </ol>

      {!full ? (
        <div className="mt-4">
          <label className="sr-only" htmlFor="review-search">
            Search your open tasks or type a new one
          </label>
          <input
            id="review-search"
            className="field w-full text-[0.875rem]"
            placeholder="Search your open tasks, or type a new one"
            value={query}
            maxLength={200}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key !== "Enter") return;
              event.preventDefault();
              if (!trimmedQuery) return;
              const first = visible[0];
              if (first && first.title.toLowerCase() === needle) {
                add({ kind: "task", id: first.id, title: first.title });
              } else {
                add({ kind: "new", title: trimmedQuery });
              }
            }}
          />
          <ul className="mt-2 divide-y" style={{ borderColor: "var(--border-faint)" }}>
            {trimmedQuery && !exactMatch ? (
              <li style={{ borderColor: "var(--border-faint)" }}>
                <button
                  type="button"
                  onClick={() => add({ kind: "new", title: trimmedQuery })}
                  className="flex w-full items-center gap-2 py-2.5 text-left text-[0.875rem]"
                  style={{ color: "var(--text)" }}
                >
                  <span aria-hidden style={{ color: "var(--text-faint)" }}>
                    +
                  </span>
                  Add “{trimmedQuery}” as a new task
                </button>
              </li>
            ) : null}
            {visible.map((candidate) => (
              <li key={candidate.id} style={{ borderColor: "var(--border-faint)" }}>
                <button
                  type="button"
                  onClick={() =>
                    add({ kind: "task", id: candidate.id, title: candidate.title })
                  }
                  className="flex w-full items-baseline justify-between gap-3 py-2.5 text-left"
                >
                  <span className="min-w-0 text-[0.875rem]" style={{ color: "var(--text)" }}>
                    {candidate.title}
                  </span>
                  {candidate.detail ? (
                    <span
                      className="shrink-0 text-[0.72rem]"
                      style={{ color: "var(--text-faint)" }}
                    >
                      {candidate.detail}
                    </span>
                  ) : null}
                </button>
              </li>
            ))}
          </ul>
          {!trimmedQuery && !showAll && candidates.length > suggestedCount ? (
            <button
              type="button"
              onClick={() => setShowAll(true)}
              className="btn-ghost mt-1 h-8 px-2 text-[0.78rem]"
            >
              Show all {candidates.length} open tasks
            </button>
          ) : null}
          {trimmedQuery && visible.length === 0 && exactMatch ? (
            <p className="mt-2 text-[0.8rem]" style={{ color: "var(--text-faint)" }}>
              Already picked.
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="mt-5">
        <label
          htmlFor="review-note"
          className="text-[0.8rem] font-medium"
          style={{ color: "var(--text-muted)" }}
        >
          One line for future you (optional)
        </label>
        <textarea
          id="review-note"
          className="field mt-1.5 w-full text-[0.875rem]"
          rows={2}
          maxLength={REVIEW_NOTE_LIMIT}
          placeholder="What went well, or what to change"
          value={note}
          onChange={(event) => setNote(event.target.value)}
        />
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button type="button" className="btn-ink" onClick={save} disabled={pending}>
          {pending ? "Saving…" : savedAt ? "Save changes" : "Save review"}
        </button>
        {message ? (
          <p
            role="status"
            className="text-[0.84rem]"
            style={{ color: message.tone === "ok" ? "var(--positive)" : "var(--attention)" }}
          >
            {message.text}
          </p>
        ) : null}
      </div>
    </section>
  );
}
