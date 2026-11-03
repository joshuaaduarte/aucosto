"use client";

// The "+" quick-capture sheet: one way in to adding anything, from any page,
// without loading the full tool page. It opens on a "What are you adding?"
// chooser built from the tools in the viewer's menu (a partner gets only
// Home and Money entries), with the current page's entry suggested first. Opened by the centre "+" in the phone tab bar, the sidebar's
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
import { usePathname } from "next/navigation";
import { HOME_TASK_PRESETS, type HomeTaskKind } from "@/lib/home";
import {
  addMinutesToClock,
  applyKeypadKey,
  captureEntries,
  financeCategoryLook,
  formatTypedAmount,
  hourCaptureMode,
  nextHalfHour,
  peopleToOffer,
  rememberCaptureMode,
  suggestCaptureModes,
  type CaptureEntry,
  type CaptureMode,
  type KeypadKey,
} from "@/lib/quick-capture";
import { addFinanceEntry, addFinanceMove, deleteFinanceEntry } from "../finance/actions";
import { UndoToast, type UndoToastState } from "../finance/_components/undo-toast";
import { addItems, completeTask, saveTask } from "../home/actions";
import { createDoItemAction } from "../do/actions";
import { startEntry } from "../time/actions";
import { createCalendarBlockAction } from "../calendar/actions";
import { logHabitDone } from "../habits/actions";
import { saveReflectionAction } from "../reflect/actions";
import { addInteractionAction } from "../rolodex/actions";
import { createNoteAction } from "../work/actions";
import { MOOD_SCALE, RATING_FIELDS, type ReflectionRatingField } from "@/lib/reflect";
import { wallClockWindow } from "@/lib/wall-clock";
import { categoryColor } from "@/lib/time-categories";
import { NAV_GROUPS, NAV_TOOLS, visibleTools } from "./nav-model";
import { loadQuickCapture, type QuickCaptureData } from "./quick-capture-actions";
import { useBodyScrollLock } from "./use-body-scroll-lock";

const OPEN_EVENT = "aucosto:quick-capture";
const RECENT_KEY = "aucosto.quickCapture.recent";
const LIST_KEY = "aucosto.quickCapture.list";

/** Open the sheet from anywhere on the client: on the chooser, or straight on one form. */
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

