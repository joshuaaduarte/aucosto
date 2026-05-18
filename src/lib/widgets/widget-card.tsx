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
      className="group relative block rounded-xl px-5 pt-5 pb-5 transition-shadow hover:shadow-md"
      style={{
        background: "var(--surface)",
        boxShadow: "var(--surface-shadow)",
      }}
    >
      {/* Header */}
      <header className="mb-5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {folio && (
            <span className="font-mono text-[0.625rem] tracking-[0.1em] text-ink-ghost">
              {folio}
            </span>
          )}
          <h3 className="text-sm font-semibold tracking-[-0.01em] text-ink">
            {name}
          </h3>
        </div>
        <svg
          width="14"
          height="14"
          viewBox="0 0 14 14"
          fill="none"
          aria-hidden
          className="shrink-0 text-ink-ghost transition-transform group-hover:translate-x-0.5"
        >
          <path
            d="M3 7h8M7.5 3.5 11 7l-3.5 3.5"
            stroke="currentColor"
            strokeWidth="1.25"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </header>

      {children}
    </Link>
  );
}
