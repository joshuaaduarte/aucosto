"use client";

// Bottom tab bar for phones: the four areas you bounce between all day,
// plus a More tab that opens a half-sheet with the remaining tools
// (Habits, Projects, Finance when visible, Settings) and theme/sign-out.
// Hidden on lg+ where the sidebar takes over. Its height is published as
// --mobile-tabbar-height (globals.css) so the running-timer bar and FABs
// stack above it.

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { ThemeToggle } from "@/components/theme-toggle";
import { SignOutButton } from "../sign-out-button";
import { useBodyScrollLock } from "./use-body-scroll-lock";

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

type MoreTool = {
  href: string;
  label: string;
  icon: React.ReactNode;
  finance?: boolean;
};

const MORE_TOOLS: MoreTool[] = [
  {
    href: "/app/habits",
    label: "Habits",
    icon: (
      <svg {...ip}>
        <path d="M3 4.5h6.5a2.5 2.5 0 0 1 0 5H8.5" />
        <path d="M9.5 2.75 11.25 4.5 9.5 6.25" />
        <path d="M6.5 10.5H4a2.5 2.5 0 0 1 0-5h1" />
        <path d="M3.5 8.75 1.75 10.5 3.5 12.25" />
      </svg>
    ),
  },
  {
    href: "/app/projects",
    label: "Projects",
    icon: (
      <svg {...ip}>
        <rect x="2" y="3" width="11" height="3" rx="0.75" />
        <rect x="2" y="8.5" width="7.5" height="3" rx="0.75" />
      </svg>
    ),
  },
  {
    href: "/app/finance",
    label: "Finance",
    finance: true,
    icon: (
      <svg {...ip}>
        <path d="M2 5.5C2 4.67 2.67 4 3.5 4H12a1 1 0 0 1 1 1v6.5c0 .83-.67 1.5-1.5 1.5h-8A1.5 1.5 0 0 1 2 11.5V5.5Z" />
        <path d="M10 8.25h2.5" />
      </svg>
    ),
  },
  {
    href: "/app/insights",
    label: "Insights",
    icon: (
      <svg {...ip}>
        <path d="M1.5 12 5.5 7.5l2.5 2L13.5 3" />
        <path d="M10 3h3.5v3.5" />
      </svg>
    ),
  },
  {
    href: "/app/reflect",
    label: "Reflect",
    icon: (
      <svg {...ip}>
        <path d="M7.5 13.5c3.3 0 6-2.46 6-5.5 0-3.04-2.7-5.5-6-5.5s-6 2.46-6 5.5c0 1.27.47 2.44 1.26 3.37L2.2 13.4l3.06-.6c.7.45 1.46.7 2.24.7Z" />
        <path d="M5 6.75h5M5 9h3" />
      </svg>
    ),
  },
  {
    href: "/app/settings",
    label: "Settings",
    icon: (
      <svg {...ip}>
        <circle cx="7.5" cy="7.5" r="2" />
        <path d="M7.5 1.5v1.5M7.5 12v1.5M1.5 7.5H3M12 7.5h1.5M3 3l1 1M11 11l1 1M12 3l-1 1M4 11l-1 1" />
      </svg>
    ),
  },
];

export function MobileTabBar({
  showFinance,
  needsReflect = false,
}: {
  showFinance: boolean;
  /** Today has no saved reflection yet — show a subtle dot on More. */
  needsReflect?: boolean;
}) {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  useBodyScrollLock(moreOpen);

  // The reflection nudge only makes sense in the evening — before 6pm there's
  // nothing to act on yet, so a dot all day reads as false urgency. The hour
  // check must run client-side: the server is TZ-pinned to LA, but we want the
  // viewer's actual local hour. Defaults to false until mounted so SSR (and
  // the morning) never paints the dot.
  const [isEvening, setIsEvening] = useState(false);
  useEffect(() => {
    setIsEvening(new Date().getHours() >= 18);
  }, []);
  const showReflectDot = needsReflect && isEvening;

  const moreTools = MORE_TOOLS.filter((tool) => showFinance || !tool.finance);
  const moreActive = moreTools.some(
    (tool) => pathname === tool.href || pathname.startsWith(`${tool.href}/`),
  );

  return (
    <>
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
              style={{ color: active ? "var(--text)" : "var(--text-faint)" }}
            >
              {tab.icon}
              <span className="text-[0.625rem] font-medium">{tab.label}</span>
            </Link>
          );
        })}

        <button
          type="button"
          onClick={() => setMoreOpen(true)}
          aria-haspopup="dialog"
          aria-expanded={moreOpen}
          className="relative flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 py-1.5"
          style={{ color: moreActive ? "var(--text)" : "var(--text-faint)" }}
        >
          <svg {...ip}>
            <circle cx="3" cy="7.5" r="0.9" fill="currentColor" stroke="none" />
            <circle cx="7.5" cy="7.5" r="0.9" fill="currentColor" stroke="none" />
            <circle cx="12" cy="7.5" r="0.9" fill="currentColor" stroke="none" />
          </svg>
          <span className="text-[0.625rem] font-medium">More</span>
          {showReflectDot ? (
            <span
              className="absolute right-1/2 top-1 h-1.5 w-1.5 -translate-x-3 rounded-full"
              style={{ background: "var(--accent)" }}
              aria-hidden
              title="No reflection saved today"
            />
          ) : null}
        </button>
      </nav>

      {moreOpen ? (
        <div
          className="calendar-modal-backdrop"
          role="presentation"
          onClick={() => setMoreOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="More tools"
            className="calendar-modal"
            onClick={(event) => event.stopPropagation()}
          >
            <p
              className="text-[0.6875rem] font-semibold uppercase tracking-wider"
              style={{ color: "var(--text-faint)" }}
            >
              More tools
            </p>

            <div className="mt-3 grid grid-cols-2 gap-2">
              {moreTools.map((tool) => {
                const active =
                  pathname === tool.href ||
                  pathname.startsWith(`${tool.href}/`);
                return (
                  <Link
                    key={tool.href}
                    href={tool.href}
                    onClick={() => setMoreOpen(false)}
                    aria-current={active ? "page" : undefined}
                    className="flex items-center gap-2.5 rounded-md border px-3 py-3 text-[0.875rem] font-medium"
                    style={{
                      borderColor: active
                        ? "var(--border)"
                        : "var(--border-faint)",
                      background: active ? "var(--bg-tint)" : "var(--bg-page)",
                      color: "var(--text)",
                    }}
                  >
                    <span style={{ color: "var(--text-muted)" }}>
                      {tool.icon}
                    </span>
                    {tool.label}
                  </Link>
                );
              })}
            </div>

            <div
              className="mt-4 flex items-center justify-between border-t pt-3"
              style={{ borderColor: "var(--border-faint)" }}
            >
              <ThemeToggle />
              <SignOutButton />
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
