"use client";

// The "+" quick-capture sheet. One place to log a purchase, add to a shared
// list, jot a task or start a timer, from any page, without loading the full
// tool page. Opened by the centre "+" in the phone tab bar, the sidebar's
// "New" button, or `openQuickCapture()` from anywhere on the client.
//
// Data (accounts, shops, categories, lists, recent timers) is fetched when
// the sheet first opens and refreshed on every open; the last copy shows
// immediately so the sheet never waits on the network to appear.
//
// Logging money uses a built-in number pad on phones so the system keyboard
// never covers the form; on desktop the amount field takes typed digits.

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { filterMerchants, parseAmountInput, type MerchantSuggestion } from "@/lib/finance-entries";
import { inferCategory } from "@/lib/finance-categories";
import {
  applyKeypadKey,
  captureModes,
  financeCategoryLook,
  formatTypedAmount,
  initialCaptureMode,
  type CaptureMode,
  type KeypadKey,
} from "@/lib/quick-capture";
import { addFinanceEntry, addFinanceMove, deleteFinanceEntry } from "../finance/actions";
import { UndoToast, type UndoToastState } from "../finance/_components/undo-toast";
import { addItems } from "../home/actions";
import { createDoItemAction } from "../do/actions";
import { startEntry } from "../time/actions";
import { categoryColor } from "@/lib/time-categories";
import { loadQuickCapture, type QuickCaptureData } from "./quick-capture-actions";
import { useBodyScrollLock } from "./use-body-scroll-lock";

const OPEN_EVENT = "aucosto:quick-capture";
const MODE_KEY = "aucosto.quickCapture.mode";
const LIST_KEY = "aucosto.quickCapture.list";

/** Open the sheet from anywhere on the client, optionally on one tab. */
export function openQuickCapture(mode?: CaptureMode) {
  window.dispatchEvent(new CustomEvent(OPEN_EVENT, { detail: { mode } }));
}

function readStore(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}
function writeStore(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Storage blocked (private mode): remembering the tab is a convenience.
  }
}

