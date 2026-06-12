import Link from "next/link";
import type { DailyInsight } from "@/lib/insights";

// One rotating data-backed observation between the focus hero and the stat
// tiles. Quiet placeholder while the data is still too sparse to say
// anything meaningful.

export function InsightOfTheDayCard({
  insight,
}: {
  insight: DailyInsight | null;
}) {
  if (!insight) {
    return (
      <p
        className="fade-in-delay-1 rounded-lg border px-4 py-2.5 text-[0.8rem]"
        style={{
          borderColor: "var(--border-faint)",
          color: "var(--text-faint)",
          borderStyle: "dashed",
        }}
      >
        Keep building your data — insights will appear here.
      </p>
    );
  }

  return (
    <Link
      href={insight.href}
      className="fade-in-delay-1 flex items-center gap-3 rounded-lg border px-4 py-3 transition-colors hover:bg-bg-hover"
      style={{
        borderColor: "var(--border-faint)",
        background: "var(--bg-page)",
        borderLeft: "3px solid #8b5cf6",
      }}
    >
      <span
        className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full"
        style={{ background: "var(--bg-tint)", color: "#8b5cf6" }}
        aria-hidden
      >
        <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
          <path d="M1.5 11.5 5 7l2.5 2L11.5 3" />
          <path d="M8.5 3h3v3" />
        </svg>
      </span>
      <span className="min-w-0">
        <span
          className="block text-[0.6875rem] font-semibold uppercase tracking-wider"
          style={{ color: "var(--text-faint)" }}
        >
          Insight of the day
        </span>
        <span
          className="mt-0.5 block text-[0.875rem] font-medium leading-snug"
          style={{ color: "var(--text)" }}
        >
          {insight.text}
        </span>
      </span>
    </Link>
  );
}
