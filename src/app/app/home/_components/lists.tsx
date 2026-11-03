"use client";

// Shared lists, one at a time: chips across the top switch lists (with how
// many things are still to get), a big add field takes "milk, eggs" in one
// go, and checked items sink to the bottom until "Clear checked". Who added
// each item shows as a small initial when the list is shared.

import { useActionState, useOptimistic, useRef, useState, useSyncExternalStore, useTransition } from "react";
import { HOME_LIST_PRESETS, personInitial } from "@/lib/home";
import { categoryColor } from "@/lib/time-categories";
import { addItems, clearChecked, createList, deleteList, removeItem, toggleItem } from "../actions";

export type ListView = {
  id: string;
  name: string;
  emoji?: string | null;
  items: Array<{ id: string; title: string; checked: boolean; addedBy: string | null }>;
};

const PICK_KEY = "aucosto.home.list";

const noSubscribe = () => () => {};
function readSavedList(): string | null {
  try {
    return window.localStorage.getItem(PICK_KEY);
  } catch {
    return null;
  }
}

export function HomeLists({ lists, showAttribution }: { lists: ListView[]; showAttribution: boolean }) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [creating, setCreating] = useState(lists.length === 0);
  // The list you used last (read after hydration; null on the server).
  const saved = useSyncExternalStore(noSubscribe, readSavedList, () => null);

  // A list was just made: jump to it.
  const [count, setCount] = useState(lists.length);
  if (lists.length !== count) {
    setCount(lists.length);
    if (lists.length > count) {
      setActiveId(lists[lists.length - 1]!.id);
      setCreating(false);
    }
  }

  const active = lists.find((l) => l.id === activeId) ?? lists.find((l) => l.id === saved) ?? lists[0] ?? null;

  const pick = (id: string) => {
    setActiveId(id);
    setCreating(false);
    try {
      window.localStorage.setItem(PICK_KEY, id);
    } catch {
      // Remembering the list is a convenience.
    }
  };

  return (
    <div className="space-y-3">
      <div className="no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1" role="tablist" aria-label="Lists">
        {lists.map((list) => {
          const open = list.items.filter((i) => !i.checked).length;
          return (
            <button
              key={list.id}
              type="button"
              role="tab"
              aria-selected={!creating && active?.id === list.id}
              onClick={() => pick(list.id)}
              className="chip shrink-0"
              data-on={(!creating && active?.id === list.id) || undefined}
            >
              {list.emoji ? <span aria-hidden>{list.emoji}</span> : null}
              {list.name}
              {open ? <span className="tabular" style={{ opacity: 0.65 }}>{open}</span> : null}
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="chip shrink-0"
          data-on={creating || undefined}
          style={creating ? undefined : { borderStyle: "dashed" }}
        >
          + List
        </button>
      </div>

      {creating ? (
        <NewList existing={lists.map((l) => l.name)} onCancel={lists.length ? () => setCreating(false) : undefined} />
      ) : active ? (
        <ListCard key={active.id} list={active} showAttribution={showAttribution} />
      ) : null}
    </div>
  );
}

function ListCard({ list, showAttribution }: { list: ListView; showAttribution: boolean }) {
  const [items, setOptimistic] = useOptimistic(
    list.items,
    (current, change: { id: string; checked?: boolean; removed?: boolean }) =>
      current
        .filter((item) => !(change.removed && item.id === change.id))
        .map((item) => (item.id === change.id && change.checked !== undefined ? { ...item, checked: change.checked } : item)),
  );
  const [, start] = useTransition();
  const [adding, startAdd] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const open = items.filter((i) => !i.checked);
  const done = items.filter((i) => i.checked);

  const row = (item: ListView["items"][number]) => (
    <li key={item.id} className="group flex items-center gap-3 border-t px-1 first:border-t-0" style={{ borderColor: "var(--border-faint)" }}>
      <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 py-2.5">
        <input
          type="checkbox"
          className="list-check"
          checked={item.checked}
          onChange={(event) => {
            const checked = event.target.checked;
            start(async () => {
              setOptimistic({ id: item.id, checked });
              await toggleItem(item.id, checked);
            });
          }}
        />
        <span
          className="min-w-0 flex-1 truncate text-[0.9375rem]"
          style={{
            color: item.checked ? "var(--text-faint)" : "var(--text)",
            textDecoration: item.checked ? "line-through" : undefined,
          }}
        >
          {item.title}
        </span>
      </label>
      {showAttribution && item.addedBy ? (
        <span
          title={`Added by ${item.addedBy}`}
          className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[0.625rem] font-semibold text-white"
          style={{ background: categoryColor(item.addedBy) }}
        >
          {personInitial(item.addedBy)}
        </span>
      ) : null}
      <button
        type="button"
        className="btn-icon shrink-0 opacity-0 group-hover:opacity-100 [@media(pointer:coarse)]:opacity-60"
        aria-label={`Remove ${item.title}`}
        onClick={() =>
          start(async () => {
            setOptimistic({ id: item.id, removed: true });
            await removeItem(item.id);
          })
        }
      >
        <svg width="11" height="11" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" aria-hidden>
          <path d="M3 3l8 8M11 3l-8 8" />
        </svg>
      </button>
    </li>
  );

  return (
    <div className="rounded-lg border" style={{ borderColor: "var(--border-soft)", background: "var(--bg-page)" }}>
      <form
        className="flex gap-2 border-b p-3"
        style={{ borderColor: "var(--border-faint)" }}
        onSubmit={(event) => {
          event.preventDefault();
          const value = inputRef.current?.value ?? "";
          if (!value.trim()) return;
          startAdd(async () => {
            const result = await addItems(list.id, value);
            if (result && !result.ok) setError(result.error);
            else {
              setError(null);
              if (inputRef.current) inputRef.current.value = "";
            }
          });
        }}
      >
        <input
          ref={inputRef}
          className="field"
          placeholder={`Add to ${list.name}: milk, eggs…`}
          aria-label={`Add to ${list.name}`}
          enterKeyHint="send"
          autoComplete="off"
        />
        <button type="submit" className="btn-ink shrink-0" disabled={adding}>
          {adding ? "…" : "Add"}
        </button>
      </form>
      {error ? (
        <p className="px-4 pt-2 text-[0.75rem]" style={{ color: "var(--attention)" }}>
          {error}
        </p>
      ) : null}

      <div className="px-3 pb-2">
        {items.length === 0 ? (
          <p className="py-6 text-center text-[0.875rem]" style={{ color: "var(--text-faint)" }}>
            Nothing on the list.
          </p>
        ) : (
          <ul>
            {open.map(row)}
            {done.map(row)}
          </ul>
        )}
      </div>

      <div className="flex items-center justify-between gap-2 border-t px-3 py-2" style={{ borderColor: "var(--border-faint)" }}>
        <span className="text-[0.75rem]" style={{ color: "var(--text-faint)" }}>
          {open.length ? `${open.length} to get` : "All got"}
          {done.length ? ` · ${done.length} checked` : ""}
        </span>
        <div className="flex items-center gap-1">
          {done.length > 0 ? (
            <button type="button" className="btn-ghost" onClick={() => start(async () => void (await clearChecked(list.id)))}>
              Clear checked
            </button>
          ) : null}
          <button
            type="button"
            className="btn-ghost"
            style={{ color: "var(--text-faint)" }}
            onClick={() => {
              if (confirm(`Delete the ${list.name} list and everything on it?`)) start(async () => void (await deleteList(list.id)));
            }}
          >
            Delete list
          </button>
        </div>
      </div>
    </div>
  );
}

function NewList({ existing, onCancel }: { existing: string[]; onCancel?: () => void }) {
  const [state, action, pending] = useActionState(createList, undefined);
  const presets = HOME_LIST_PRESETS.filter((p) => !existing.includes(p));
  return (
    <div className="space-y-3 rounded-lg border p-3" style={{ borderColor: "var(--border-soft)" }}>
      <form action={action} className="space-y-3">
        <div className="flex gap-2">
          <input name="name" required autoFocus placeholder="New list name" aria-label="New list name" className="field" />
          <button type="submit" disabled={pending} className="btn-ink shrink-0">
            Make list
          </button>
        </div>
        {presets.length ? (
          <div className="flex flex-wrap gap-1.5">
            {presets.map((preset) => (
              <button key={preset} type="submit" name="name" value={preset} formNoValidate className="chip">
                + {preset}
              </button>
            ))}
          </div>
        ) : null}
      </form>
      {state && !state.ok ? (
        <p className="text-[0.75rem]" style={{ color: "var(--attention)" }}>
          {state.error}
        </p>
      ) : null}
      {onCancel ? (
        <button type="button" className="btn-ghost" onClick={onCancel}>
          Cancel
        </button>
      ) : null}
    </div>
  );
}
