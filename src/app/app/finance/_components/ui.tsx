import type { ReactNode } from "react";

export function SummaryCard({
  label,
  value,
  hint,
  valueClassName,
  className,
}: {
  label: string;
  value: string;
  hint: string;
  valueClassName?: string;
  className?: string;
}) {
  return (
    <div className={`min-w-0 ${className ?? ""}`}>
      <p
        className="text-[0.6875rem] font-semibold uppercase tracking-wider"
        style={{ color: "var(--text-faint)" }}
      >
        {label}
      </p>
      <p
        className={`mt-1 min-w-0 overflow-hidden text-ellipsis break-words text-[1.5rem] font-semibold tracking-tight tabular sm:text-[1.75rem] ${valueClassName ?? ""}`}
        style={{
          color: "var(--text)",
          letterSpacing: "-0.025em",
          fontFeatureSettings: '"tnum" 1',
        }}
      >
        {value}
      </p>
      <p
        className="mt-1 text-[0.75rem]"
        style={{ color: "var(--text-faint)" }}
      >
        {hint}
      </p>
    </div>
  );
}

export function SectionCard({
  title,
  subtitle,
  children,
  className,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`relative ${className ?? ""}`}>
      <div className="mb-3">
        <h2
          className="text-[0.6875rem] font-semibold uppercase tracking-wider"
          style={{ color: "var(--text-faint)" }}
        >
          {title}
        </h2>
        {subtitle && (
          <p
            className="mt-1 text-[0.875rem]"
            style={{ color: "var(--text-muted)" }}
          >
            {subtitle}
          </p>
        )}
      </div>
      {children}
    </div>
  );
}

export function QuickStat({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "positive";
}) {
  return (
    <div
      className="min-w-0 px-3 py-2"
      style={{ borderLeft: "1px solid var(--border)" }}
    >
      <p
        className="text-[0.6875rem] font-semibold uppercase tracking-wider"
        style={{ color: "var(--text-faint)" }}
      >
        {label}
      </p>
      <p
        className="mt-1 min-w-0 overflow-hidden text-ellipsis break-words text-[1rem] font-semibold tracking-tight tabular sm:text-[1.125rem]"
        style={{
          color: tone === "positive" ? "var(--text)" : "var(--text)",
          letterSpacing: "-0.02em",
        }}
      >
        {value}
      </p>
    </div>
  );
}

export function ActionPill({ href, label }: { href: string; label: string }) {
  return (
    <a href={href} className="btn-ghost">
      {label}
    </a>
  );
}

export function ProgressBar({
  percent,
  tone = "emerald",
}: {
  percent: number;
  tone?: "emerald" | "sky" | "amber";
}) {
  const fill =
    tone === "amber"
      ? "var(--accent)"
      : "var(--text)";

  return (
    <div
      className="mt-2 h-[3px] rounded-full overflow-hidden"
      style={{ background: "var(--bg-tint-strong)" }}
    >
      <div
        className="h-full transition-all rounded-full"
        style={{
          width: `${Math.max(4, Math.min(100, percent))}%`,
          background: fill,
        }}
      />
    </div>
  );
}

export function typeTone(type: string): string {
  // Keep pills neutral; reserve the accent for the rare "fee" case.
  switch (type) {
    case "income":
    case "reimbursement":
      return "text-text border-border bg-bg-tint";
    case "credit_card_payment":
    case "transfer":
      return "text-text border-border bg-bg-tint";
    case "housing":
      return "text-text-muted border-border-soft bg-bg-tint";
    case "fee":
      return "text-accent-strong border-accent-tint-strong bg-accent-tint";
    default:
      return "text-text-muted border-border-soft bg-bg-tint";
  }
}
