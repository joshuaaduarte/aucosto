import Link from "next/link";
import type { DailyDigest } from "../_lib/daily-digest";

export function DailyDigestSection({ digest }: { digest: DailyDigest }) {
  if (digest.lines.length === 0) return null;

  return (
    <section className="fade-in">
      <div className="mb-3 flex items-center justify-between gap-3 px-1">
        <p
          className="text-[0.6875rem] font-semibold uppercase tracking-wider"
          style={{ color: "var(--text-faint)" }}
        >
          Today in review
        </p>
        <p
          className="text-[0.75rem]"
          style={{ color: "var(--text-faint)" }}
        >
          Where the day stands at a glance.
        </p>
      </div>
      <div
        className={`grid grid-cols-1 gap-px ${digest.lines.length >= 3 ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}
        style={{
          background: "var(--border-faint)",
          borderRadius: "10px",
          overflow: "hidden",
          border: "1px solid var(--border-faint)",
        }}
      >
        {digest.lines.map((line) => (
          <Link
            key={line.key}
            href={line.href}
            className="block px-4 py-3.5 transition-colors hover:bg-bg-hover"
            style={{ background: "var(--bg-page)" }}
          >
            <p
              className="text-[0.6875rem] font-semibold uppercase tracking-wider"
              style={{ color: "var(--text-faint)" }}
            >
              {line.label}
            </p>
            <p
              className="mt-1 text-[1.15rem] font-semibold tracking-tight"
              style={{
                color: "var(--text)",
                letterSpacing: "-0.02em",
                fontFeatureSettings: '"tnum" 1',
              }}
            >
              {line.value}
            </p>
            <p
              className="mt-0.5 line-clamp-2 text-[0.78rem] leading-[1.45]"
              style={{ color: "var(--text-muted)" }}
            >
              {line.detail}
            </p>
          </Link>
        ))}
      </div>
    </section>
  );
}
