"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/app", label: "Hub", match: (pathname: string) => pathname === "/app", finance: false },
  { href: "/app/time", label: "Time", match: (pathname: string) => pathname.startsWith("/app/time"), finance: false },
  { href: "/app/finance", label: "Finance", match: (pathname: string) => pathname.startsWith("/app/finance"), finance: true },
];

export function AppNav({ showFinance }: { showFinance: boolean }) {
  const pathname = usePathname();

  return (
    <nav className="no-scrollbar flex gap-2 overflow-x-auto pb-1 sm:flex-wrap sm:overflow-visible sm:pb-0" aria-label="Primary">
      {items.filter((item) => showFinance || !item.finance).map((item) => {
        const active = item.match(pathname);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`inline-flex min-h-11 shrink-0 items-center justify-center rounded-full px-4 text-sm font-medium transition-all ${
              active
                ? "bg-zinc-950 text-white shadow-sm"
                : "border border-zinc-200 bg-white/88 text-zinc-600 shadow-sm shadow-zinc-950/5 hover:-translate-y-0.5 hover:border-zinc-300 hover:text-zinc-950"
            }`}
            aria-current={active ? "page" : undefined}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
