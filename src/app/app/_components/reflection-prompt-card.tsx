import Link from "next/link";

// Persistent nudge to reflect on yesterday. Unlike the evening "How was your
// day?" strip (ReflectSection, about *today*), this stays on the hub all day
// until yesterday's reflection is done — a passed day left unreflected is a gap
// to close. Before noon it renders loud (accent-tinted): the morning is the
// natural time to look back. Once yesterday is reflected, it renders nothing.
//
// The link carries ?date=<yesterdayKey> so saving actually clears the prompt
// (the reflect page/form reflect on that specific day, not just today).

export function ReflectionPromptCard({
  reflectedYesterday,
  prominent,
  yesterdayKey,
  yesterdayLabel,
}: {
  reflectedYesterday: boolean;
  /** Before noon → the loud, accent-tinted variant. */
  prominent: boolean;
  yesterdayKey: string;
  yesterdayLabel: string;
}) {
  if (reflectedYesterday) return null;

  const href = `/app/reflect?date=${yesterdayKey}`;

  return (
    <section
      className="fade-in-delay-1 flex flex-wrap items-center justify-between gap-3 rounded-lg border px-4 py-3.5"
      style={{
        background: prominent ? "var(--accent-tint)" : "var(--bg-page)",
        borderColor: prominent
          ? "var(--accent-tint-strong)"
          : "var(--border-faint)",
        borderLeft: `3px solid ${prominent ? "var(--accent)" : "var(--border-soft)"}`,
      }}
    >
      <div className="flex min-w-0 items-start gap-3">
        <span aria-hidden className="text-[1.375rem] leading-none">
          📝
        </span>
        <div className="min-w-0">
          <p className="text-[0.875rem] font-semibold" style={{ color: "var(--text)" }}>
            Reflect on {yesterdayLabel}
          </p>
          <p className="mt-0.5 text-[0.8125rem]" style={{ color: "var(--text-muted)" }}>
            {prominent
              ? "Take a minute before the day gets going — yesterday's reflection is still open."
              : "Yesterday's reflection hasn't been done yet."}
          </p>
        </div>
      </div>
      <Link
        href={href}
        className={
          prominent
            ? "btn-ink h-9 shrink-0 px-3.5 text-[0.8125rem]"
            : "btn-ghost shrink-0 text-[0.8125rem]"
        }
        style={prominent ? undefined : { color: "var(--text-muted)" }}
      >
        Reflect →
      </Link>
    </section>
  );
}
