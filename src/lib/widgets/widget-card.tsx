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
      className="group relative block rounded-md px-4 py-4 transition-colors hover:bg-bg-hover"
      style={{
        background: "var(--bg-page)",
        border: "1px solid var(--border-soft)",
      }}
    >
      <header className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {folio && (
            <span
              className="text-[0.6875rem] font-medium"
              style={{ color: "var(--text-faint)" }}
            >
              {folio}
            </span>
          )}
          <h3
            className="text-[0.8125rem] font-semibold tracking-tight"
            style={{ color: "var(--text)" }}
          >
            {name}
          </h3>
        </div>
        <svg
          width="12"
          height="12"
          viewBox="0 0 13 13"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
          className="shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
          style={{ color: "var(--text-faint)" }}
        >
          <path d="M2.5 6.5h8M7 3l3.5 3.5L7 10" />
        </svg>
      </header>

      {children}
    </Link>
  );
}
