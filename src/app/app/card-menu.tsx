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
      className="absolute top-2 right-2 z-10"
      onClick={(e) => e.preventDefault()}
    >
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        className="flex h-6 w-6 items-center justify-center rounded-md text-ink-ghost opacity-0 transition-opacity group-hover:opacity-100 hover:bg-paper-deep hover:text-ink focus:opacity-100"
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
          className="absolute right-0 top-7 z-20 min-w-[160px] overflow-hidden rounded-lg py-1 shadow-lg"
          style={{
            background: "var(--surface)",
            border: "1px solid var(--rule-faint)",
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
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-ink-fade hover:bg-paper-deep hover:text-ink disabled:opacity-50"
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
                <rect x="2" y="5.5" width="8" height="5.5" rx="1" stroke="currentColor" strokeWidth="1.1" />
                <path d="M4 5.5V3.5a2 2 0 0 1 4 0v2" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
              </svg>
              Lock now
            </button>
          )}

          <a
            href={`/app/settings#${widgetId}`}
            onClick={() => setOpen(false)}
            className="flex w-full items-center gap-2 px-3 py-2 text-sm text-ink-fade hover:bg-paper-deep hover:text-ink"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
              <circle cx="6" cy="6" r="1.5" stroke="currentColor" strokeWidth="1.1" />
              <path
                d="M6 1v1M6 10v1M1 6h1M10 6h1M2.222 2.222l.707.707M9.071 9.071l.707.707M2.222 9.778l.707-.707M9.071 2.929l.707-.707"
                stroke="currentColor"
                strokeWidth="1.1"
                strokeLinecap="round"
              />
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
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-oxblood hover:bg-paper-deep disabled:opacity-50"
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
                <path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
              </svg>
              Remove PIN
            </button>
          )}
        </div>
      )}
    </div>
  );
}
