"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/app", label: "The Hub", folio: "I", match: (pathname: string) => pathname === "/app", finance: false },
  { href: "/app/time", label: "Dispatch", folio: "II", match: (pathname: string) => pathname.startsWith("/app/time"), finance: false },
  { href: "/app/finance", label: "Ledger", folio: "III", match: (pathname: string) => pathname.startsWith("/app/finance"), finance: true },
];

export function AppNav({ showFinance }: { showFinance: boolean }) {
  const pathname = usePathname();

  return (
    <nav
      className="no-scrollbar -mx-5 flex gap-7 overflow-x-auto px-5 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 sm:pb-0"
      aria-label="Sections"
    >
      {items
        .filter((item) => showFinance || !item.finance)
        .map((item) => {
          const active = item.match(pathname);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`group relative inline-flex shrink-0 items-baseline gap-2 py-1 font-serif text-[0.95rem] transition-colors ${
                active
                  ? "text-ink"
                  : "text-ink-fade hover:text-ink"
              }`}
            >
              <span
                className={`font-mono text-[0.625rem] uppercase tracking-[0.22em] tabular ${
                  active ? "text-oxblood" : "text-ink-ghost group-hover:text-ink-fade"
                }`}
              >
                {item.folio}
              </span>
              <span className={active ? "italic" : ""}>{item.label}</span>
              <span
                aria-hidden
                className={`absolute -bottom-[5px] left-0 right-0 h-px origin-left bg-ink transition-transform duration-300 ${
                  active ? "scale-x-100" : "scale-x-0 group-hover:scale-x-100"
                }`}
              />
            </Link>
          );
        })}
    </nav>
  );
}