function localDateKey(offsetDays = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const MODE_LABEL: Record<CaptureMode, string> = {
  spend: "Money",
  list: "List",
  task: "Task",
  timer: "Timer",
};

export function QuickCaptureHost({
  financeVisible,
  isPartner,
}: {
  financeVisible: boolean;
  isPartner: boolean;
}) {
  const modes = useMemo(() => captureModes({ financeVisible, isPartner }), [financeVisible, isPartner]);
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<CaptureMode>(modes[0] ?? "list");
  const [data, setData] = useState<QuickCaptureData | null>(null);
  const [toast, setToast] = useState<UndoToastState>(null);
  const closeToast = useCallback(() => setToast(null), []);
  useBodyScrollLock(open);

  const refresh = useCallback(() => {
    loadQuickCapture()
      .then(setData)
      .catch(() => setData((d) => d ?? { finance: null, lists: [], timers: [] }));
  }, []);

  useEffect(() => {
    const onOpen = (event: Event) => {
      const wanted = (event as CustomEvent<{ mode?: CaptureMode }>).detail?.mode;
      setMode(initialCaptureMode(modes, wanted ?? readStore(MODE_KEY)));
      setOpen(true);
      refresh();
    };
    window.addEventListener(OPEN_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_EVENT, onOpen);
  }, [modes, refresh]);

  // "N" anywhere (outside a text field) opens the sheet on desktop.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (open || event.key.toLowerCase() !== "n" || event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))) return;
      if (document.querySelector('[aria-modal="true"]')) return;
      event.preventDefault();
      setMode(initialCaptureMode(modes, readStore(MODE_KEY)));
      setOpen(true);
      refresh();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, modes, refresh]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const pickMode = (next: CaptureMode) => {
    setMode(next);
    writeStore(MODE_KEY, next);
  };

  const done = (next: UndoToastState) => {
    setOpen(false);
    if (next) setToast(next);
  };

  return (
    <>
      {open ? (
        <div className="calendar-modal-backdrop" role="presentation" onClick={() => setOpen(false)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Add something"
            className="calendar-modal quick-capture"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mx-auto mb-3 h-1 w-9 rounded-full sm:hidden" style={{ background: "var(--text-ghost)" }} aria-hidden />
            {modes.length > 1 ? (
              <div className="seg mb-4" role="tablist" aria-label="What to add">
                {modes.map((m) => (
                  <button
                    key={m}
                    type="button"
                    role="tab"
                    aria-selected={mode === m}
                    onClick={() => pickMode(m)}
                    className="seg-item"
                  >
                    {MODE_LABEL[m]}
                  </button>
                ))}
              </div>
            ) : null}

            {mode === "spend" ? (
              data?.finance ? (
                <SpendPanel finance={data.finance} onDone={done} />
              ) : (
                <PanelLoading empty={data !== null} emptyText="Money isn't set up yet." />
              )
            ) : null}
            {mode === "list" ? (
              data ? <ListPanel lists={data.lists} onAdded={refresh} onClose={() => setOpen(false)} /> : <PanelLoading />
            ) : null}
            {mode === "task" ? <TaskPanel onDone={done} /> : null}
            {mode === "timer" ? <TimerPanel timers={data?.timers ?? []} onDone={done} /> : null}
          </div>
        </div>
      ) : null}
      <UndoToast toast={toast} onClose={closeToast} />
    </>
  );
}

function PanelLoading({ empty = false, emptyText = "" }: { empty?: boolean; emptyText?: string }) {
  return (
    <p className="py-10 text-center text-[0.875rem]" style={{ color: "var(--text-faint)" }}>
      {empty ? emptyText : "Loading…"}
    </p>
  );
}

// ── Money ────────────────────────────────────────────────────────────────

type Direction = "out" | "in" | "move";

function SpendPanel({
  finance,
  onDone,
}: {
  finance: NonNullable<QuickCaptureData["finance"]>;
  onDone: (toast: UndoToastState) => void;
}) {
  const { accounts, merchants, categories } = finance;
  const amountRef = useRef<HTMLInputElement>(null);
  const [direction, setDirection] = useState<Direction>("out");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const [accountId, setAccountId] = useState(finance.defaultAccountId ?? "");
  const checkingId = accounts.find((a) => a.kind === "checking")?.id ?? accounts[0]?.id ?? "";
  const [fromId, setFromId] = useState(checkingId);
  const [toId, setToId] = useState(
    accounts.find((a) => a.kind === "credit_card")?.id ?? accounts.find((a) => a.id !== checkingId)?.id ?? "",
  );
  const [dateMode, setDateMode] = useState<"today" | "yesterday" | "other">("today");
  const [otherDate, setOtherDate] = useState("");
  const [showDetails, setShowDetails] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  // Desktop: focus the amount so you can just type. Phones use the keypad.
  useEffect(() => {
    if (window.matchMedia("(pointer: fine)").matches) amountRef.current?.focus();
  }, []);

  const topShops = useMemo(() => merchants.slice(0, 6), [merchants]);
  const typed = useMemo(() => filterMerchants(merchants, description, 4), [merchants, description]);
  const guess = useMemo(() => {
    if (category || !description.trim()) return null;
    const known = merchants.find((m) => m.description.toLowerCase() === description.trim().toLowerCase());
    if (known?.category) return known.category;
    const inferred = inferCategory(description, -1);
    return inferred === "Other" ? null : inferred;
  }, [category, description, merchants]);

  const pickShop = (m: MerchantSuggestion) => {
    setDescription(m.description);
    if (m.category) setCategory(m.category);
    if (m.financeAccountId && accounts.some((a) => a.id === m.financeAccountId)) setAccountId(m.financeAccountId);
  };

  const press = (key: KeypadKey) => {
    setError(null);
    setAmount((current) => applyKeypadKey(current, key));
  };

  const accountName = accounts.find((a) => a.id === accountId)?.name ?? "No account";
  const dateLabel = dateMode === "today" ? "Today" : dateMode === "yesterday" ? "Yesterday" : otherDate || "Pick a day";
  const cents = parseAmountInput(amount);

  const submit = () => {
    setError(null);
    if (cents === null) {
      setError("Type an amount first.");
      return;
    }
    const date = dateMode === "today" ? localDateKey(0) : dateMode === "yesterday" ? localDateKey(-1) : otherDate;
    if (!date) {
      setError("Pick a day.");
      setShowDetails(true);
      return;
    }
    if (direction === "move" && (!fromId || !toId || fromId === toId)) {
      setError("Pick two different accounts.");
      return;
    }
    const chosenCategory = direction === "in" ? "Income" : (category ?? guess);
    start(async () => {
      const result =
        direction === "move"
          ? await addFinanceMove({ amount, fromAccountId: fromId, toAccountId: toId, date })
          : await addFinanceEntry({
              amount,
              direction,
              description,
              category: chosenCategory,
              accountId: accountId || null,
              date,
            });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      onDone({
        id: Date.now(),
        message: result.summary,
        onUndo: async () => {
          await deleteFinanceEntry(result.id);
        },
      });
    });
  };

  const verb = direction === "out" ? "Log" : direction === "in" ? "Add" : "Move";

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
      className="space-y-3"
    >
      <div className="flex justify-center gap-1" role="radiogroup" aria-label="Kind of entry">
        {(
          [
            ["out", "Spent"],
            ["in", "Received"],
            ["move", "Moved"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={direction === value}
            disabled={value === "move" && accounts.length < 2}
            onClick={() => {
              setDirection(value);
              setError(null);
            }}
            className="rounded-full px-3 py-1 text-[0.8125rem] font-medium disabled:opacity-40"
            style={{
              background: direction === value ? "var(--bg-tint-strong)" : "transparent",
              color: direction === value ? "var(--text)" : "var(--text-muted)",
            }}
          >
            {label}
          </button>
        ))}
      </div>

      <label className="block text-center">
        <span className="sr-only">Amount</span>
        <span className="inline-flex items-baseline justify-center gap-0.5">
          <span className="text-[1.5rem] font-semibold" style={{ color: "var(--text-faint)" }}>
            $
          </span>
          <input
            ref={amountRef}
            value={amount}
            onChange={(e) => {
              setError(null);
              setAmount(e.target.value.replace(/[^\d.]/g, ""));
            }}
            inputMode="none"
            placeholder="0"
            aria-label="Amount"
            className="quick-amount tabular max-w-[10ch] bg-transparent text-center text-[2.75rem] font-bold leading-tight tracking-tight outline-none"
            style={{
              color: amount ? "var(--text)" : "var(--text-ghost)",
              width: `${Math.max(1, amount.length) * 0.62 + 0.2}em`,
            }}
          />
        </span>
      </label>

      {direction === "move" ? (
        <div className="space-y-2">
          <AccountChips label="From" accounts={accounts} value={fromId} onChange={setFromId} />
          <AccountChips label="To" accounts={accounts} value={toId} onChange={setToId} />
          <p className="text-[0.75rem]" style={{ color: "var(--text-faint)" }}>
            Card payments, savings and brokerage deposits. Never counts as spending.
          </p>
        </div>
      ) : (
        <>
          <div className="space-y-2">
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={direction === "out" ? "Where? (optional)" : "From? (optional)"}
              autoComplete="off"
              enterKeyHint="done"
              aria-label={direction === "out" ? "Where" : "From"}
              className="field w-full"
            />
            <div className="no-scrollbar -mx-4 flex gap-1.5 overflow-x-auto px-4">
              {(description.trim() ? typed : topShops).map((m) => (
                <button
                  key={m.description}
                  type="button"
                  onClick={() => pickShop(m)}
                  className="chip shrink-0"
                  data-on={description.trim().toLowerCase() === m.description.toLowerCase() || undefined}
                >
                  {m.description}
                </button>
              ))}
            </div>
          </div>

          {direction === "out" ? (
            <div
              className="no-scrollbar -mx-4 grid auto-cols-max grid-flow-col grid-rows-2 gap-1.5 overflow-x-auto px-4"
              role="radiogroup"
              aria-label="Category"
            >
              {categories.map((c) => {
                const look = financeCategoryLook(c);
                const active = category === c;
                const suggested = !category && guess === c;
                return (
                  <button
                    key={c}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => setCategory(active ? null : c)}
                    className="chip"
                    data-on={active || undefined}
                    style={suggested ? { borderColor: look.color, borderStyle: "dashed" } : undefined}
                  >
                    {look.emoji ? (
                      <span aria-hidden>{look.emoji}</span>
                    ) : (
                      <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: look.color }} aria-hidden />
                    )}
                    {look.label}
                  </button>
                );
              })}
            </div>
          ) : null}
        </>
      )}

      <div className="flex items-center gap-2 text-[0.8125rem]" style={{ color: "var(--text-muted)" }}>
        <span className="min-w-0 truncate">
          {dateLabel}
          {direction !== "move" ? ` · ${accountName}` : ""}
        </span>
        <button
          type="button"
          onClick={() => setShowDetails((v) => !v)}
          className="ml-auto shrink-0 underline underline-offset-4"
          aria-expanded={showDetails}
        >
          {showDetails ? "Done" : "Change"}
        </button>
      </div>

      {showDetails ? (
        <div className="space-y-2 rounded-md p-3" style={{ background: "var(--bg-tint)" }}>
          <div className="flex flex-wrap items-center gap-1.5" role="radiogroup" aria-label="Day">
            {(["today", "yesterday", "other"] as const).map((d) => (
              <button
                key={d}
                type="button"
                role="radio"
                aria-checked={dateMode === d}
                onClick={() => setDateMode(d)}
                className="chip"
                data-on={dateMode === d || undefined}
              >
                {d === "today" ? "Today" : d === "yesterday" ? "Yesterday" : "Other day"}
              </button>
            ))}
            {dateMode === "other" ? (
              <input
                type="date"
                value={otherDate}
                onChange={(e) => setOtherDate(e.target.value)}
                aria-label="Day"
                className="field max-w-[10rem] py-1"
              />
            ) : null}
          </div>
          {direction !== "move" && accounts.length > 0 ? (
            <AccountChips label="Paid with" accounts={accounts} value={accountId} onChange={setAccountId} allowNone />
          ) : null}
        </div>
      ) : null}

      <Keypad onPress={press} />

      {error ? (
        <p className="text-[0.8125rem]" style={{ color: "var(--attention)" }} role="alert">
          {error}
        </p>
      ) : direction === "out" && cents !== null && !category && !guess ? (
        <p className="text-[0.75rem]" style={{ color: "var(--text-faint)" }}>
          No category is fine. It waits in &ldquo;To sort&rdquo;.
        </p>
      ) : null}

      <button type="submit" disabled={pending || cents === null} className="btn-ink w-full justify-center py-3 text-[0.9375rem]">
        {pending
          ? "Saving…"
          : cents === null
            ? `${verb} it`
            : `${verb} $${formatTypedAmount((cents / 100).toFixed(2))}${
                direction === "out" && (category ?? guess) ? ` · ${financeCategoryLook(category ?? guess).label}` : ""
              }`}
      </button>
    </form>
  );
}

