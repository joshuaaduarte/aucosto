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
    <div
      className={`min-w-0 rule-t border-ink/30 pt-4 pb-1 pr-4 ${className ?? ""}`}
    >
      <p className="font-mono text-[0.6875rem] uppercase tracking-[0.22em] text-ink-fade">
        {label}
      </p>
      <p
        className={`mt-3 min-w-0 overflow-hidden text-ellipsis break-words font-display text-[1.8rem] font-medium leading-none tracking-[-0.025em] tabular sm:text-[2.1rem] ${valueClassName ?? "text-ink"}`}
      >
        {value}
      </p>
      <p className="mt-2 font-serif text-sm italic text-ink-fade">{hint}</p>
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
      <div className="rule-t border-ink/80 pt-4">
        <div className="flex flex-col gap-1">
          <h2 className="font-mono text-[0.6875rem] uppercase tracking-[0.26em] text-ink-fade">
            {title}
          </h2>
          {subtitle ? (
            <p className="font-serif text-sm italic text-ink-fade">{subtitle}</p>
          ) : null}
        </div>
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
  const valueTone =
    tone === "positive" ? "text-verdigris" : "text-ink";
  return (
    <div className="min-w-0 rule-l border-rule pl-4 py-2">
      <p className="font-mono text-[0.6875rem] uppercase tracking-[0.2em] text-ink-fade">
        {label}
      </p>
      <p
        className={`mt-1.5 min-w-0 overflow-hidden text-ellipsis break-words font-display text-lg font-medium tracking-[-0.02em] tabular sm:text-xl ${valueTone}`}
      >
        {value}
      </p>
    </div>
  );
}

export function ActionPill({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      className="inline-flex min-h-11 shrink-0 items-center justify-center border border-rule bg-paper px-4 font-serif text-sm text-ink-soft transition-colors hover:border-ink hover:bg-paper-deep hover:text-ink"
    >
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
  const trackBg = "bg-rule-faint";
  const fillBg = {
    emerald: "bg-verdigris",
    sky: "bg-ink",
    amber: "bg-aged-gold",
  }[tone];

  return (
    <div className={`mt-3 h-[3px] ${trackBg}`}>
      <div
        className={`${fillBg} h-[3px] transition-all`}
        style={{ width: `${Math.max(4, Math.min(100, percent))}%` }}
      />
    </div>
  );
}

export function typeTone(type: string): string {
  switch (type) {
    case "income":
    case "reimbursement":
      return "text-verdigris border-verdigris/30 bg-verdigris-soft";
    case "credit_card_payment":
    case "transfer":
      return "text-ink border-rule bg-paper-deep/60";
    case "housing":
      return "text-ink-soft border-rule bg-paper-deep/40";
    case "fee":
      return "text-oxblood border-oxblood/30 bg-oxblood-soft";
    default:
      return "text-ink-soft border-rule bg-paper-deep/30";
  }
}
