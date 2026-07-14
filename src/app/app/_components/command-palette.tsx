"use client";

// Global ⌘K / Ctrl+K command palette. Fuzzy-filters a flat list of nav
// destinations and quick actions (which, for now, are just navigation too —
// see AGENTS.md task notes). Opens via the global keydown listener below or
// by calling `openCommandPalette()` from anywhere (the sidebar's Search
// button uses this). A single module-level trigger ref stands in for a
// lifted-state/event-emitter — there's only ever one <CommandPalette/> in the
// tree (mounted from the app layout), so this is simpler than plumbing
// context through the sidebar.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { useBodyScrollLock } from "./use-body-scroll-lock";

type PaletteSection = "Navigate" | "Quick actions";

type PaletteItem = {
  id: string;
  label: string;
  section: PaletteSection;
  href: string;
};

const NAVIGATE_ITEMS: Array<{ label: string; href: string }> = [
  { label: "Hub", href: "/app" },
  { label: "Time", href: "/app/time" },
  { label: "Finance", href: "/app/finance" },
  { label: "Calendar", href: "/app/calendar" },
  { label: "Tasks", href: "/app/do" },
  { label: "Habits", href: "/app/habits" },
  { label: "Projects", href: "/app/projects" },
  { label: "Work", href: "/app/work" },
  { label: "Reflect", href: "/app/reflect" },
  { label: "Insights", href: "/app/insights" },
  { label: "Rolodex", href: "/app/rolodex" },
];

const QUICK_ACTION_ITEMS: Array<{ label: string; href: string }> = [
  { label: "New task", href: "/app/do" },
  { label: "Start timer", href: "/app/time" },
  { label: "Log habit", href: "/app/habits" },
  { label: "New calendar event", href: "/app/calendar" },
  { label: "New reflection", href: "/app/reflect" },
];

const ALL_ITEMS: PaletteItem[] = [
  ...NAVIGATE_ITEMS.map((item) => ({ id: `nav:${item.href}`, section: "Navigate" as const, ...item })),
  ...QUICK_ACTION_ITEMS.map((item) => ({ id: `action:${item.label}`, section: "Quick actions" as const, ...item })),
];

function fuzzyMatch(query: string, target: string) {
  if (!query) return true;
  const q = query.toLowerCase();
  const t = target.toLowerCase();
  if (t.includes(q)) return true;
  let qi = 0;
  for (let i = 0; i < t.length && qi < q.length; i += 1) {
    if (t[i] === q[qi]) qi += 1;
  }
  return qi === q.length;
}

let triggerOpen: (() => void) | null = null;

export function openCommandPalette() {
  triggerOpen?.();
}

export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useBodyScrollLock(open);

  useEffect(() => {
    triggerOpen = () => setOpen(true);
    return () => {
      triggerOpen = null;
    };
  }, []);

  useEffect(() => {
    if (open) {
      setQuery("");
      setActiveIndex(0);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  const filtered = useMemo(
    () => ALL_ITEMS.filter((item) => fuzzyMatch(query, item.label)),
    [query],
  );

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  const close = useCallback(() => setOpen(false), []);

  const activate = useCallback(
    (item: PaletteItem) => {
      router.push(item.href);
      setOpen(false);
    },
    [router],
  );

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const isMod = event.metaKey || event.ctrlKey;
      if (isMod && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((value) => !value);
        return;
      }
      if (!open) return;
      if (event.key === "Escape") {
        event.preventDefault();
        close();
      } else if (event.key === "ArrowDown") {
        event.preventDefault();
        setActiveIndex((index) => Math.min(index + 1, filtered.length - 1));
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        setActiveIndex((index) => Math.max(index - 1, 0));
      } else if (event.key === "Enter") {
        event.preventDefault();
        const item = filtered[activeIndex];
        if (item) activate(item);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, filtered, activeIndex, close, activate]);

  if (!open) return null;

  const navigateResults = filtered.filter((item) => item.section === "Navigate");
  const quickResults = filtered.filter((item) => item.section === "Quick actions");

  function renderRow(item: PaletteItem) {
    const index = filtered.indexOf(item);
    const active = index === activeIndex;
    return (
      <button
        key={item.id}
        type="button"
        role="option"
        aria-selected={active}
        onMouseEnter={() => setActiveIndex(index)}
        onClick={() => activate(item)}
        className="flex w-full items-center px-4 py-2 text-left text-[0.8125rem] transition-colors"
        style={{
          background: active ? "var(--bg-hover)" : "transparent",
          color: "var(--text)",
        }}
      >
        {item.label}
      </button>
    );
  }

  return createPortal(
    <div
      className="z-50 flex items-start justify-center px-4 pt-[12vh]"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(15,15,15,0.36)",
        backdropFilter: "blur(6px)",
      }}
      role="presentation"
      onClick={close}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        className="w-full max-w-[560px] overflow-hidden rounded-xl border"
        style={{
          background: "var(--bg-page)",
          borderColor: "var(--border-soft)",
          boxShadow: "var(--shadow-pop)",
        }}
        onClick={(event) => event.stopPropagation()}
      >
        <div
          className="flex items-center gap-2 border-b px-4 py-3"
          style={{ borderColor: "var(--border-faint)" }}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 15 15"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.25"
            strokeLinecap="round"
            aria-hidden
            style={{ color: "var(--text-faint)" }}
          >
            <circle cx="6.5" cy="6.5" r="4" />
            <path d="m9.5 9.5 3 3" />
          </svg>
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Jump to a tool or action…"
            className="w-full bg-transparent text-[0.9375rem] outline-none"
            style={{ color: "var(--text)" }}
            aria-label="Command palette search"
          />
          <span className="font-mono text-[0.6875rem]" style={{ color: "var(--text-ghost)" }}>
            Esc
          </span>
        </div>

        <div role="listbox" className="max-h-[60vh] overflow-y-auto py-1.5">
          {navigateResults.length > 0 && (
            <div>
              <p
                className="px-4 pb-1 pt-2 text-[0.6875rem] font-semibold uppercase tracking-wider"
                style={{ color: "var(--text-faint)" }}
              >
                Navigate
              </p>
              {navigateResults.map(renderRow)}
            </div>
          )}
          {quickResults.length > 0 && (
            <div>
              <p
                className="px-4 pb-1 pt-3 text-[0.6875rem] font-semibold uppercase tracking-wider"
                style={{ color: "var(--text-faint)" }}
              >
                Quick actions
              </p>
              {quickResults.map(renderRow)}
            </div>
          )}
          {filtered.length === 0 && (
            <p
              className="px-4 py-8 text-center text-[0.8125rem]"
              style={{ color: "var(--text-faint)" }}
            >
              No matching commands
            </p>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
