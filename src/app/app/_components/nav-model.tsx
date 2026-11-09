// One nav model for the desktop sidebar and the phone's More sheet, so the
// two never drift. Tools are grouped by what part of life they cover; the
// Assistant lives under Settings (it's a control panel, not a daily tool).

import type { ReactNode } from "react";

export type NavGroupId = "day" | "life" | "household" | "work";

export const NAV_GROUPS: Array<{ id: NavGroupId; label: string }> = [
  { id: "day", label: "Day" },
  { id: "life", label: "Life" },
  { id: "household", label: "Household" },
  { id: "work", label: "Work and people" },
];

export type NavTool = {
  href: string;
  label: string;
  group: NavGroupId;
  /** Hidden when finance is switched off in Settings → Privacy. */
  finance?: boolean;
  /** Shown to household partners (Home + Money only). */
  partner?: boolean;
  /** Icon strokes, drawn in a 15×15 box. */
  paths: ReactNode;
};

export const NAV_TOOLS: NavTool[] = [
  {
    href: "/app",
    label: "Today",
    group: "day",
    paths: (
      <>
        <path d="M1.5 11.5h12" />
        <path d="M4 11.5a3.5 3.5 0 0 1 7 0" />
        <path d="M7.5 3v2M2.9 5.9l1.2 1.2M12.1 5.9l-1.2 1.2" />
        <path d="M4.5 13.5h6" />
      </>
    ),
  },
  {
    href: "/app/plan",
    label: "Plan",
    group: "day",
    paths: (
      <>
        <rect x="2" y="3" width="11" height="10" rx="1.5" />
        <path d="M5 6.5h5M5 9.5h3" />
      </>
    ),
  },
  {
    href: "/app/review",
    label: "Weekly review",
    group: "day",
    paths: (
      <>
        <rect x="2" y="3" width="11" height="10" rx="1.5" />
        <path d="M2 6h11" />
        <path d="m5 9.25 1.5 1.5L10 7.75" />
      </>
    ),
  },
  {
    href: "/app/calendar",
    label: "Calendar",
    group: "day",
    paths: (
      <>
        <rect x="2" y="3" width="11" height="10" rx="1.5" />
        <path d="M2 6h11M5 1.75v2.5M10 1.75v2.5" />
      </>
    ),
  },
  {
    href: "/app/do",
    label: "Do List",
    group: "day",
    paths: (
      <>
        <path d="M5 4h8M5 7.5h8M5 11h5" />
        <circle cx="2.5" cy="4" r="0.6" fill="currentColor" />
        <circle cx="2.5" cy="7.5" r="0.6" fill="currentColor" />
        <circle cx="2.5" cy="11" r="0.6" fill="currentColor" />
      </>
    ),
  },
  {
    href: "/app/time",
    label: "Time",
    group: "day",
    paths: (
      <>
        <circle cx="7.5" cy="7.5" r="5.5" />
        <path d="M7.5 4.5V7.5l2 1.25" />
      </>
    ),
  },
  {
    href: "/app/habits",
    label: "Habits",
    group: "life",
    paths: (
      <>
        <path d="M3 4.5h6.5a2.5 2.5 0 0 1 0 5H8.5" />
        <path d="M9.5 2.75 11.25 4.5 9.5 6.25" />
        <path d="M6.5 10.5H4a2.5 2.5 0 0 1 0-5h1" />
        <path d="M3.5 8.75 1.75 10.5 3.5 12.25" />
      </>
    ),
  },
  {
    href: "/app/reflect",
    label: "Reflect",
    group: "life",
    paths: (
      <>
        <path d="M7.5 13.5c3.3 0 6-2.46 6-5.5 0-3.04-2.7-5.5-6-5.5s-6 2.46-6 5.5c0 1.27.47 2.44 1.26 3.37L2.2 13.4l3.06-.6c.7.45 1.46.7 2.24.7Z" />
        <path d="M5 6.75h5M5 9h3" />
      </>
    ),
  },
  {
    href: "/app/insights",
    label: "Insights",
    group: "life",
    paths: (
      <>
        <path d="M1.5 12 5.5 7.5l2.5 2L13.5 3" />
        <path d="M10 3h3.5v3.5" />
      </>
    ),
  },
  {
    href: "/app/projects",
    label: "Projects",
    group: "life",
    paths: (
      <>
        <rect x="2" y="3" width="11" height="3" rx="0.75" />
        <rect x="2" y="8.5" width="7.5" height="3" rx="0.75" />
      </>
    ),
  },
  {
    href: "/app/home",
    label: "Home",
    group: "household",
    partner: true,
    paths: (
      <>
        <path d="M1.75 7 7.5 2.25 13.25 7" />
        <path d="M3.25 6v6.75h8.5V6" />
        <rect x="6" y="9" width="3" height="3.75" />
      </>
    ),
  },
  {
    href: "/app/finance",
    label: "Money",
    group: "household",
    finance: true,
    partner: true,
    paths: (
      <>
        <path d="M2 5.5C2 4.67 2.67 4 3.5 4H12a1 1 0 0 1 1 1v6.5c0 .83-.67 1.5-1.5 1.5h-8A1.5 1.5 0 0 1 2 11.5V5.5Z" />
        <path d="M10 8.25h2.5" />
      </>
    ),
  },
  {
    href: "/app/work",
    label: "Work",
    group: "work",
    paths: (
      <>
        <rect x="1.75" y="4.5" width="11.5" height="8" rx="1.25" />
        <path d="M5.5 4.5V3.25c0-.55.45-1 1-1h2c.55 0 1 .45 1 1V4.5" />
        <path d="M1.75 7.75h11.5" />
      </>
    ),
  },
  {
    href: "/app/rolodex",
    label: "Rolodex",
    group: "work",
    paths: (
      <>
        <circle cx="6" cy="6" r="3" />
        <path d="M1.5 13c0-2.5 2-4 4.5-4s4.5 1.5 4.5 4" />
        <path d="M10.5 4h3M10.5 7.5h3M10.5 11h2" />
      </>
    ),
  },
];

export const SETTINGS_PATHS = (
  <>
    <circle cx="7.5" cy="7.5" r="2" />
    <path d="M7.5 1.5v1.5M7.5 12v1.5M1.5 7.5H3M12 7.5h1.5M3 3l1 1M11 11l1 1M12 3l-1 1M4 11l-1 1" />
  </>
);

export function NavIcon({ paths, size = 15 }: { paths: ReactNode; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 15 15"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.25}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {paths}
    </svg>
  );
}

/** Today matches only the hub itself; every other tool matches its subtree. */
export function navActive(href: string, pathname: string): boolean {
  if (href === "/app") return pathname === "/app";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function visibleTools({ showFinance, isPartner }: { showFinance: boolean; isPartner: boolean }): NavTool[] {
  return NAV_TOOLS.filter((t) => showFinance || !t.finance).filter((t) => !isPartner || t.partner);
}

export function toolByHref(href: string): NavTool {
  const tool = NAV_TOOLS.find((t) => t.href === href);
  if (!tool) throw new Error(`No nav tool for ${href}`);
  return tool;
}
