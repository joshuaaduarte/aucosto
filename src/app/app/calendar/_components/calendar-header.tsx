import type { CalendarItem } from "@/generated/prisma/client";
import { formatShortTime } from "../_lib/derive";

export function CalendarHeader({
  totalTodayCount,
  gapSuggestionCount,
  slippedCount,
  nextItem,
}: {
  totalTodayCount: number;
  gapSuggestionCount: number;
  slippedCount: number;
  nextItem: CalendarItem | null;
}) {
  const todayFocusLabel =
    totalTodayCount === 0
      ? "Open day"
      : `${totalTodayCount} ${totalTodayCount === 1 ? "block" : "blocks"}`;
  const nextLabel = nextItem
    ? `${nextItem.title} at ${formatShortTime(nextItem.startsAt)}`
    : "Nothing lined up";
  const slippedLabel =
    slippedCount === 0
      ? "Nothing slipping"
      : `${slippedCount} ${slippedCount === 1 ? "block needs" : "blocks need"} attention`;

  return (
    <header className="fade-in">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p
            className="text-[0.75rem] font-medium uppercase tracking-wider"
            style={{ color: "var(--text-faint)" }}
          >
            Calendar
          </p>
          <h1
            className="mt-1 text-[1.5rem] font-bold tracking-tight sm:text-[1.875rem]"
            style={{ color: "var(--text)", letterSpacing: "-0.025em" }}
          >
            Today
          </h1>
        </div>
        <p
          className="text-[0.8125rem] sm:max-w-[38rem] sm:text-right"
          style={{ color: "var(--text-muted)" }}
        >
          {totalTodayCount} item{totalTodayCount === 1 ? "" : "s"} today
          {gapSuggestionCount > 0 ? ` · ${gapSuggestionCount} open-slot suggestion${gapSuggestionCount === 1 ? "" : "s"}` : ""}
          {slippedCount > 0 ? ` · ${slippedCount} need attention` : ""}
        </p>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        <div className="rounded-md border px-3 py-2.5" style={{ borderColor: "var(--border-faint)", background: "var(--bg-page)" }}>
          <p className="text-[0.6875rem] font-semibold uppercase tracking-wider" style={{ color: "var(--text-faint)" }}>
            Today
          </p>
          <p className="mt-1 text-[0.9375rem] font-medium" style={{ color: "var(--text)" }}>
            {todayFocusLabel}
          </p>
        </div>
        <div className="rounded-md border px-3 py-2.5" style={{ borderColor: "var(--border-faint)", background: "var(--bg-page)" }}>
          <p className="text-[0.6875rem] font-semibold uppercase tracking-wider" style={{ color: "var(--text-faint)" }}>
            Next up
          </p>
          <p className="mt-1 text-[0.9375rem] font-medium" style={{ color: "var(--text)" }}>
            {nextLabel}
          </p>
        </div>
        <div className="rounded-md border px-3 py-2.5" style={{ borderColor: "var(--border-faint)", background: "var(--bg-page)" }}>
          <p className="text-[0.6875rem] font-semibold uppercase tracking-wider" style={{ color: "var(--text-faint)" }}>
            Attention
          </p>
          <p className="mt-1 text-[0.9375rem] font-medium" style={{ color: "var(--text)" }}>
            {slippedLabel}
          </p>
        </div>
      </div>
    </header>
  );
}
