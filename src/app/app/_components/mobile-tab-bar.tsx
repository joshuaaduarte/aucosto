"use client";

// Bottom tab bar for phones: the four areas you bounce between all day.
// The hamburger drawer stays for secondary destinations (habits, finance,
// projects, settings). Hidden on lg+ where the sidebar takes over. Its
// height is published as --mobile-tabbar-height (globals.css) so the
// running-timer bar and FAB can sit above it.

import Link from "next/link";
import { usePathname } from "next/navigation";

const ip = {
  width: 18,
  height: 18,
  viewBox: "0 0 15 15",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.25,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

const TABS = [
  {
    href: "/app",
    label: "Hub",
    icon: (
      <svg {...ip}>
        <path d="M2 6.5 7.5 2l5.5 4.5V13H2V6.5Z" />
        <path d="M6 13V9h3v4" />
      </svg>
    ),
  },
  {
    href: "/app/time",
    label: "Time",
    icon: (
      <svg {...ip}>
        <circle cx="7.5" cy="7.5" r="5.5" />
        <path d="M7.5 4.5V7.5l2 1.25" />
      </svg>
    ),
  },
  {
    href: "/app/do",
    label: "Do",
    icon: (
      <svg {...ip}>
        <path d="M5 4h8M5 7.5h8M5 11h5" />
        <circle cx="2.5" cy="4" r="0.6" fill="currentColor" />
        <circle cx="2.5" cy="7.5" r="0.6" fill="currentColor" />
        <circle cx="2.5" cy="11" r="0.6" fill="currentColor" />
      </svg>
    ),
  },
  {
    href: "/app/calendar",
    label: "Calendar",
    icon: (
      <svg {...ip}>
        <rect x="2" y="3" width="11" height="10" rx="1.5" />
        <path d="M2 6h11M5 1.75v2.5M10 1.75v2.5" />
      </svg>
    ),
  },
];

export function MobileTabBar() {
  const pathname = usePathname();

  return (
    <nav className="mobile-tabbar lg:hidden" aria-label="Primary">
      {TABS.map((tab) => {
        const active =
          tab.href === "/app"
            ? pathname === "/app"
            : pathname === tab.href || pathname.startsWith(`${tab.href}/`);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className="flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 py-1.5"
            style={{
              color: active ? "var(--text)" : "var(--text-faint)",
            }}
          >
            {tab.icon}
            <span className="text-[0.625rem] font-medium">{tab.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
