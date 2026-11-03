"use client";

// Everything you've logged or imported, newest first, grouped by day.
// Filters for the weekly check-in: "To sort" (no category yet) and "Not on
// a statement yet". Tap a row to edit; removing one shows Undo instead of a
// confirm dialog. Entries confirmed by a finished statement check are locked.

import { useCallback, useMemo, useRef, useState, useTransition } from "react";
import { FINANCE_CATEGORIES } from "@/lib/finance-categories";
import type { EntryStatus } from "@/lib/finance-entries";
import {
  addFinanceEntry,
  deleteFinanceEntry,
  setEntryCategory,
  updateFinanceEntry,
} from "../actions";
import { UndoToast, type UndoToastState } from "./undo-toast";

export type EntryView = {
  id: string;
  /** "YYYY-MM-DD" (server-local day). */
  day: string;
  amount: number;
  description: string;
  category: string | null;
  accountId: string | null;
  accountName: string | null;
  status: EntryStatus;
  byInitials: string | null;
  byName: string | null;
};

type Filter = "all" | "to_sort" | "pending";

function money(cents: number) {
  return (Math.abs(cents) / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });
}

function dayHeading(day: string) {
  const [y, m, d] = day.split("-").map(Number);
  const date = new Date(y!, m! - 1, d!);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  const same = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  if (same(date, today)) return "Today";
  if (same(date, yesterday)) return "Yesterday";
  return date.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric", year: date.getFullYear() === today.getFullYear() ? undefined : "numeric" });
}

