"use client";

import { useActionState, useOptimistic, useRef, useState, useTransition } from "react";
import { HOME_LIST_PRESETS } from "@/lib/home";
import { addItems, clearChecked, createList, deleteList, removeItem, toggleItem } from "../actions";

export type ListView = {
  id: string;
  name: string;
  items: Array<{ id: string; title: string; checked: boolean; addedBy: string | null }>;
};

export function HomeLists({ lists, showAttribution }: { lists: ListView[]; showAttribution: boolean }) {
  return (
    <div className="space-y-6">
      <div className="grid gap-6 md:grid-cols-2">
        {lists.map((list) => (
          <ListCard key={list.id} list={list} showAttribution={showAttribution} />
        ))}
      </div>
      <NewList existing={lists.map((l) => l.name)} />
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
  const checkedCount = items.filter((i) => i.checked).length;

  return (
    <div className="rounded-md border p-4" style={{ borderColor: "var(--border-soft)", background: "var(--bg-page)" }}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="text-[0.9375rem] font-semibold" style={{ color: "var(--text)" }}>
          {list.name}
          <span className="ml-2 text-[0.75rem] font-normal" style={{ color: "var(--text-faint)" }}>
            {items.length - checkedCount} to get
          </span>
        </p>
        <div className="flex items-center gap-1">
          {checkedCount > 0 ? (
            <button type="button" className="btn-ghost" onClick={() => start(async () => void (await clearChecked(list.id)))}>
              Clear checked
            </button>
          ) : null}
          <button
            type="button"
            className="btn-icon"
            aria-label={`Delete ${list.name}`}
            title="Delete list"
            onClick={() => {
              if (confirm(`Delete the ${list.name} list and everything on it?`)) start(async () => void (await deleteList(list.id)));
            }}
          >
            <svg width="12" height="12" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" aria-hidden>
              <path d="M3 3l8 8M11 3l-8 8" />
            </svg>
          </button>
        </div>
      </div>

      <form
        className="mb-3 flex gap-2"
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
        <input ref={inputRef} className="field" placeholder="Add items (milk, eggs, …)" aria-label={`Add to ${list.name}`} enterKeyHint="done" />
        <button type="submit" className="btn-ink shrink-0" disabled={adding}>
          {adding ? "…" : "Add"}
        </button>
      </form>
      {error ? (
        <p className="mb-2 text-[0.75rem]" style={{ color: "var(--accent-strong)" }}>
          {error}
        </p>
      ) : null}

      {items.length === 0 ? (
        <p className="text-[0.8125rem]" style={{ color: "var(--text-faint)" }}>
          Nothing on the list.
        </p>
      ) : (
        <ul className="space-y-0.5">
          {items.map((item) => (
            <li key={item.id} className="group flex items-center gap-3 rounded px-1 py-1.5 hover:bg-bg-hover">
              <input
                type="checkbox"
                className="h-4 w-4 shrink-0"
                checked={item.checked}
                aria-label={item.title}
                onChange={(event) => {
                  const checked = event.target.checked;
                  start(async () => {
                    setOptimistic({ id: item.id, checked });
                    await toggleItem(item.id, checked);
                  });
                }}
              />
              <span
                className="min-w-0 flex-1 truncate text-[0.875rem]"
                style={{
                  color: item.checked ? "var(--text-faint)" : "var(--text)",
                  textDecoration: item.checked ? "line-through" : undefined,
                }}
              >
                {item.title}
              </span>
              {showAttribution && item.addedBy ? (
                <span className="shrink-0 text-[0.6875rem]" style={{ color: "var(--text-ghost)" }}>
                  {item.addedBy}
                </span>
              ) : null}
              <button
                type="button"
                className="shrink-0 text-[0.6875rem] opacity-0 group-hover:opacity-100 [@media(pointer:coarse)]:opacity-100"
                style={{ color: "var(--text-faint)" }}
                aria-label={`Remove ${item.title}`}
                onClick={() =>
                  start(async () => {
                    setOptimistic({ id: item.id, removed: true });
                    await removeItem(item.id);
                  })
                }
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function NewList({ existing }: { existing: string[] }) {
  const [state, action, pending] = useActionState(createList, undefined);
  const presets = HOME_LIST_PRESETS.filter((p) => !existing.includes(p));
  return (
    <div className="space-y-2">
      <form action={action} className="flex flex-wrap items-center gap-2">
        <input name="name" required placeholder="New list" aria-label="New list name" className="field max-w-[14rem]" />
        <button type="submit" disabled={pending} className="btn-ghost">
          New list
        </button>
        {presets.map((preset) => (
          <button
            key={preset}
            type="submit"
            name="name"
            value={preset}
            formNoValidate
            className="rounded-full border px-2.5 py-1 text-[0.75rem]"
            style={{ borderColor: "var(--border-soft)", color: "var(--text-muted)" }}
          >
            + {preset}
          </button>
        ))}
      </form>
      {state && !state.ok ? (
        <p className="text-[0.75rem]" style={{ color: "var(--accent-strong)" }}>
          {state.error}
        </p>
      ) : null}
    </div>
  );
}
