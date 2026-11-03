"use client";

// Everything you've logged or imported, newest first, grouped by day.
// Filters for the weekly check-in: "To sort" (no category yet) and "Not on
// a statement yet". Tap a row to edit; removing one shows Undo instead of a
// confirm dialog. Entries confirmed by a finished statement check are locked.

import { useCallback, useMemo, useRef, useState, useTransition } from "react";
import type { EntryStatus } from "@/lib/finance-entries";
import {
  addFinanceEntry,
  addFinanceMove,
  deleteFinanceEntry,
  setEntryCategory,
  setFinanceEntryPot,
  updateFinanceEntry,
} from "../actions";
import { UndoToast, type UndoToastState } from "./undo-toast";
import { CategoryBadge } from "./recent-entries";
import { financeCategoryLook } from "@/lib/quick-capture";
import Link from "next/link";

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
  /** Money moved between accounts (shown once, on the leaving side). */
  move: { toId: string | null; toName: string | null } | null;
  /** Paid from a set-aside pot (doesn't count as this month's spending). */
  potId: string | null;
};

export type PotChoice = { id: string; name: string };

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
  categories,
  pots = [],
  initialFilter = "all",
}: {
  entries: EntryView[];
  accounts: Array<{ id: string; name: string }>;
  /** Every category to offer, built-in then your own (spendCategoryChoices). */
  categories: string[];
  /** Set-aside pots a purchase can be paid from. */
  pots?: PotChoice[];
  initialFilter?: Filter;
}) {
  const [filter, setFilter] = useState<Filter>(initialFilter);
  const [query, setQuery] = useState("");
  const [limit, setLimit] = useState(30);
  const [openId, setOpenId] = useState<string | null>(null);
  const [toast, setToast] = useState<UndoToastState>(null);
  const closeToast = useCallback(() => setToast(null), []);
  const toastSeq = useRef(0);

  const counts = useMemo(
    () => ({
      to_sort: entries.filter((e) => e.amount < 0 && !e.category && !e.move).length,
      pending: entries.filter((e) => e.status === "pending").length,
    }),
    [entries],
  );

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return entries.filter((e) => {
      if (filter === "to_sort" && !(e.amount < 0 && !e.category && !e.move)) return false;
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

  const removed = (entry: EntryView) => {
    if (entry.move) {
      const { toId } = entry.move;
      if (!entry.accountId || !toId || entry.amount >= 0) return;
      const fromId = entry.accountId;
      setToast({
        id: ++toastSeq.current,
        message: `Removed the ${money(entry.amount)} move`,
        onUndo: async () => {
          await addFinanceMove({
            amount: (Math.abs(entry.amount) / 100).toFixed(2),
            fromAccountId: fromId,
            toAccountId: toId,
            date: entry.day,
          });
        },
      });
      return;
    }
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
  };

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

      {filter === "to_sort" && counts.to_sort > 1 ? (
        <Link
          href="/app/finance/sort"
          className="flex items-center justify-between rounded-md px-4 py-3 text-[0.875rem]"
          style={{ background: "var(--accent-tint)", color: "var(--text)" }}
        >
          <span>
            <span className="font-semibold">Sort them one at a time.</span> Big buttons, about a minute.
          </span>
          <span aria-hidden>→</span>
        </Link>
      ) : null}

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
              <h3
                className="mb-1 flex items-baseline justify-between text-[0.6875rem] font-semibold uppercase tracking-wider"
                style={{ color: "var(--text-faint)" }}
              >
                <span>{dayHeading(group.day)}</span>
                {(() => {
                  const spent = group.items.reduce((sum, e) => (e.amount < 0 && !e.move ? sum - e.amount : sum), 0);
                  return spent ? <span className="tabular normal-case tracking-normal">{money(spent)} spent</span> : null;
                })()}
              </h3>
              <ul>
                {group.items.map((entry) => (
                  <EntryRow
                    key={entry.id}
                    entry={entry}
                    accounts={accounts}
                    categories={categories}
                    pots={pots}
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
            <button type="button" className="btn-ghost" onClick={() => setLimit(limit + 60)}>
              Show earlier ({visible.length - limit} more)
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

const NEW_CATEGORY = "__new__";

/**
 * A category dropdown with your own categories and "New category…", which
 * asks for a name. Calls onPick with the chosen name (null for none).
 */
function CategorySelect({
  categories,
  value,
  onPick,
  placeholder,
  disabled,
  className,
  label,
}: {
  categories: string[];
  value: string | null;
  onPick: (value: string | null) => void;
  placeholder: string;
  disabled?: boolean;
  className: string;
  label: string;
}) {
  const options = value && !categories.includes(value) ? [...categories, value] : categories;
  return (
    <select
      aria-label={label}
      disabled={disabled}
      value={value ?? ""}
      onChange={(e) => {
        const v = e.target.value;
        if (v !== NEW_CATEGORY) {
          onPick(v || null);
          return;
        }
        const name = window.prompt("New category name")?.trim().replace(/\s+/g, " ").slice(0, 40);
        if (name) onPick(categories.find((c) => c.toLowerCase() === name.toLowerCase()) ?? name);
      }}
      className={className}
    >
      <option value="">{placeholder}</option>
      {options.map((c) => (
        <option key={c} value={c}>
          {c}
        </option>
      ))}
      <option value={NEW_CATEGORY}>New category…</option>
    </select>
  );
}

function EntryRow({
  entry,
  accounts,
  categories,
  pots,
  open,
  onToggle,
  onRemoved,
}: {
  entry: EntryView;
  accounts: Array<{ id: string; name: string }>;
  categories: string[];
  pots: PotChoice[];
  open: boolean;
  onToggle: () => void;
  onRemoved: () => void;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [lockedCategory, setLockedCategory] = useState<string | null>(entry.category);
  const [formCategory, setFormCategory] = useState<string | null>(entry.category);
  const [potId, setPotId] = useState<string | null>(entry.potId);
  const out = entry.amount < 0;
  const isMove = entry.move !== null;
  const potName = potId ? (pots.find((p) => p.id === potId)?.name ?? "a pot") : null;
  const potPicker =
    out && !isMove && (pots.length > 0 || potId) ? (
      <label className="flex items-center gap-2 text-[0.75rem]" style={{ color: "var(--text-muted)" }}>
        Paid from
        <select
          value={potId ?? ""}
          disabled={pending}
          onChange={(e) => {
            const next = e.target.value || null;
            const prev = potId;
            setPotId(next);
            setError(null);
            start(async () => {
              const r = await setFinanceEntryPot(entry.id, next);
              if (r && !r.ok) {
                setPotId(prev);
                setError(r.error);
              }
            });
          }}
          className="field text-[0.8125rem]"
        >
          <option value="">Everyday money</option>
          {pots.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </label>
    ) : null;
  const toSort = out && !entry.category && !isMove;
  const title = isMove
    ? out
      ? `${entry.accountName ?? "Account"} → ${entry.move?.toName ?? "another account"}`
      : `Into ${entry.accountName ?? "account"}`
    : entry.description;

  return (
    <li className="border-b py-2.5" style={{ borderColor: "var(--border-faint)" }}>
      <div className="flex items-center gap-3">
        <button type="button" onClick={onToggle} className="flex min-w-0 flex-1 items-center gap-3 text-left" aria-expanded={open}>
          {isMove ? (
            <span
              aria-hidden
              className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[0.8125rem]"
              style={{ background: "var(--bg-tint-strong)", color: "var(--text-muted)" }}
            >
              ⇄
            </span>
          ) : (
            <CategoryBadge category={out ? entry.category : "Income"} size="sm" />
          )}
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[0.875rem]" style={{ color: "var(--text)" }}>
              {title}
            </span>
            <span className="block truncate text-[0.75rem]" style={{ color: "var(--text-faint)" }}>
              {isMove
                ? /card payment/i.test(entry.description)
                  ? "Card payment"
                  : "Moved money"
                : [
                    entry.category ? financeCategoryLook(entry.category).label : out ? "No category" : null,
                    entry.accountName,
                    potName ? `from ${potName}` : null,
                    entry.byName ? entry.byName.split(" ")[0] : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
              {entry.status === "pending" ? (
                <span style={{ color: "var(--attention)" }}> · not on a statement yet</span>
              ) : entry.status === "locked" ? (
                <span> · matches the bank ✓</span>
              ) : null}
            </span>
          </span>
          <span
            className="shrink-0 text-[0.9375rem] font-medium tabular"
            style={{ color: out || isMove ? "var(--text)" : "var(--positive)" }}
          >
            {out || isMove ? "" : "+"}
            {money(entry.amount)}
          </span>
        </button>
      </div>

      {toSort && !open ? (
        <div className="mt-1.5 pl-10">
          <CategorySelect
            label={`Category for ${entry.description}`}
            categories={categories}
            value={null}
            placeholder="Pick a category…"
            disabled={pending}
            onPick={(value) =>
              start(async () => {
                const r = await setEntryCategory(entry.id, value);
                if (r && !r.ok) setError(r.error);
              })
            }
            className="field max-w-[12rem] text-[0.8125rem]"
          />
        </div>
      ) : null}

      {open && isMove ? (
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <p className="text-[0.75rem]" style={{ color: "var(--text-faint)" }}>
            Moving money between your own accounts never counts as spending.
          </p>
          {entry.status === "locked" ? null : (
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
          )}
        </div>
      ) : open ? (
        entry.status === "locked" ? (
          <p className="mt-2 text-[0.75rem]" style={{ color: "var(--text-faint)" }}>
            This matches a checked statement, so it&rsquo;s locked. You can still change its category.
            <CategorySelect
              label="Category"
              categories={categories}
              value={lockedCategory}
              placeholder="No category"
              disabled={pending}
              onPick={(value) => {
                setLockedCategory(value);
                start(async () => {
                  const r = await setEntryCategory(entry.id, value);
                  if (r && !r.ok) setError(r.error);
                });
              }}
              className="field mt-2 block max-w-[12rem] text-[0.8125rem]"
            />
            {potPicker ? <span className="mt-2 block">{potPicker}</span> : null}
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
            <input type="hidden" name="category" value={formCategory ?? ""} />
            <CategorySelect
              label="Category"
              categories={categories}
              value={formCategory}
              placeholder="No category"
              onPick={setFormCategory}
              className="field"
            />
            <select name="accountId" defaultValue={entry.accountId ?? ""} className="field" aria-label="Account">
              <option value="">No account</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
            <input name="date" type="date" defaultValue={entry.day} className="field" aria-label="Date" />
            {potPicker ? <div className="sm:col-span-2">{potPicker}</div> : null}
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