function AccountChips({
  label,
  accounts,
  value,
  onChange,
  allowNone = false,
}: {
  label: string;
  accounts: Array<{ id: string; name: string }>;
  value: string;
  onChange: (id: string) => void;
  allowNone?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5" role="radiogroup" aria-label={label}>
      <span className="mr-1 text-[0.75rem]" style={{ color: "var(--text-faint)" }}>
        {label}
      </span>
      {accounts.map((a) => (
        <button
          key={a.id}
          type="button"
          role="radio"
          aria-checked={value === a.id}
          onClick={() => onChange(a.id)}
          className="chip"
          data-on={value === a.id || undefined}
        >
          {a.name}
        </button>
      ))}
      {allowNone ? (
        <button
          type="button"
          role="radio"
          aria-checked={value === ""}
          onClick={() => onChange("")}
          className="chip"
          data-on={value === "" || undefined}
        >
          None
        </button>
      ) : null}
    </div>
  );
}

const KEYS: KeypadKey[] = ["1", "2", "3", "4", "5", "6", "7", "8", "9", ".", "0", "back"];

function Keypad({ onPress }: { onPress: (key: KeypadKey) => void }) {
  return (
    <div className="quick-keypad grid grid-cols-3 gap-1.5" aria-label="Number pad">
      {KEYS.map((key) => (
        <button
          key={key}
          type="button"
          onClick={() => onPress(key)}
          aria-label={key === "back" ? "Delete" : key}
          className="h-12 rounded-lg text-[1.25rem] font-medium tabular active:opacity-60"
          style={{ background: "var(--bg-tint-strong)", color: "var(--text)" }}
        >
          {key === "back" ? "⌫" : key}
        </button>
      ))}
    </div>
  );
}

