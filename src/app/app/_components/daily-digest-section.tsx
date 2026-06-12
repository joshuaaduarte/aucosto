import Link from "next/link";
import { categoryColor } from "@/lib/time-categories";
import type { DailyDigest, DailyDigestLine } from "../_lib/daily-digest";

// Compact stat tiles under the focus hero: number + a glanceable progress
// indicator (ring for habits, thin bar for time coverage and spend pace).
// Always 2–3 across so the row fits above the fold even on phones.

const LINE_COLOR: Record<DailyDigestLine["key"], string> = {
  time: categoryColor("work"),
  habits: categoryColor("habit"),
  finance: "var(--accent)",
};

export function DailyDigestSection({ digest }: { digest: DailyDigest }) {
  if (digest.lines.length === 0) return null;

  return (
    <section className="fade-in-delay-1">
      <div
        className={`grid gap-px ${digest.lines.length >= 3 ? "grid-cols-3" : "grid-cols-2"}`}
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
            className="block px-3 py-3 transition-colors hover:bg-bg-hover sm:px-4 sm:py-3.5"
            style={{
              background: "var(--bg-page)",
              opacity: line.subtle ? 0.65 : 1,
            }}
          >
            <p
              className="text-[0.625rem] font-semibold uppercase tracking-wider sm:text-[0.6875rem]"
              style={{ color: "var(--text-faint)" }}
            >
              {line.label}
            </p>
            <div className="mt-1 flex items-center gap-2">
              {line.key === "habits" && line.progress !== null ? (
                <ProgressRing
                  ratio={line.progress}
                  color={LINE_COLOR[line.key]}
                />
              ) : null}
              <p
                className="text-[1.05rem] font-semibold tracking-tight sm:text-[1.2rem]"
                style={{
                  color: "var(--text)",
                  letterSpacing: "-0.02em",
                  fontFeatureSettings: '"tnum" 1',
                }}
              >
                {line.value}
              </p>
            </div>
            {line.key !== "habits" && line.progress !== null ? (
              <ProgressBar ratio={line.progress} color={LINE_COLOR[line.key]} />
            ) : null}
            <p
              className="mt-1 hidden text-[0.75rem] leading-[1.45] sm:line-clamp-2"
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

function ProgressBar({ ratio, color }: { ratio: number; color: string }) {
  return (
    <div
      className="mt-1.5 h-[3px] w-full rounded-full"
      style={{ background: "var(--bg-tint-strong)" }}
      aria-hidden
    >
      <div
        className="h-[3px] rounded-full"
        style={{
          width: `${Math.max(2, Math.round(ratio * 100))}%`,
          background: color,
        }}
      />
    </div>
  );
}

function ProgressRing({ ratio, color }: { ratio: number; color: string }) {
  const radius = 9;
  const circumference = 2 * Math.PI * radius;
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden className="shrink-0 -rotate-90">
      <circle
        cx="12"
        cy="12"
        r={radius}
        fill="none"
        stroke="var(--bg-tint-strong)"
        strokeWidth="2.5"
      />
      <circle
        cx="12"
        cy="12"
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeDasharray={`${circumference * Math.max(0.02, ratio)} ${circumference}`}
      />
    </svg>
  );
}
