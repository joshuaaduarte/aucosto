"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { lockWidgetNow, removeWidgetPin } from "./privacy-actions";

interface CardMenuProps {
  widgetId: string;
  hasPin: boolean;
  isLocked: boolean;
}

export function CardMenu({ widgetId, hasPin, isLocked }: CardMenuProps) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  return (
    <div
      ref={ref}
      className="absolute top-1.5 right-1.5 z-10"
      onClick={(e) => e.preventDefault()}
    >
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        className="btn-icon opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100"
        aria-label="Widget options"
      >
        <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden>
          <circle cx="6.5" cy="2" r="1.1" fill="currentColor" />
          <circle cx="6.5" cy="6.5" r="1.1" fill="currentColor" />
          <circle cx="6.5" cy="11" r="1.1" fill="currentColor" />
        </svg>
      </button>

      {open && (
        <div
          className="absolute right-0 top-8 z-20 min-w-[170px] overflow-hidden rounded-md py-1"
          style={{
            background: "var(--bg-elevated)",
            boxShadow: "var(--shadow-pop)",
          }}
        >
          {hasPin && !isLocked && (
            <button
              type="button"
              disabled={pending}
              onClick={(e) => {
                e.preventDefault();
                setOpen(false);
                startTransition(() => lockWidgetNow(widgetId));
              }}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[0.8125rem] transition-colors hover:bg-bg-hover disabled:opacity-50"
              style={{ color: "var(--text)" }}
            >
              <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" aria-hidden>
                <rect x="2.5" y="5.75" width="8" height="5.25" rx="1" />
                <path d="M4.5 5.75V4a2 2 0 0 1 4 0v1.75" />
              </svg>
              Lock now
            </button>
          )}

          <a
            href={`/app/settings#${widgetId}`}
            onClick={() => setOpen(false)}
            className="flex w-full items-center gap-2 px-3 py-1.5 text-[0.8125rem] transition-colors hover:bg-bg-hover"
            style={{ color: "var(--text)" }}
          >
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" aria-hidden>
              <circle cx="6.5" cy="6.5" r="1.5" />
              <path d="M6.5 1.5v1M6.5 10.5v1M1.5 6.5h1M10.5 6.5h1M2.7 2.7l.7.7M9.3 9.3l.7.7M2.7 10.3l.7-.7M9.3 3.7l.7-.7" />
            </svg>
            {hasPin ? "Change PIN" : "Set PIN"}
          </a>

          {hasPin && (
            <button
              type="button"
              disabled={pending}
              onClick={(e) => {
                e.preventDefault();
                setOpen(false);
                startTransition(async () => {
                  await removeWidgetPin(widgetId);
                });
              }}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[0.8125rem] transition-colors hover:bg-bg-hover disabled:opacity-50"
              style={{ color: "var(--accent-strong)" }}
            >
              <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" aria-hidden>
                <path d="M2.5 2.5l8 8M10.5 2.5l-8 8" />
              </svg>
              Remove PIN
            </button>
          )}
        </div>
      )}
    </div>
  );
}