// ── Lists ────────────────────────────────────────────────────────────────

function ListPanel({
  lists,
  onAdded,
  onClose,
}: {
  lists: QuickCaptureData["lists"];
  onAdded: () => void;
  onClose: () => void;
}) {
  const [listId, setListId] = useState(() => {
    const remembered = readStore(LIST_KEY);
    return lists.find((l) => l.id === remembered)?.id ?? lists[0]?.id ?? "";
  });
  const [text, setText] = useState("");
  const [added, setAdded] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (window.matchMedia("(pointer: fine)").matches) inputRef.current?.focus();
  }, []);

  if (lists.length === 0) {
    return (
      <div className="space-y-3 py-6 text-center">
        <p className="text-[0.875rem]" style={{ color: "var(--text-muted)" }}>
          No shared lists yet.
        </p>
        <Link href="/app/home" onClick={onClose} className="btn-ink inline-flex">
          Make a list
        </Link>
      </div>
    );
  }

  const list = lists.find((l) => l.id === listId);
  const submit = () => {
    const raw = text.trim();
    if (!raw || !listId) return;
    setError(null);
    start(async () => {
      const result = await addItems(listId, raw);
      if (result && !result.ok) {
        setError(result.error);
        return;
      }
      const count = raw.split(/[,\n]/).filter((s) => s.trim()).length;
      setAdded(`Added ${count === 1 ? raw : `${count} items`} to ${list?.name ?? "the list"}`);
      setText("");
      writeStore(LIST_KEY, listId);
      onAdded();
      inputRef.current?.focus();
    });
  };

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
      className="space-y-3"
    >
      <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="List">
        {lists.map((l) => (
          <button
            key={l.id}
            type="button"
            role="radio"
            aria-checked={listId === l.id}
            onClick={() => {
              setListId(l.id);
              setAdded(null);
            }}
            className="chip"
            data-on={listId === l.id || undefined}
          >
            {l.emoji ? <span aria-hidden>{l.emoji}</span> : null}
            {l.name}
            {l.open ? <span style={{ opacity: 0.6 }}>· {l.open}</span> : null}
          </button>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          ref={inputRef}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setAdded(null);
          }}
          placeholder="Milk, eggs, paper towels"
          aria-label="Items to add"
          enterKeyHint="send"
          autoComplete="off"
          className="field flex-1"
        />
        <button type="submit" disabled={pending || !text.trim()} className="btn-ink shrink-0">
          {pending ? "Adding…" : "Add"}
        </button>
      </div>
      <p className="text-[0.75rem]" style={{ color: error ? "var(--attention)" : "var(--text-faint)" }} role={error ? "alert" : "status"}>
        {error ?? added ?? "Separate items with commas to add several at once."}
      </p>
    </form>
  );
}

