"use client";

// One card per unsorted purchase. Tap a category and the next card appears.
// When the same shop is waiting more than once, "Use this for every <shop>"
// (on by default) files all of them in the same tap. New entries from that
// shop pick the category up when logged, from quick add's shop memory.

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { formatUSDFromCents } from "@/lib/money";
import { financeCategoryLook } from "@/lib/quick-capture";
import { sameShopIds, type SortItem } from "@/lib/finance-sort";
import { setCategoryForEntries, setEntryCategory } from "../actions";

const SHOWN = 8;

function dayLabel(day: string) {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(y!, m! - 1, d!).toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });
}

export function SortFlow({ initialQueue, categories }: { initialQueue: SortItem[]; categories: string[] }) {
  const [queue, setQueue] = useState(initialQueue);
  const [done, setDone] = useState(0);
  const [skipped, setSkipped] = useState<string[]>([]);
  const [showAll, setShowAll] = useState(false);
  const [newName, setNewName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, start] = useTransition();
  const [total] = useState(initialQueue.length);

  const visible = queue.filter((q) => !skipped.includes(q.id));
  const item = visible[0] ?? null;
  const others = useMemo(() => (item ? sameShopIds(queue, item) : []), [queue, item]);
  const [alwaysFor, setAlwaysFor] = useState<Record<string, boolean>>({});
  const always = item ? (alwaysFor[item.description.toLowerCase()] ?? others.length > 0) : false;

  if (!item) {
    return (
      <div className="space-y-4 py-12 text-center">
        <p className="text-[2.5rem]" aria-hidden>
          🎉
        </p>
        <h1 className="text-[1.5rem] font-bold tracking-tight" style={{ color: "var(--text)" }}>
          {total === 0 ? "Nothing to sort" : "All sorted"}
        </h1>
        <p className="text-[0.875rem]" style={{ color: "var(--text-muted)" }}>
          {total === 0
            ? "Every purchase has a category."
            : skipped.length
              ? `${done} filed, ${skipped.length} skipped for now.`
              : `${done} ${done === 1 ? "purchase" : "purchases"} filed.`}
        </p>
        <div className="flex justify-center gap-2">
          {skipped.length ? (
            <button type="button" className="btn-ghost" onClick={() => setSkipped([])}>
              Go through skipped
            </button>
          ) : null}
          <Link href="/app/finance" className="btn-ink">
            Back to Money
          </Link>
        </div>
      </div>
    );
  }

  const pick = (category: string) => {
    setError(null);
    const also = always ? others : [];
    const prevQueue = queue;
    setQueue(queue.filter((q) => q.id !== item.id && !also.includes(q.id)));
    setDone((n) => n + 1 + also.length);
    setShowAll(false);
    start(async () => {
      const r = also.length
        ? await setCategoryForEntries([item.id, ...also], category)
        : await setEntryCategory(item.id, category);
      if (r && !r.ok) {
        setQueue(prevQueue);
        setDone((n) => n - 1 - also.length);
        setError(r.error);
      }
    });
  };

  const position = total - queue.length + 1;
  const ordered = item.suggestion
    ? [item.suggestion, ...categories.filter((c) => c !== item.suggestion)]
    : categories;
  const shown = showAll ? ordered : ordered.slice(0, SHOWN);

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <h1 className="flex-1 text-[0.9375rem] font-semibold" style={{ color: "var(--text)" }}>
          Sort {Math.min(position, total)} of {total}
        </h1>
        <button type="button" className="btn-ghost" onClick={() => setSkipped([...skipped, item.id])}>
          Skip
        </button>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full" style={{ background: "var(--bg-tint-strong)" }}>
        <div
          className="h-full rounded-full transition-[width]"
          style={{ width: `${Math.round((done / Math.max(1, total)) * 100)}%`, background: "var(--text)" }}
        />
      </div>

      <div key={item.id} className="sort-card rounded-xl border px-5 py-7 text-center" style={{ borderColor: "var(--border)" }}>
        <p className="text-[0.75rem]" style={{ color: "var(--text-faint)" }}>
          {[dayLabel(item.day), item.accountName, item.byName].filter(Boolean).join(" · ")}
        </p>
        <p className="mt-1 truncate text-[1.5rem] font-bold tracking-tight" style={{ color: "var(--text)" }}>
          {item.description}
        </p>
        <p className="mt-1 text-[2rem] font-bold tabular tracking-tight" style={{ color: "var(--text)" }}>
          {formatUSDFromCents(item.amountCents)}
        </p>
        {item.suggestion ? (
          <p className="mt-1 text-[0.75rem]" style={{ color: "var(--text-faint)" }}>
            Looks like {financeCategoryLook(item.suggestion).label}
          </p>
        ) : null}
      </div>

      <div className="grid grid-cols-2 gap-2" role="group" aria-label="Category">
        {shown.map((c, i) => {
          const look = financeCategoryLook(c);
          const suggested = i === 0 && item.suggestion === c;
          return (
            <button
              key={c}
              type="button"
              onClick={() => pick(c)}
              className="flex min-h-[3rem] items-center justify-center gap-2 rounded-lg border px-3 text-[0.9375rem] font-medium transition-colors"
              style={
                suggested
                  ? { background: "var(--text)", borderColor: "var(--text)", color: "var(--bg-page)" }
                  : { borderColor: "var(--border-soft)", color: "var(--text)" }
              }
            >
              {look.emoji ? (
                <span aria-hidden>{look.emoji}</span>
              ) : (
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: look.color }} aria-hidden />
              )}
              <span className="truncate">{look.label}</span>
            </button>
          );
        })}
        {!showAll && ordered.length > SHOWN ? (
          <button
            type="button"
            onClick={() => setShowAll(true)}
            className="min-h-[3rem] rounded-lg border px-3 text-[0.9375rem]"
            style={{ borderColor: "var(--border-soft)", color: "var(--text-muted)" }}
          >
            More…
          </button>
        ) : newName === null ? (
          <button
            type="button"
            onClick={() => setNewName("")}
            className="min-h-[3rem] rounded-lg border border-dashed px-3 text-[0.9375rem]"
            style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}
          >
            + New category
          </button>
        ) : (
          <form
            className="col-span-2 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              const name = newName.trim().replace(/\s+/g, " ").slice(0, 40);
              if (!name) return;
              setNewName(null);
              pick(categories.find((c) => c.toLowerCase() === name.toLowerCase()) ?? name);
            }}
          >
            <input
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="🎁 Gifts"
              aria-label="New category name"
              className="field flex-1"
            />
            <button type="submit" className="btn-ink">
              Use
            </button>
          </form>
        )}
      </div>

      {others.length ? (
      <label className="flex items-center gap-3 text-[0.875rem]" style={{ color: "var(--text)" }}>
        <input
          type="checkbox"
          checked={always}
          onChange={(e) => setAlwaysFor({ ...alwaysFor, [item.description.toLowerCase()]: e.target.checked })}
          className="h-5 w-5"
        />
        <span>
          Use this for every {item.description}
          <span style={{ color: "var(--text-faint)" }}> (sorts {others.length} more)</span>
        </span>
      </label>
      ) : null}

      {error ? (
        <p className="text-[0.8125rem]" style={{ color: "var(--attention)" }} role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
