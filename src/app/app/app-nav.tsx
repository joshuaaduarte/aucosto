"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/app",      label: "Hub",     match: (p: string) => p === "/app",                  finance: false },
  { href: "/app/calendar", label: "Calendar", match: (p: string) => p.startsWith("/app/calendar"), finance: false },
  { href: "/app/do", label: "Do List", match: (p: string) => p.startsWith("/app/do"), finance: false },
  { href: "/app/habits", label: "Habits", match: (p: string) => p.startsWith("/app/habits"), finance: false },
  { href: "/app/projects", label: "Projects", match: (p: string) => p.startsWith("/app/projects"), finance: false },
  { href: "/app/time", label: "Time",    match: (p: string) => p.startsWith("/app/time"),      finance: false },
  { href: "/app/finance", label: "Finance", match: (p: string) => p.startsWith("/app/finance"), finance: true },
];

export function AppNav({ showFinance }: { showFinance: boolean }) {
  const pathname = usePathname();

  return (
    <nav
      className="no-scrollbar -mx-1 flex gap-1 overflow-x-auto px-1"
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
              className={`relative shrink-0 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                active
                  ? "bg-paper-deep text-ink"
                  : "text-ink-fade hover:bg-paper-deep/60 hover:text-ink"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
    </nav>
  );
}