export function EntryList({
  entries,
  accounts,
  initialFilter = "all",
}: {
  entries: EntryView[];
  accounts: Array<{ id: string; name: string }>;
  initialFilter?: Filter;
}) {
  const [filter, setFilter] = useState<Filter>(initialFilter);
  const [query, setQuery] = useState("");
  const [limit, setLimit] = useState(60);
  const [openId, setOpenId] = useState<string | null>(null);
  const [toast, setToast] = useState<UndoToastState>(null);
  const closeToast = useCallback(() => setToast(null), []);
  const toastSeq = useRef(0);

  const counts = useMemo(
    () => ({
      to_sort: entries.filter((e) => e.amount < 0 && !e.category).length,
      pending: entries.filter((e) => e.status === "pending").length,
    }),
    [entries],
  );

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return entries.filter((e) => {
      if (filter === "to_sort" && !(e.amount < 0 && !e.category)) return false;
      if (filter === "pending" && e.status !== "pending") return false;
      if (q && !`${e.description} ${e.category ?? ""} ${e.accountName ?? ""}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [entries, filter, query]);

  const groups = useMemo(() => {
    const out: Array<{ day: string; items: EntryView[] }> = [];
    for (const e of visible.slice(0, limit)) {
      const last = out.at(-1);
      if (last && last.day === e.day) last.items.push(e);
      else out.push({ day: e.day, items: [e] });
    }
    return out;
  }, [visible, limit]);

  const removed = (entry: EntryView) =>
    setToast({
      id: ++toastSeq.current,
      message: `Removed ${money(entry.amount)} ${entry.description}`,
      onUndo: async () => {
        await addFinanceEntry({
          amount: (Math.abs(entry.amount) / 100).toFixed(2),
          direction: entry.amount < 0 ? "out" : "in",
          description: entry.description,
          category: entry.category,
          accountId: entry.accountId,
          date: entry.day,
        });
      },
    });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <FilterChip active={filter === "all"} onClick={() => setFilter("all")} label="All" />
        <FilterChip
          active={filter === "to_sort"}
          onClick={() => setFilter("to_sort")}
          label={`To sort${counts.to_sort ? ` (${counts.to_sort})` : ""}`}
        />
        <FilterChip
          active={filter === "pending"}
          onClick={() => setFilter("pending")}
          label={`Not on a statement yet${counts.pending ? ` (${counts.pending})` : ""}`}
        />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search"
          aria-label="Search entries"
          className="field ml-auto w-full sm:w-[12rem]"
        />
      </div>

      {groups.length === 0 ? (
        <p
          className="rounded-md py-10 text-center text-[0.875rem]"
          style={{ color: "var(--text-muted)", border: "1px dashed var(--border)" }}
        >
          {filter === "to_sort"
            ? "Nothing to sort. Nice."
            : filter === "pending"
              ? "Everything logged has been matched to a statement."
              : "Nothing here yet. Log your first purchase above."}
        </p>
      ) : (
        <div className="space-y-5">
          {groups.map((group) => (
            <section key={group.day}>
              <h3 className="mb-1 text-[0.6875rem] font-semibold uppercase tracking-wider" style={{ color: "var(--text-faint)" }}>
                {dayHeading(group.day)}
              </h3>
              <ul>
                {group.items.map((entry) => (
                  <EntryRow
                    key={entry.id}
                    entry={entry}
                    accounts={accounts}
                    open={openId === entry.id}
                    onToggle={() => setOpenId(openId === entry.id ? null : entry.id)}
                    onRemoved={() => {
                      setOpenId(null);
                      removed(entry);
                    }}
                  />
                ))}
              </ul>
            </section>
          ))}
          {visible.length > limit ? (
            <button type="button" className="btn-ghost" onClick={() => setLimit(limit + 100)}>
              Show more ({visible.length - limit} left)
            </button>
          ) : null}
        </div>
      )}
      <UndoToast toast={toast} onClose={closeToast} />
    </div>
  );
}

function FilterChip({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className="rounded-full border px-3 py-1 text-[0.8125rem]"
      style={{
        borderColor: active ? "var(--text)" : "var(--border-soft)",
        background: active ? "var(--text)" : "transparent",
        color: active ? "var(--bg-page)" : "var(--text-muted)",
      }}
    >
      {label}
    </button>
  );
}

function EntryRow({
  entry,
  accounts,
  open,
  onToggle,
  onRemoved,
}: {
  entry: EntryView;
  accounts: Array<{ id: string; name: string }>;
  open: boolean;
  onToggle: () => void;
  onRemoved: () => void;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const out = entry.amount < 0;
  const toSort = out && !entry.category;

  return (
    <li className="border-b py-2.5" style={{ borderColor: "var(--border-faint)" }}>
      <div className="flex items-center gap-3">
        <button type="button" onClick={onToggle} className="flex min-w-0 flex-1 items-center gap-3 text-left" aria-expanded={open}>
          {entry.byInitials ? (
            <span
              title={entry.byName ? `Logged by ${entry.byName}` : undefined}
              className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[0.625rem] font-semibold"
              style={{ background: "var(--bg-tint-strong)", color: "var(--text-muted)" }}
            >
              {entry.byInitials}
            </span>
          ) : null}
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[0.875rem]" style={{ color: "var(--text)" }}>
              {entry.description}
            </span>
            <span className="block truncate text-[0.75rem]" style={{ color: "var(--text-faint)" }}>
              {[entry.category ?? (out ? "No category" : null), entry.accountName].filter(Boolean).join(" · ")}
              {entry.status === "pending" ? (
                <span style={{ color: "var(--aged-gold)" }}> · not on a statement yet</span>
              ) : entry.status === "locked" ? (
                <span> · matches the bank ✓</span>
              ) : null}
            </span>
          </span>
          <span
            className="shrink-0 text-[0.9375rem] font-medium tabular"
            style={{ color: out ? "var(--text)" : "var(--verdigris)" }}
          >
            {out ? "" : "+"}
            {money(entry.amount)}
          </span>
        </button>
      </div>

      {toSort && !open ? (
        <div className="mt-1.5 pl-0 sm:pl-9">
          <select
            aria-label={`Category for ${entry.description}`}
            disabled={pending}
            defaultValue=""
            onChange={(e) => {
              const value = e.target.value || null;
              start(async () => {
                const r = await setEntryCategory(entry.id, value);
                if (r && !r.ok) setError(r.error);
              });
            }}
            className="field max-w-[12rem] text-[0.8125rem]"
          >
            <option value="">Pick a category…</option>
            {FINANCE_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      {open ? (
        entry.status === "locked" ? (
          <p className="mt-2 text-[0.75rem]" style={{ color: "var(--text-faint)" }}>
            This matches a checked statement, so it&rsquo;s locked. You can still change its category.
            <select
              aria-label="Category"
              disabled={pending}
              defaultValue={entry.category ?? ""}
              onChange={(e) => {
                const value = e.target.value || null;
                start(async () => {
                  const r = await setEntryCategory(entry.id, value);
                  if (r && !r.ok) setError(r.error);
                });
              }}
              className="field mt-2 block max-w-[12rem] text-[0.8125rem]"
            >
              <option value="">No category</option>
              {FINANCE_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </p>
        ) : (
          <form
            className="mt-2 grid gap-2 sm:grid-cols-2"
            onSubmit={(event) => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              setError(null);
              start(async () => {
                const r = await updateFinanceEntry(entry.id, {
                  amount: String(form.get("amount") ?? ""),
                  direction: out ? "out" : "in",
                  description: String(form.get("description") ?? ""),
                  category: String(form.get("category") ?? "") || null,
                  accountId: String(form.get("accountId") ?? "") || null,
                  date: String(form.get("date") ?? ""),
                });
                if (r && !r.ok) setError(r.error);
                else onToggle();
              });
            }}
          >
            <input name="amount" inputMode="decimal" defaultValue={(Math.abs(entry.amount) / 100).toFixed(2)} className="field tabular" aria-label="Amount" />
            <input name="description" defaultValue={entry.description} className="field" aria-label="Name" />
            <select name="category" defaultValue={entry.category ?? ""} className="field" aria-label="Category">
              <option value="">No category</option>
              {FINANCE_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <select name="accountId" defaultValue={entry.accountId ?? ""} className="field" aria-label="Account">
              <option value="">No account</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
            <input name="date" type="date" defaultValue={entry.day} className="field" aria-label="Date" />
            <div className="flex items-center gap-2">
              <button type="submit" disabled={pending} className="btn-ink">
                {pending ? "Saving…" : "Save"}
              </button>
              <button
                type="button"
                disabled={pending}
                className="btn-ghost"
                onClick={() =>
                  start(async () => {
                    const r = await deleteFinanceEntry(entry.id);
                    if (r && !r.ok) setError(r.error);
                    else onRemoved();
                  })
                }
              >
                Remove
              </button>
            </div>
          </form>
        )
      ) : null}
      {error ? (
        <p className="mt-1 text-[0.75rem]" style={{ color: "var(--accent-strong)" }} role="alert">
          {error}
        </p>
      ) : null}
    </li>
  );
}