// ── Task ─────────────────────────────────────────────────────────────────

function TaskPanel({ onDone }: { onDone: (toast: UndoToastState) => void }) {
  const [title, setTitle] = useState("");
  const [lane, setLane] = useState<"today" | "next">("today");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const submit = () => {
    if (!title.trim()) return;
    start(async () => {
      const form = new FormData();
      form.set("title", title.trim());
      form.set("lane", lane);
      const result = await createDoItemAction(undefined, form);
      if (result && "error" in result && result.error) {
        setError(result.error);
        return;
      }
      onDone({ id: Date.now(), message: `Added “${title.trim()}” to ${lane === "today" ? "today" : "next up"}` });
    });
  };
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
      className="space-y-3"
    >
      <input
        autoFocus
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="What needs doing?"
        aria-label="Task"
        enterKeyHint="done"
        className="field w-full"
      />
      <div className="flex items-center gap-1.5" role="radiogroup" aria-label="When">
        {(
          [
            ["today", "Today"],
            ["next", "Next up"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={lane === value}
            onClick={() => setLane(value)}
            className="chip"
            data-on={lane === value || undefined}
          >
            {label}
          </button>
        ))}
        <button type="submit" disabled={pending || !title.trim()} className="btn-ink ml-auto">
          {pending ? "Adding…" : "Add task"}
        </button>
      </div>
      {error ? (
        <p className="text-[0.8125rem]" style={{ color: "var(--attention)" }} role="alert">
          {error}
        </p>
      ) : null}
    </form>
  );
}

// ── Timer ────────────────────────────────────────────────────────────────

function TimerPanel({
  timers,
  onDone,
}: {
  timers: QuickCaptureData["timers"];
  onDone: (toast: UndoToastState) => void;
}) {
  const [label, setLabel] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const go = (value: string, category: string | null) => {
    if (!value.trim()) return;
    start(async () => {
      const form = new FormData();
      form.set("label", value.trim());
      if (category) form.set("category", category);
      const result = await startEntry(undefined, form);
      if (result?.error) {
        setError(result.error);
        return;
      }
      onDone({ id: Date.now(), message: `Started “${value.trim()}”` });
    });
  };
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        go(label, null);
      }}
      className="space-y-3"
    >
      <div className="flex gap-2">
        <input
          autoFocus
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="What are you starting?"
          aria-label="Timer label"
          enterKeyHint="go"
          className="field flex-1"
        />
        <button type="submit" disabled={pending || !label.trim()} className="btn-ink shrink-0">
          Start
        </button>
      </div>
      {timers.length ? (
        <div className="flex flex-wrap gap-1.5">
          {timers.map((t) => (
            <button key={t.label} type="button" disabled={pending} onClick={() => go(t.label, t.category)} className="chip">
              <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: categoryColor(t.category) }} aria-hidden />
              {t.label}
            </button>
          ))}
        </div>
      ) : null}
      <p className="text-[0.75rem]" style={{ color: error ? "var(--attention)" : "var(--text-faint)" }}>
        {error ?? "Starting stops whatever is running. "}
        {!error ? (
          <Link href="/app/time" className="underline underline-offset-4">
            Open Time
          </Link>
        ) : null}
      </p>
    </form>
  );
}
