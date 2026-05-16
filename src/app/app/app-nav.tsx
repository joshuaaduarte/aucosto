"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/app", label: "Hub", match: (pathname: string) => pathname === "/app" },
  { href: "/app/time", label: "Time", match: (pathname: string) => pathname.startsWith("/app/time") },
  { href: "/app/finance", label: "Finance", match: (pathname: string) => pathname.startsWith("/app/finance") },
];

export function AppNav() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-wrap gap-2" aria-label="Primary">
      {items.map((item) => {
        const active = item.match(pathname);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`inline-flex min-h-10 items-center justify-center rounded-full px-4 text-sm font-medium transition-colors ${
              active
                ? "bg-zinc-950 text-white shadow-sm dark:bg-white dark:text-zinc-950"
                : "border border-zinc-200 bg-white/80 text-zinc-600 hover:border-zinc-300 hover:text-zinc-950 dark:border-zinc-800 dark:bg-zinc-900/80 dark:text-zinc-300 dark:hover:border-zinc-700 dark:hover:text-zinc-50"
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
