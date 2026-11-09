import Link from "next/link";
import type { StaleNotice } from "@/lib/data-freshness";

// "Data stopped arriving" — one quiet card, one line per source. It appears
// only while a source the owner set up has gone silent, and leaves on its own
// once data flows again, so there is nothing to dismiss.

export function StaleDataCard({ notices }: { notices: StaleNotice[] }) {
  if (notices.length === 0) return null;
  return (
    <section
      aria-label="Data that stopped arriving"
      className="fade-in rounded-lg border px-4 py-3"
      style={{
        background: "var(--attention-tint)",
        borderColor: "transparent",
        borderLeft: "3px solid var(--attention)",
      }}
    >
      <p
        className="text-[0.6875rem] font-semibold uppercase tracking-wider"
        style={{ color: "var(--attention)" }}
      >
        ⚠ {notices.length === 1 ? "Data stopped arriving" : `${notices.length} sources stopped arriving`}
      </p>
      <ul className="mt-1.5 divide-y" style={{ borderColor: "var(--border-faint)" }}>
        {notices.map((notice) => (
          <li
            key={notice.key}
            className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 py-1.5"
            style={{ borderColor: "var(--border-faint)" }}
          >
            <div className="min-w-0">
              <p className="text-[0.875rem] font-medium" style={{ color: "var(--text)" }}>
                {notice.title}
              </p>
              <p className="text-[0.78rem]" style={{ color: "var(--text-muted)" }}>
                {notice.detail}
              </p>
            </div>
            <Link
              href={notice.href}
              className="btn-ghost h-8 shrink-0 px-2.5 text-[0.78rem]"
            >
              {notice.action} →
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
