import Link from "next/link";

export function WidgetCard({
  name,
  href,
  children,
  folio,
}: {
  name: string;
  href: string;
  children: React.ReactNode;
  folio?: string;
}) {
  return (
    <Link
      href={href}
      className="group relative block bg-paper-deep/40 px-6 pt-7 pb-7 rule-t border-ink/15 transition-colors hover:bg-paper-deep/70"
    >
      <div className="absolute left-0 right-0 top-0 h-px bg-ink/85" />

      <header className="mb-6 flex items-baseline justify-between gap-4">
        <div className="flex items-baseline gap-3">
          <span className="font-mono text-[0.6875rem] uppercase tracking-[0.28em] text-ink-fade">
            {folio ?? "§"}
          </span>
          <h3 className="font-display text-[1.35rem] leading-none tracking-[-0.01em] text-ink">
            {name}
          </h3>
        </div>
        <span
          aria-hidden
          className="font-display text-2xl leading-none text-ink-fade transition-all group-hover:text-oxblood group-hover:translate-x-1"
        >
          →
        </span>
      </header>

      {children}
    </Link>
  );
}