function readRecent(): string[] {
  try {
    const parsed: unknown = JSON.parse(readStore(RECENT_KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((m): m is string => typeof m === "string") : [];
  } catch {
    return [];
  }
}

const EMPTY_DATA: QuickCaptureData = {
  finance: null,
  lists: [],
  chores: [],
  timers: [],
  habits: [],
  reflectedToday: false,
  people: [],
  work: null,
};

export function QuickCaptureHost({
  financeVisible,
  isPartner,
}: {
  financeVisible: boolean;
  isPartner: boolean;
}) {
  const pathname = usePathname();
  // Same rule as the menu: an entry shows only if its tool is in this
  // person's menu (a partner's menu is Home + Money).
  const allEntries = useMemo(
    () => captureEntries(visibleTools({ showFinance: financeVisible, isPartner }).map((tool) => tool.href)),
    [financeVisible, isPartner],
  );
  const [open, setOpen] = useState(false);
  const [hour, setHour] = useState(12);
  /** null = the chooser. */
  const [mode, setMode] = useState<CaptureMode | null>(null);
  const [recent, setRecent] = useState<string[]>([]);
  const [data, setData] = useState<QuickCaptureData | null>(null);
  const [toast, setToast] = useState<UndoToastState>(null);
  // "Work note" needs a set-up Work hub; until the data says so it stays hidden.
  const entries = useMemo(
    () => allEntries.filter((entry) => entry.mode !== "work-note" || data?.work),
    [allEntries, data?.work],
  );
  const closeToast = useCallback(() => setToast(null), []);
  useBodyScrollLock(open);

  const refresh = useCallback(() => {
    loadQuickCapture()
      .then(setData)
      .catch(() => setData((d) => d ?? EMPTY_DATA));
  }, []);

  const show = useCallback(
    (wanted?: CaptureMode) => {
      // One entry only: skip the chooser.
      const direct = wanted ?? (allEntries.length === 1 ? allEntries[0]!.mode : undefined);
      setMode(direct && allEntries.some((entry) => entry.mode === direct) ? direct : null);
      setRecent(readRecent());
      setHour(new Date().getHours());
      setOpen(true);
      refresh();
    },
    [allEntries, refresh],
  );

  useEffect(() => {
    const onOpen = (event: Event) => show((event as CustomEvent<{ mode?: CaptureMode }>).detail?.mode);
    window.addEventListener(OPEN_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_EVENT, onOpen);
  }, [show]);

  // "N" anywhere (outside a text field) opens the sheet on desktop.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (open || event.key.toLowerCase() !== "n" || event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))) return;
      if (document.querySelector('[aria-modal="true"]')) return;
      event.preventDefault();
      show();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, show]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      // Escape steps back to the chooser first, then closes.
      if (mode && entries.length > 1) setMode(null);
      else setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, mode, entries.length]);

  const pick = (next: CaptureMode) => {
    setMode(next);
    const updated = rememberCaptureMode(recent, next);
    setRecent(updated);
    writeStore(RECENT_KEY, JSON.stringify(updated));
  };

  const done = (next: UndoToastState) => {
    setOpen(false);
    if (next) setToast(next);
  };

  const entry = entries.find((e) => e.mode === mode) ?? null;

  return (
    <>
      {open ? (
        <div className="calendar-modal-backdrop" role="presentation" onClick={() => setOpen(false)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-label={entry ? entry.label : "Add something"}
            className="calendar-modal quick-capture"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mx-auto mb-3 h-1 w-9 rounded-full sm:hidden" style={{ background: "var(--text-ghost)" }} aria-hidden />

            {entry === null ? (
              <Chooser
                entries={entries}
                pathname={pathname}
                recent={recent}
                hourMode={hourCaptureMode(hour, data?.reflectedToday ?? false)}
                onPick={pick}
              />
            ) : (
              <>
                <div className="mb-3 flex items-center gap-2">
                  {entries.length > 1 ? (
                    <button
                      type="button"
                      className="btn-icon -ml-1.5"
                      onClick={() => setMode(null)}
                      aria-label="Back to everything you can add"
                    >
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                        <path d="M8.5 3 4.5 7l4 4" />
                      </svg>
                    </button>
                  ) : null}
                  <p className="text-[0.9375rem] font-semibold" style={{ color: "var(--text)" }}>
                    <span aria-hidden className="mr-1.5">
                      {entry.emoji}
                    </span>
                    {entry.label}
                  </p>
                </div>

                {entry.mode === "spend" ? (
                  data?.finance ? (
                    <SpendPanel finance={data.finance} onDone={done} />
                  ) : (
                    <PanelLoading empty={data !== null} emptyText="Money isn't set up yet." />
                  )
                ) : null}
                {entry.mode === "list" ? (
                  data ? <ListPanel lists={data.lists} onAdded={refresh} onClose={() => setOpen(false)} /> : <PanelLoading />
                ) : null}
                {entry.mode === "chore-done" ? (
                  data ? (
                    <ChoreDonePanel chores={data.chores} onDone={done} onAddChore={() => pick("chore-new")} />
                  ) : (
                    <PanelLoading />
                  )
                ) : null}
                {entry.mode === "chore-new" ? <ChoreNewPanel onDone={done} /> : null}
                {entry.mode === "task" ? <TaskPanel onDone={done} /> : null}
                {entry.mode === "timer" ? <TimerPanel timers={data?.timers ?? []} onDone={done} /> : null}
                {entry.mode === "event" ? <EventPanel onDone={done} /> : null}
                {entry.mode === "habit" ? data ? <HabitPanel habits={data.habits} onDone={done} /> : <PanelLoading /> : null}
                {entry.mode === "reflect" ? (
                  data ? <ReflectPanel reflectedToday={data.reflectedToday} onDone={done} /> : <PanelLoading />
                ) : null}
                {entry.mode === "person" ? data ? <PersonPanel people={data.people} onDone={done} /> : <PanelLoading /> : null}
                {entry.mode === "work-note" ? (
                  data?.work ? <WorkNotePanel work={data.work} onDone={done} /> : <PanelLoading empty={data !== null} emptyText="Set up Work first." />
                ) : null}
              </>
            )}
          </div>
        </div>
      ) : null}
      <UndoToast toast={toast} onClose={closeToast} />
    </>
  );
}

// ── Chooser ──────────────────────────────────────────────────────────────

const GROUP_OF_TOOL = new Map(NAV_TOOLS.map((tool) => [tool.href, tool.group]));

