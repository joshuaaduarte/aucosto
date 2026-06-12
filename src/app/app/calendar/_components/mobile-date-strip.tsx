"use client";

// Mobile-only horizontal date strip: 7 days centred on the selected day
// (3 before · selected · 3 after). Tapping a chip navigates to that day in
// single-day view; the strip re-centres whenever the selected day changes.
// Desktop hides this entirely (the ViewSelector + nav arrows cover it).

import { useEffect, useRef } from "react";
import Link from "next/link";

function shiftIso(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + days);
  return d.toLocaleDateString("en-CA"); // YYYY-MM-DD, local
}

export function MobileDateStrip({
  anchorDay,
  today,
}: {
  /** Selected day, YYYY-MM-DD. */
  anchorDay: string;
  /** Today, YYYY-MM-DD — gets a dot indicator. */
  today: string;
}) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const selectedRef = useRef<HTMLAnchorElement>(null);

  // Re-centre the selected chip without nudging the page's vertical scroll.
  useEffect(() => {
    const scroller = scrollerRef.current;
    const el = selectedRef.current;
    if (!scroller || !el) return;
    scroller.scrollLeft =
      el.offsetLeft - scroller.clientWidth / 2 + el.clientWidth / 2;
  }, [anchorDay]);

  const days = Array.from({ length: 7 }, (_, i) => shiftIso(anchorDay, i - 3));

  return (
    <div
      ref={scrollerRef}
      className="relative mb-4 flex gap-1.5 overflow-x-auto md:hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {days.map((iso) => {
        const date = new Date(`${iso}T00:00:00`);
        const weekday = date.toLocaleDateString([], { weekday: "short" });
        const dayNum = date.getDate();
        const isSelected = iso === anchorDay;
        const isToday = iso === today;
        return (
          <Link
            key={iso}
            ref={isSelected ? selectedRef : undefined}
            href={`/app/calendar?view=1d&day=${iso}`}
            scroll={false}
            aria-current={isSelected ? "date" : undefined}
            className="flex min-w-[2.75rem] flex-1 flex-col items-center gap-1 rounded-lg py-1.5"
          >
            <span
              className="text-[0.625rem] font-semibold uppercase tracking-wider"
              style={{
                color: isToday ? "var(--accent-strong)" : "var(--text-faint)",
              }}
            >
              {weekday}
            </span>
            <span
              className="flex h-7 w-7 items-center justify-center rounded-full text-[0.8125rem] font-semibold tabular"
              style={{
                background: isSelected ? "var(--accent)" : "transparent",
                color: isSelected ? "var(--text-on-accent)" : "var(--text)",
              }}
            >
              {dayNum}
            </span>
            <span
              className="h-1 w-1 rounded-full"
              style={{
                background:
                  isToday && !isSelected ? "var(--accent-strong)" : "transparent",
              }}
              aria-hidden
            />
          </Link>
        );
      })}
    </div>
  );
}
