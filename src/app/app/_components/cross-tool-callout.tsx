import { formatCents, formatHoursMs } from "./hub-format";
import { ConnectionIcon } from "./icons";

export function CrossToolCallout({
  runningEntry,
  weekTotalMs,
  financeVisible,
  thisMonthSpentCents,
}: {
  runningEntry: { label: string | null } | null;
  weekTotalMs: number;
  financeVisible: boolean;
  thisMonthSpentCents: number;
}) {
  const lines: { headline: string; body: string } = (() => {
    if (financeVisible && weekTotalMs > 0 && thisMonthSpentCents > 0) {
      const weekHours = weekTotalMs / 3_600_000;
      return {
        headline: "Time and money are finally in the same room",
        body: `${weekHours.toFixed(1)}h is logged this week, and ${formatCents(thisMonthSpentCents)} has gone out this month. The point of the hub is deciding what to do with that context.`,
      };
    }
    if (runningEntry) {
      return {
        headline: "One live thread is already open",
        body: "The dashboard knows a session is in motion. Let that steer the next decision instead of starting fresh somewhere else.",
      };
    }
    if (weekTotalMs > 0) {
      return {
        headline: "The week already has shape",
        body: `${formatHoursMs(weekTotalMs)} is logged so far. Use that evidence to decide what deserves the next block.`,
      };
    }
    return {
      headline: "Use the quiet before the day uses you",
      body: "Nothing is running yet. A small plan here will make the rest of the workspace smarter.",
    };
  })();

  return (
    <div
      className="fade-in-delay-1 flex items-start gap-3 rounded-lg px-4 py-3.5"
      style={{
        background: "var(--bg-tint)",
        border: "1px solid var(--border-faint)",
      }}
    >
      <span
        className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded"
        style={{ color: "var(--text)" }}
      >
        <ConnectionIcon />
      </span>
      <div className="min-w-0">
        <p
          className="text-[0.8125rem] font-semibold"
          style={{ color: "var(--text)" }}
        >
          {lines.headline}
        </p>
        <p
          className="mt-0.5 text-[0.875rem] leading-[1.5]"
          style={{ color: "var(--text-muted)" }}
        >
          {lines.body}
        </p>
      </div>
    </div>
  );
}
