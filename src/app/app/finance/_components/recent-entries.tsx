// The last few entries on the Overview, each with its category icon and who
// logged it, so you can see at a glance that today's purchases made it in.

import Link from "next/link";
import { formatUSDFromCents } from "@/lib/money";
import { financeCategoryLook } from "@/lib/quick-capture";
import type { EntryView } from "./entry-list";

export function CategoryBadge({ category, size = "md" }: { category: string | null; size?: "sm" | "md" }) {
  const look = financeCategoryLook(category);
  const box = size === "sm" ? "h-7 w-7 text-[0.8125rem]" : "h-8 w-8 text-[0.9375rem]";
  return (
    <span
      aria-hidden
      className={`inline-flex shrink-0 items-center justify-center rounded-lg ${box}`}
      style={{ background: `color-mix(in oklab, ${look.color} 16%, transparent)` }}
    >
      {look.emoji ?? <span className="h-2.5 w-2.5 rounded-full" style={{ background: category ? look.color : "var(--text-ghost)" }} />}
    </span>
  );
}

export function RecentEntries({ entries, limit = 5 }: { entries: EntryView[]; limit?: number }) {
  const rows = entries.filter((e) => !e.move).slice(0, limit);
  if (rows.length === 0) return null;
  return (
    <section aria-labelledby="recent-entries" className="space-y-2">
      <div className="flex items-baseline justify-between">
        <h2 id="recent-entries" className="text-[0.6875rem] font-semibold uppercase tracking-wider" style={{ color: "var(--text-faint)" }}>
          Recent
        </h2>
        <Link href="/app/finance?tab=spending" className="text-[0.8125rem]" style={{ color: "var(--text-muted)" }}>
          See all ›
        </Link>
      </div>
      <ul className="rounded-md border" style={{ borderColor: "var(--border-soft)" }}>
        {rows.map((e) => {
          const out = e.amount < 0;
          return (
            <li key={e.id} className="flex items-center gap-3 border-t px-3 py-2.5 first:border-t-0 sm:px-4" style={{ borderColor: "var(--border-faint)" }}>
              <CategoryBadge category={out ? e.category : "Income"} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[0.875rem]" style={{ color: "var(--text)" }}>
                  {e.description}
                </span>
                <span className="block truncate text-[0.75rem]" style={{ color: "var(--text-faint)" }}>
                  {[out ? (e.category ? financeCategoryLook(e.category).label : "To sort") : "Money in", e.byName?.split(" ")[0]]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              </span>
              <span className="shrink-0 text-[0.875rem] font-medium tabular" style={{ color: out ? "var(--text)" : "var(--positive)" }}>
                {out ? "" : "+"}
                {formatUSDFromCents(Math.abs(e.amount))}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