function Chooser({
  entries,
  pathname,
  recent,
  hourMode,
  onPick,
}: {
  entries: CaptureEntry[];
  pathname: string;
  recent: string[];
  hourMode?: CaptureMode;
  onPick: (mode: CaptureMode) => void;
}) {
  const suggested = suggestCaptureModes({ available: entries.map((e) => e.mode), pathname, recent, hourMode })
    .map((mode) => entries.find((e) => e.mode === mode)!)
    .filter(Boolean);
  // A short menu (a partner's four entries) is one grid, page's pick first.
  const short = entries.length <= 4;
  const ordered = short ? [...suggested, ...entries.filter((e) => !suggested.includes(e))] : entries;
  const groups = NAV_GROUPS.map((group) => ({
    ...group,
    entries: entries.filter((e) => GROUP_OF_TOOL.get(e.tool) === group.id),
  })).filter((group) => group.entries.length > 0);

  return (
    <div className="space-y-4">
      <p className="text-[0.9375rem] font-semibold" style={{ color: "var(--text)" }}>
        What are you adding?
      </p>
      {short ? (
        <div className="grid grid-cols-2 gap-2">
          {ordered.map((e) => (
            <ChooserTile key={e.mode} entry={e} big onPick={onPick} />
          ))}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-2" aria-label="Suggested">
            {suggested.map((e) => (
              <ChooserTile key={e.mode} entry={e} big onPick={onPick} />
            ))}
          </div>
          {groups.map((group) => (
            <section key={group.id}>
              <p className="text-[0.6875rem] font-semibold uppercase tracking-wider" style={{ color: "var(--text-faint)" }}>
                {group.label}
              </p>
              <div className="mt-1.5 grid grid-cols-2 gap-1.5">
                {group.entries.map((e) => (
                  <ChooserTile key={e.mode} entry={e} onPick={onPick} />
                ))}
              </div>
            </section>
          ))}
        </>
      )}
    </div>
  );
}

