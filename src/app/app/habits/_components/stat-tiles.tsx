"use client";

export function MetricTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[0.85rem] border px-3 py-2.5" style={{ borderColor: "var(--border-faint)", background: "var(--bg-page)" }}>
      <p className="text-[0.6875rem] font-semibold uppercase tracking-wider" style={{ color: "var(--text-faint)" }}>
        {label}
      </p>
      <p className="mt-1 text-[0.875rem] font-medium" style={{ color: "var(--text)" }}>
        {value}
      </p>
    </div>
  );
}

export function CompactStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-[0.8rem] border px-2.5 py-2" style={{ borderColor: "var(--border-faint)", background: "var(--bg-page)" }}>
      <p className="text-[0.625rem] font-semibold uppercase tracking-wider" style={{ color: "var(--text-faint)" }}>
        {label}
      </p>
      <p className="mt-1 truncate text-[0.8125rem] font-medium" style={{ color: "var(--text)" }}>
        {value}
      </p>
    </div>
  );
}
