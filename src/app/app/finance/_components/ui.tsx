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
      className={`min-w-0 rounded-[1.65rem] border border-zinc-200/80 bg-white/92 p-5 shadow-[0_20px_60px_-45px_rgba(24,24,27,0.16)] ${className ?? ""}`}
    >
      <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-zinc-500">
        {label}
      </p>
      <p
        className={`mt-3 min-w-0 overflow-hidden text-ellipsis break-words text-xl font-semibold tracking-tight sm:text-2xl ${valueClassName ?? "text-zinc-950"}`}
      >
        {value}
      </p>
      <p className="mt-1 text-sm text-zinc-500">{hint}</p>
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
    <div
      className={`rounded-[1.9rem] border border-zinc-200/80 bg-white/92 p-5 shadow-[0_20px_60px_-45px_rgba(24,24,27,0.16)] sm:p-6 ${className ?? ""}`}
    >
      <div className="flex flex-col gap-1">
        <h2 className="font-mono text-[11px] uppercase tracking-[0.22em] text-zinc-500">
          {title}
        </h2>
        {subtitle ? <p className="text-sm text-zinc-500">{subtitle}</p> : null}
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
    <div className="min-w-0 rounded-[1.4rem] border border-white/70 bg-white/88 px-4 py-3 shadow-sm shadow-zinc-950/5 backdrop-blur">
      <p className="text-[11px] uppercase tracking-[0.2em] text-zinc-500">{label}</p>
      <p
        className={`mt-2 min-w-0 overflow-hidden text-ellipsis break-words text-base font-semibold tracking-tight sm:text-lg ${tone === "positive" ? "text-emerald-600" : "text-zinc-950"}`}
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
      className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-full border border-zinc-200 bg-white px-3.5 py-2 text-sm text-zinc-700 shadow-sm shadow-zinc-950/5 transition-all hover:-translate-y-0.5 hover:border-zinc-300 hover:text-zinc-900"
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
  const toneClass = {
    emerald: "bg-emerald-500",
    sky: "bg-sky-500",
    amber: "bg-amber-500",
  }[tone];

  return (
    <div className="mt-3 h-2 rounded-full bg-zinc-100">
      <div
        className={`${toneClass} h-2 rounded-full transition-all`}
        style={{ width: `${Math.max(4, Math.min(100, percent))}%` }}
      />
    </div>
  );
}

export function typeTone(type: string): string {
  switch (type) {
    case "income":
    case "reimbursement":
      return "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200";
    case "credit_card_payment":
    case "transfer":
      return "bg-sky-50 text-sky-700 ring-1 ring-sky-200";
    case "housing":
      return "bg-violet-50 text-violet-700 ring-1 ring-violet-200";
    case "fee":
      return "bg-amber-50 text-amber-700 ring-1 ring-amber-200";
    default:
      return "bg-zinc-100 text-zinc-700 ring-1 ring-zinc-200";
  }
}