function ChooserTile({ entry, big = false, onPick }: { entry: CaptureEntry; big?: boolean; onPick: (mode: CaptureMode) => void }) {
  return (
    <button
      type="button"
      onClick={() => onPick(entry.mode)}
      className={
        big
          ? "flex flex-col items-start gap-1.5 rounded-xl border px-3 py-3 text-left text-[0.875rem] font-semibold transition-colors hover:bg-bg-hover active:opacity-70"
          : "flex items-center gap-2 rounded-lg border px-3 py-2.5 text-left text-[0.8125rem] font-medium transition-colors hover:bg-bg-hover active:opacity-70"
      }
      style={{ borderColor: "var(--border-faint)", background: big ? "var(--bg-tint)" : "var(--bg-page)", color: "var(--text)" }}
    >
      <span aria-hidden className={big ? "text-[1.375rem] leading-none" : "text-[1rem] leading-none"}>
        {entry.emoji}
      </span>
      {entry.label}
    </button>
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

// ── Home: chore done ─────────────────────────────────────────────────────

function ChoreDonePanel({
  chores,
  onDone,
  onAddChore,
}: {
  chores: QuickCaptureData["chores"];
  onDone: (toast: UndoToastState) => void;
  onAddChore: () => void;
}) {
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, start] = useTransition();

  if (chores.length === 0) {
    return (
      <div className="space-y-3 py-6 text-center">
        <p className="text-[0.875rem]" style={{ color: "var(--text-muted)" }}>
          No chores tracked yet.
        </p>
        <button type="button" onClick={onAddChore} className="btn-ink inline-flex">
          Add a chore
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <ul className="rounded-lg border" style={{ borderColor: "var(--border-soft)" }}>
        {chores.map((chore) => {
          const due = chore.daysUntil <= 0;
          return (
            <li key={chore.id} className="border-t first:border-t-0" style={{ borderColor: "var(--border-faint)" }}>
              <button
                type="button"
                disabled={pendingId !== null}
                onClick={() => {
                  setPendingId(chore.id);
                  setError(null);
                  start(async () => {
                    const result = await completeTask(chore.id);
                    setPendingId(null);
                    if (result && !result.ok) {
                      setError(result.error);
                      return;
                    }
                    onDone({ id: Date.now(), message: `Marked “${chore.title}” done` });
                  });
                }}
                className="flex w-full items-center gap-3 px-3 py-3 text-left hover:bg-bg-hover"
              >
                <span className="list-check" aria-hidden data-checked={pendingId === chore.id || undefined} />
                <span className="min-w-0 flex-1 truncate text-[0.9375rem]" style={{ color: "var(--text)", fontWeight: due ? 600 : 400 }}>
                  {chore.title}
                </span>
                <span className="shrink-0 text-[0.75rem]" style={{ color: due ? "var(--attention)" : "var(--text-faint)" }}>
                  {chore.dueLabel}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      <p className="text-[0.75rem]" style={{ color: error ? "var(--attention)" : "var(--text-faint)" }} role={error ? "alert" : undefined}>
        {error ?? "Tap one to mark it done. It comes back when it's due again."}
      </p>
    </div>
  );
}

// ── Home: new chore ──────────────────────────────────────────────────────

const CADENCES: Array<[days: number, label: string]> = [
  [7, "Weekly"],
  [14, "Every 2 weeks"],
  [30, "Monthly"],
  [90, "Every 3 months"],
  [365, "Yearly"],
];

function ChoreNewPanel({ onDone }: { onDone: (toast: UndoToastState) => void }) {
  const [kind, setKind] = useState<HomeTaskKind>("chore");
  const [title, setTitle] = useState("");
  const [cadence, setCadence] = useState(7);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const presets = HOME_TASK_PRESETS.filter((preset) => preset.kind === kind).slice(0, 4);

  const submit = () => {
    if (!title.trim()) return;
    setError(null);
    start(async () => {
      const form = new FormData();
      form.set("kind", kind);
      form.set("title", title.trim());
      form.set("cadenceDays", String(cadence));
      form.set("nextDueAt", localDateKey(cadence));
      const result = await saveTask(undefined, form);
      if (result && !result.ok) {
        setError(result.error);
        return;
      }
      onDone({ id: Date.now(), message: `Tracking “${title.trim()}”` });
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
      <div className="seg" role="radiogroup" aria-label="Kind">
        {(
          [
            ["chore", "Chore"],
            ["maintenance", "Upkeep"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={kind === value}
            className="seg-item"
            onClick={() => {
              setKind(value);
              setCadence(value === "chore" ? 7 : 90);
            }}
          >
            {label}
          </button>
        ))}
      </div>
      <input
        autoFocus
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder={kind === "chore" ? "Water the plants" : "Replace HVAC filter"}
        aria-label="Name"
        enterKeyHint="done"
        className="field w-full"
      />
      <div className="flex flex-wrap gap-1.5">
        {presets.map((preset) => (
          <button
            key={preset.title}
            type="button"
            className="chip"
            data-on={title === preset.title || undefined}
            onClick={() => {
              setTitle(preset.title);
              setCadence(preset.cadenceDays);
            }}
          >
            {preset.title}
          </button>
        ))}
      </div>
      <div>
        <p className="mb-1.5 text-[0.75rem] font-medium" style={{ color: "var(--text-muted)" }}>
          How often
        </p>
        <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="How often">
          {CADENCES.map(([days, label]) => (
            <button
              key={days}
              type="button"
              role="radio"
              aria-checked={cadence === days}
              className="chip"
              data-on={cadence === days || undefined}
              onClick={() => setCadence(days)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <div className="flex items-center justify-between gap-2 pt-1">
        <p className="text-[0.75rem]" style={{ color: error ? "var(--attention)" : "var(--text-faint)" }} role={error ? "alert" : undefined}>
          {error ?? "First due one cycle from today."}
        </p>
        <button type="submit" disabled={pending || !title.trim()} className="btn-ink shrink-0">
          {pending ? "Saving…" : "Track it"}
        </button>
      </div>
    </form>
  );
}

// ── Calendar: event ──────────────────────────────────────────────────────

const DURATIONS: Array<[minutes: number, label: string]> = [
  [30, "30 min"],
  [60, "1 hour"],
  [120, "2 hours"],
];

function EventPanel({ onDone }: { onDone: (toast: UndoToastState) => void }) {
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(() => localDateKey());
  const [start, setStart] = useState(() => nextHalfHour(new Date()));
  const [minutes, setMinutes] = useState(60);
  const [error, setError] = useState<string | null>(null);
  const [pending, run] = useTransition();
  const today = localDateKey();
  const tomorrow = localDateKey(1);

  const submit = () => {
    if (!title.trim()) return;
    const end = addMinutesToClock(start, minutes);
    // Wall-clock → absolute time here, in the browser's timezone (lessons #10).
    const span = wallClockWindow(date, start, end);
    if (!span) {
      setError("Pick a day and a start time.");
      return;
    }
    setError(null);
    run(async () => {
      const form = new FormData();
      form.set("title", title.trim());
      form.set("date", date);
      form.set("start", start);
      form.set("end", end);
      form.set("startsAtIso", span.startsAt.toISOString());
      form.set("endsAtIso", span.endsAt.toISOString());
      try {
        await createCalendarBlockAction(form);
      } catch {
        setError("Couldn't add the event. Try again.");
        return;
      }
      const when = date === today ? "today" : date === tomorrow ? "tomorrow" : date;
      const at = span.startsAt.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
      onDone({ id: Date.now(), message: `Added “${title.trim()}” ${when} at ${at}` });
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
        placeholder="Dinner with Sam"
        aria-label="Event"
        enterKeyHint="done"
        className="field w-full"
      />
      <div className="flex flex-wrap items-center gap-1.5" role="radiogroup" aria-label="Day">
        {(
          [
            [today, "Today"],
            [tomorrow, "Tomorrow"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={label}
            type="button"
            role="radio"
            aria-checked={date === value}
            className="chip"
            data-on={date === value || undefined}
            onClick={() => setDate(value)}
          >
            {label}
          </button>
        ))}
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          aria-label="Date"
          className="field ml-auto w-auto"
        />
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <input
          type="time"
          value={start}
          onChange={(e) => setStart(e.target.value)}
          aria-label="Start time"
          className="field w-auto"
        />
        <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="How long">
          {DURATIONS.map(([value, label]) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={minutes === value}
              className="chip"
              data-on={minutes === value || undefined}
              onClick={() => setMinutes(value)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <div className="flex items-center justify-between gap-2 pt-1">
        <p className="text-[0.75rem]" style={{ color: error ? "var(--attention)" : "var(--text-faint)" }} role={error ? "alert" : undefined}>
          {error ?? (
            <Link href="/app/calendar" className="underline underline-offset-4">
              More options in Calendar
            </Link>
          )}
        </p>
        <button type="submit" disabled={pending || !title.trim() || !start} className="btn-ink shrink-0">
          {pending ? "Adding…" : "Add event"}
        </button>
      </div>
    </form>
  );
}

// ── Habits: done ─────────────────────────────────────────────────────────

function HabitPanel({ habits, onDone }: { habits: QuickCaptureData["habits"]; onDone: (toast: UndoToastState) => void }) {
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, run] = useTransition();

  if (habits.length === 0) {
    return (
      <div className="space-y-2 py-6 text-center">
        <p className="text-[0.875rem]" style={{ color: "var(--text-muted)" }}>
          Nothing left for today. Nice.
        </p>
        <Link href="/app/habits" className="text-[0.8125rem] underline underline-offset-4" style={{ color: "var(--text-faint)" }}>
          Open Habits
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <ul className="rounded-lg border" style={{ borderColor: "var(--border-soft)" }}>
        {habits.map((habit) => (
          <li key={habit.id} className="border-t first:border-t-0" style={{ borderColor: "var(--border-faint)" }}>
            <button
              type="button"
              disabled={pendingId !== null}
              onClick={() => {
                setPendingId(habit.id);
                setError(null);
                run(async () => {
                  try {
                    await logHabitDone(habit.id);
                  } catch {
                    setPendingId(null);
                    setError("Couldn't log it. Try again.");
                    return;
                  }
                  setPendingId(null);
                  onDone({ id: Date.now(), message: `Logged “${habit.title}”` });
                });
              }}
              className="flex w-full items-center gap-3 px-3 py-3 text-left hover:bg-bg-hover"
            >
              <span className="list-check" aria-hidden data-checked={pendingId === habit.id || undefined} />
              <span className="min-w-0 flex-1 truncate text-[0.9375rem]" style={{ color: "var(--text)" }}>
                {habit.title}
              </span>
              <span className="shrink-0 text-[0.75rem]" style={{ color: "var(--text-faint)" }}>
                {habit.targetLabel}
              </span>
            </button>
          </li>
        ))}
      </ul>
      <p className="text-[0.75rem]" style={{ color: error ? "var(--attention)" : "var(--text-faint)" }} role={error ? "alert" : undefined}>
        {error ?? "Due today and not done yet. Tap one to log it."}
      </p>
    </div>
  );
}

// ── Reflect: how was today ───────────────────────────────────────────────

function ReflectPanel({ reflectedToday, onDone }: { reflectedToday: boolean; onDone: (toast: UndoToastState) => void }) {
  const [ratings, setRatings] = useState<Partial<Record<ReflectionRatingField, number>>>({});
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, run] = useTransition();

  if (reflectedToday) {
    return (
      <div className="space-y-2 py-6 text-center">
        <p className="text-[0.875rem]" style={{ color: "var(--text-muted)" }}>
          You already reflected on today.
        </p>
        <Link href="/app/reflect" className="text-[0.8125rem] underline underline-offset-4" style={{ color: "var(--text-faint)" }}>
          Open Reflect to change it
        </Link>
      </div>
    );
  }

  const complete = RATING_FIELDS.every(({ field }) => ratings[field]);
  const submit = () => {
    if (!complete) return;
    setError(null);
    run(async () => {
      const form = new FormData();
      for (const { field } of RATING_FIELDS) form.set(field, String(ratings[field]));
      if (note.trim()) form.set("wentWell", note.trim());
      const result = await saveReflectionAction(undefined, form);
      if (result && "error" in result && result.error) {
        setError(result.error);
        return;
      }
      onDone({ id: Date.now(), message: "Saved today's reflection" });
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
      {RATING_FIELDS.map(({ field, label }) => (
        <div key={field} className="flex items-center gap-2">
          <p className="w-24 shrink-0 text-[0.8125rem]" style={{ color: "var(--text-muted)" }}>
            {label}
          </p>
          <div className="grid flex-1 grid-cols-5 gap-1" role="radiogroup" aria-label={label}>
            {MOOD_SCALE.map((step) => {
              const on = ratings[field] === step.value;
              return (
                <button
                  key={step.value}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  aria-label={`${step.value}, ${step.label}`}
                  title={step.label}
                  onClick={() => setRatings((r) => ({ ...r, [field]: step.value }))}
                  className="rounded-lg border py-1.5 text-center text-[1rem] leading-none transition-colors"
                  style={{
                    borderColor: on ? step.color : "var(--border-faint)",
                    background: on ? `color-mix(in srgb, ${step.color} 16%, transparent)` : "var(--bg-page)",
                  }}
                >
                  {field === "mood" ? step.emoji : <span className="text-[0.8125rem] font-medium" style={{ color: "var(--text)" }}>{step.value}</span>}
                </button>
              );
            })}
          </div>
        </div>
      ))}
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="One thing that went well (optional)"
        aria-label="One thing that went well"
        rows={2}
        className="field w-full resize-none"
      />
      <div className="flex items-center justify-between gap-2">
        <p className="text-[0.75rem]" style={{ color: error ? "var(--attention)" : "var(--text-faint)" }} role={error ? "alert" : undefined}>
          {error ?? (complete ? "Today's tracked time and tasks are saved with it." : "Pick 1 to 5 for each.")}
        </p>
        <button type="submit" disabled={pending || !complete} className="btn-ink shrink-0">
          {pending ? "Saving…" : "Save"}
        </button>
      </div>
    </form>
  );
}

// ── Rolodex: note about someone ──────────────────────────────────────────

function PersonPanel({ people, onDone }: { people: QuickCaptureData["people"]; onDone: (toast: UndoToastState) => void }) {
  const [query, setQuery] = useState("");
  const [person, setPerson] = useState<{ id: string; name: string } | null>(null);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, run] = useTransition();
  const matches = peopleToOffer(people, query);

  if (people.length === 0) {
    return (
      <div className="space-y-2 py-6 text-center">
        <p className="text-[0.875rem]" style={{ color: "var(--text-muted)" }}>
          No one in your Rolodex yet.
        </p>
        <Link href="/app/rolodex/new" className="text-[0.8125rem] underline underline-offset-4" style={{ color: "var(--text-faint)" }}>
          Add someone
        </Link>
      </div>
    );
  }

  if (!person) {
    return (
      <div className="space-y-2">
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Who is it about?"
          aria-label="Search people"
          className="field w-full"
        />
        <ul className="rounded-lg border" style={{ borderColor: "var(--border-soft)" }}>
          {matches.map((match) => (
            <li key={match.id} className="border-t first:border-t-0" style={{ borderColor: "var(--border-faint)" }}>
              <button
                type="button"
                onClick={() => setPerson(match)}
                className="flex w-full items-center px-3 py-2.5 text-left text-[0.9375rem] hover:bg-bg-hover"
                style={{ color: "var(--text)" }}
              >
                {match.name}
              </button>
            </li>
          ))}
          {matches.length === 0 ? (
            <li className="px-3 py-2.5 text-[0.8125rem]" style={{ color: "var(--text-faint)" }}>
              No one called “{query.trim()}”.
            </li>
          ) : null}
        </ul>
      </div>
    );
  }

  const submit = () => {
    const text = note.trim();
    if (!text) return;
    setError(null);
    // The first line is the interaction's title; a longer note keeps the full text as its body.
    const firstLine = text.split("\n")[0]!.trim();
    const title = firstLine.length > 120 ? `${firstLine.slice(0, 117)}…` : firstLine;
    run(async () => {
      const result = await addInteractionAction(person.id, title, text === title ? undefined : text);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      onDone({ id: Date.now(), message: `Noted for ${person.name}` });
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
      <div className="flex items-center gap-2">
        <span className="chip" data-on>
          {person.name}
        </span>
        <button type="button" className="text-[0.75rem] underline underline-offset-4" style={{ color: "var(--text-faint)" }} onClick={() => setPerson(null)}>
          Change
        </button>
      </div>
      <textarea
        autoFocus
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Caught up over coffee. Starting a new job in March."
        aria-label="Note"
        rows={3}
        className="field w-full resize-none"
      />
      <div className="flex items-center justify-between gap-2">
        <p className="text-[0.75rem]" style={{ color: error ? "var(--attention)" : "var(--text-faint)" }} role={error ? "alert" : undefined}>
          {error ?? "Saved on their timeline as of today."}
        </p>
        <button type="submit" disabled={pending || !note.trim()} className="btn-ink shrink-0">
          {pending ? "Saving…" : "Save note"}
        </button>
      </div>
    </form>
  );
}

// ── Work: note ───────────────────────────────────────────────────────────

function WorkNotePanel({
  work,
  onDone,
}: {
  work: NonNullable<QuickCaptureData["work"]>;
  onDone: (toast: UndoToastState) => void;
}) {
  const [kind, setKind] = useState<"note" | "decision">("note");
  const [body, setBody] = useState("");
  const [projectId, setProjectId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, run] = useTransition();

  const submit = () => {
    if (!body.trim()) return;
    setError(null);
    run(async () => {
      const form = new FormData();
      form.set("workspaceId", work.workspaceId);
      form.set("kind", kind);
      form.set("body", body.trim());
      if (projectId) form.set("projectId", projectId);
      const result = await createNoteAction(undefined, form);
      if (result?.error) {
        setError(result.error);
        return;
      }
      onDone({ id: Date.now(), message: kind === "decision" ? "Decision saved to Work" : "Note saved to Work" });
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
      <div className="seg" role="radiogroup" aria-label="Kind">
        {(
          [
            ["note", "Note"],
            ["decision", "Decision"],
          ] as const
        ).map(([value, label]) => (
          <button key={value} type="button" role="radio" aria-checked={kind === value} className="seg-item" onClick={() => setKind(value)}>
            {label}
          </button>
        ))}
      </div>
      <textarea
        autoFocus
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder={kind === "decision" ? "We're shipping the beta on the 14th." : "What's on your mind?"}
        aria-label={kind === "decision" ? "Decision" : "Note"}
        rows={3}
        className="field w-full resize-none"
      />
      {work.projects.length ? (
        <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Project">
          {work.projects.map((project) => (
            <button
              key={project.id}
              type="button"
              role="radio"
              aria-checked={projectId === project.id}
              className="chip"
              data-on={projectId === project.id || undefined}
              onClick={() => setProjectId((current) => (current === project.id ? null : project.id))}
            >
              {project.name}
            </button>
          ))}
        </div>
      ) : null}
      <div className="flex items-center justify-between gap-2">
        <p className="text-[0.75rem]" style={{ color: error ? "var(--attention)" : "var(--text-faint)" }} role={error ? "alert" : undefined}>
          {error ?? (work.projects.length ? "Tag a project if it belongs to one." : "Shows up under Work → Notes.")}
        </p>
        <button type="submit" disabled={pending || !body.trim()} className="btn-ink shrink-0">
          {pending ? "Saving…" : "Save"}
        </button>
      </div>
    </form>
  );
}
