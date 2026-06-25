"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { ThemeToggle } from "@/components/theme-toggle";
import { SignOutButton } from "./sign-out-button";

/* ──────────────────────────────────────────────────────────────────
   Monoline icons
   ────────────────────────────────────────────────────────────────── */
const ip = {
  width: 15,
  height: 15,
  viewBox: "0 0 15 15",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.25,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

function HomeIcon() {
  return (
    <svg {...ip}>
      <path d="M2 6.5 7.5 2l5.5 4.5V13H2V6.5Z" />
      <path d="M6 13V9h3v4" />
    </svg>
  );
}
function CalendarIcon() {
  return (
    <svg {...ip}>
      <rect x="2" y="3" width="11" height="10" rx="1.5" />
      <path d="M2 6h11M5 1.75v2.5M10 1.75v2.5" />
    </svg>
  );
}
function ClockIcon() {
  return (
    <svg {...ip}>
      <circle cx="7.5" cy="7.5" r="5.5" />
      <path d="M7.5 4.5V7.5l2 1.25" />
    </svg>
  );
}
function ListIcon() {
  return (
    <svg {...ip}>
      <path d="M5 4h8M5 7.5h8M5 11h5" />
      <circle cx="2.5" cy="4" r="0.6" fill="currentColor" />
      <circle cx="2.5" cy="7.5" r="0.6" fill="currentColor" />
      <circle cx="2.5" cy="11" r="0.6" fill="currentColor" />
    </svg>
  );
}
function RepeatIcon() {
  return (
    <svg {...ip}>
      <path d="M3 4.5h6.5a2.5 2.5 0 0 1 0 5H8.5" />
      <path d="M9.5 2.75 11.25 4.5 9.5 6.25" />
      <path d="M6.5 10.5H4a2.5 2.5 0 0 1 0-5h1" />
      <path d="M3.5 8.75 1.75 10.5 3.5 12.25" />
    </svg>
  );
}
function WalletIcon() {
  return (
    <svg {...ip}>
      <path d="M2 5.5C2 4.67 2.67 4 3.5 4H12a1 1 0 0 1 1 1v6.5c0 .83-.67 1.5-1.5 1.5h-8A1.5 1.5 0 0 1 2 11.5V5.5Z" />
      <path d="M10 8.25h2.5" />
    </svg>
  );
}
function PlateIcon() {
  return (
    <svg {...ip}>
      <circle cx="7.5" cy="7.5" r="5.5" />
      <circle cx="7.5" cy="7.5" r="2.5" />
    </svg>
  );
}
function PulseIcon() {
  return (
    <svg {...ip}>
      <path d="M1.5 8h2.25l1.5-4 2 8 1.75-4h4.5" />
    </svg>
  );
}
function ProjectsIcon() {
  return (
    <svg {...ip}>
      <rect x="2" y="3" width="11" height="3" rx="0.75" />
      <rect x="2" y="8.5" width="7.5" height="3" rx="0.75" />
    </svg>
  );
}
function RolodexIcon() {
  return (
    <svg {...ip}>
      <circle cx="6" cy="6" r="3" />
      <path d="M1.5 13c0-2.5 2-4 4.5-4s4.5 1.5 4.5 4" />
      <path d="M10.5 4h3M10.5 7.5h3M10.5 11h2" />
    </svg>
  );
}
function TrendIcon() {
  return (
    <svg {...ip}>
      <path d="M1.5 12 5.5 7.5l2.5 2L13.5 3" />
      <path d="M10 3h3.5v3.5" />
    </svg>
  );
}
function ReflectIcon() {
  return (
    <svg {...ip}>
      <path d="M7.5 13.5c3.3 0 6-2.46 6-5.5 0-3.04-2.7-5.5-6-5.5s-6 2.46-6 5.5c0 1.27.47 2.44 1.26 3.37L2.2 13.4l3.06-.6c.7.45 1.46.7 2.24.7Z" />
      <path d="M5 6.75h5M5 9h3" />
    </svg>
  );
}
function AssistantIcon() {
  return (
    <svg {...ip}>
      <rect x="2.5" y="3.5" width="10" height="8" rx="1.5" />
      <path d="M5.5 6.25h.01M9.5 6.25h.01M5 9h5" />
      <path d="M7.5 1.5v2" />
    </svg>
  );
}
function GearIcon() {
  return (
    <svg {...ip}>
      <circle cx="7.5" cy="7.5" r="2" />
      <path d="M7.5 1.5v1.5M7.5 12v1.5M1.5 7.5H3M12 7.5h1.5M3 3l1 1M11 11l1 1M12 3l-1 1M4 11l-1 1" />
    </svg>
  );
}
function ChevronDown() {
  return (
    <svg width="11" height="11" viewBox="0 0 11 11" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="m3 4 2.5 2.5L8 4" />
    </svg>
  );
}
function ChevronRight() {
  return (
    <svg width="11" height="11" viewBox="0 0 11 11" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="m4 3 2.5 2.5L4 8" />
    </svg>
  );
}

/* ──────────────────────────────────────────────────────────────────
   Nav model
   ────────────────────────────────────────────────────────────────── */

interface NavItem {
  href: string;
  label: string;
  match: (p: string) => boolean;
  finance: boolean;
  icon: React.ReactNode;
}

const navItems: NavItem[] = [
  { href: "/app", label: "Today", match: (p) => p === "/app", finance: false, icon: <HomeIcon /> },
  { href: "/app/calendar", label: "Calendar", match: (p) => p.startsWith("/app/calendar"), finance: false, icon: <CalendarIcon /> },
  { href: "/app/do", label: "Do List", match: (p) => p.startsWith("/app/do"), finance: false, icon: <ListIcon /> },
  { href: "/app/habits", label: "Habits", match: (p) => p.startsWith("/app/habits"), finance: false, icon: <RepeatIcon /> },
  { href: "/app/time", label: "Time", match: (p) => p.startsWith("/app/time"), finance: false, icon: <ClockIcon /> },
  { href: "/app/projects", label: "Projects", match: (p) => p.startsWith("/app/projects"), finance: false, icon: <ProjectsIcon /> },
  { href: "/app/rolodex", label: "Rolodex", match: (p) => p.startsWith("/app/rolodex"), finance: false, icon: <RolodexIcon /> },
  { href: "/app/reflect", label: "Reflect", match: (p) => p.startsWith("/app/reflect"), finance: false, icon: <ReflectIcon /> },
  { href: "/app/insights", label: "Insights", match: (p) => p.startsWith("/app/insights"), finance: false, icon: <TrendIcon /> },
  { href: "/app/finance", label: "Finance", match: (p) => p.startsWith("/app/finance"), finance: true, icon: <WalletIcon /> },
  { href: "/app/assistant", label: "Assistant", match: (p) => p.startsWith("/app/assistant"), finance: false, icon: <AssistantIcon /> },
];

const comingSoon: Array<{ label: string; icon: React.ReactNode }> = [
  { label: "Calories", icon: <PlateIcon /> },
  { label: "Fitness", icon: <PulseIcon /> },
];

/* ──────────────────────────────────────────────────────────────────
   Sidebar pieces
   ────────────────────────────────────────────────────────────────── */

function NavLink({
  item,
  pathname,
  onNavigate,
}: {
  item: NavItem;
  pathname: string;
  onNavigate?: () => void;
}) {
  const active = item.match(pathname);
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className="nav-item group"
    >
      <span
        className="shrink-0"
        style={{
          color: active ? "var(--text)" : "var(--text-faint)",
        }}
      >
        {item.icon}
      </span>
      <span className="truncate">{item.label}</span>
    </Link>
  );
}

function GroupHeader({
  label,
  open,
  onToggle,
}: {
  label: string;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="flex w-full items-center gap-1 rounded px-2 py-1 text-left text-[0.6875rem] font-semibold uppercase tracking-wider transition-colors hover:bg-bg-hover"
      style={{ color: "var(--text-faint)" }}
    >
      <span
        style={{
          display: "inline-flex",
          width: "11px",
          color: "var(--text-faint)",
        }}
      >
        {open ? <ChevronDown /> : <ChevronRight />}
      </span>
      <span>{label}</span>
    </button>
  );
}

interface NavProps {
  showFinance: boolean;
  isDemoMode: boolean;
}

function SidebarContents({
  showFinance,
  isDemoMode,
  onNavigate,
}: NavProps & { onNavigate?: () => void }) {
  const pathname = usePathname();
  const items = navItems.filter((i) => showFinance || !i.finance);

  const [soonOpen, setSoonOpen] = useState(false);

  return (
    <>
      {/* Workspace header */}
      <div className="mb-3 flex items-center gap-2 px-2 pt-0.5">
        <span
          className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded text-[0.6875rem] font-semibold"
          style={{
            background: "var(--text)",
            color: "var(--bg-page)",
            letterSpacing: "-0.02em",
          }}
        >
          A
        </span>
        <div className="min-w-0 flex-1">
          <p
            className="truncate text-[0.8125rem] font-semibold tracking-tight"
            style={{ color: "var(--text)" }}
          >
            Joshua&apos;s workspace
          </p>
        </div>
        {isDemoMode && (
          <span
            className="shrink-0 rounded px-1.5 py-0.5 text-[0.625rem] font-medium uppercase tracking-wider"
            style={{
              background: "var(--accent-tint)",
              color: "var(--accent-strong)",
            }}
          >
            Demo
          </span>
        )}
      </div>

      {/* Search affordance — visual only for now, wires up to a real palette later */}
      <button
        type="button"
        className="mb-4 flex w-full items-center gap-2 rounded px-2 py-1 text-left text-[0.8125rem] transition-colors hover:bg-bg-hover"
        style={{ color: "var(--text-faint)" }}
        disabled
        aria-disabled
      >
        <svg width="14" height="14" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" aria-hidden>
          <circle cx="6.5" cy="6.5" r="4" />
          <path d="m9.5 9.5 3 3" />
        </svg>
        <span>Search</span>
        <span
          className="ml-auto font-mono text-[0.6875rem]"
          style={{ color: "var(--text-ghost)" }}
        >
          ⌘K
        </span>
      </button>

      {/* Workspace group */}
      <p
        className="mb-1 px-2 text-[0.6875rem] font-semibold uppercase tracking-wider"
        style={{ color: "var(--text-faint)" }}
      >
        Workspace
      </p>
      <nav className="mb-2 flex flex-col gap-0.5" aria-label="Tools">
        {items.map((item) => (
          <NavLink
            key={item.href}
            item={item}
            pathname={pathname}
            onNavigate={onNavigate}
          />
        ))}
      </nav>

      {/* Coming soon group — collapsible */}
      <div className="mt-3">
        <GroupHeader
          label="Coming soon"
          open={soonOpen}
          onToggle={() => setSoonOpen((v) => !v)}
        />
        {soonOpen && (
          <div className="mt-0.5 flex flex-col gap-0.5">
            {comingSoon.map((item) => (
              <div
                key={item.label}
                className="nav-item cursor-default"
                style={{ color: "var(--text-faint)" }}
                title="Not built yet"
              >
                <span style={{ color: "var(--text-ghost)" }}>{item.icon}</span>
                <span className="truncate">{item.label}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="mt-auto pt-3" style={{ borderTop: "1px solid var(--border-faint)" }}>
        <Link
          href="/app/settings"
          onClick={onNavigate}
          aria-current={pathname.startsWith("/app/settings") ? "page" : undefined}
          className="nav-item"
        >
          <span style={{ color: "var(--text-faint)" }}>
            <GearIcon />
          </span>
          Settings
        </Link>
        <div className="mt-2 flex items-center justify-between px-1">
          <ThemeToggle />
          <SignOutButton />
        </div>
      </div>
    </>
  );
}

/* ──────────────────────────────────────────────────────────────────
   Public components
   ────────────────────────────────────────────────────────────────── */

export function AppSidebar({ showFinance, isDemoMode }: NavProps) {
  return (
    <aside
      className="hidden lg:flex shrink-0 flex-col"
      style={{
        width: "240px",
        position: "sticky",
        top: 0,
        height: "100vh",
        overflowY: "auto",
        background: "var(--bg-app)",
        borderRight: "1px solid var(--border-faint)",
        padding: "0.875rem 0.625rem",
      }}
    >
      <SidebarContents showFinance={showFinance} isDemoMode={isDemoMode} />
    </aside>
  );
}

export function MobileNav({ showFinance, isDemoMode }: NavProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <header
        className="lg:hidden sticky top-0 z-20 flex h-12 shrink-0 items-center gap-2 px-4"
        style={{
          background: "var(--bg-app)",
          borderBottom: "1px solid var(--border-faint)",
        }}
      >
        <button
          onClick={() => setOpen(true)}
          className="btn-icon"
          aria-label="Open navigation"
        >
          <svg width="14" height="14" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" aria-hidden>
            <path d="M1.5 4h12M1.5 7.5h12M1.5 11h12" />
          </svg>
        </button>
        <span
          className="inline-flex h-6 w-6 items-center justify-center rounded text-[0.6875rem] font-semibold"
          style={{
            background: "var(--text)",
            color: "var(--bg-page)",
          }}
        >
          A
        </span>
        <span
          className="text-[0.875rem] font-semibold tracking-tight"
          style={{ color: "var(--text)" }}
        >
          aucosto
        </span>
        {isDemoMode && (
          <span
            className="rounded px-1.5 py-0.5 text-[0.625rem] font-medium uppercase tracking-wider"
            style={{
              background: "var(--accent-tint)",
              color: "var(--accent-strong)",
            }}
          >
            Demo
          </span>
        )}
        <div className="ml-auto flex items-center gap-1">
          <ThemeToggle />
          <SignOutButton />
        </div>
      </header>

      {open && (
        <>
          <div
            className="fixed inset-0 z-30"
            style={{ background: "rgba(15,15,15,0.32)" }}
            onClick={() => setOpen(false)}
            aria-hidden
          />
          <div
            className="fixed inset-y-0 left-0 z-40 flex flex-col"
            style={{
              width: "260px",
              background: "var(--bg-app)",
              borderRight: "1px solid var(--border-soft)",
              padding: "0.875rem 0.625rem",
            }}
          >
            <button
              onClick={() => setOpen(false)}
              className="btn-icon absolute right-2 top-2"
              aria-label="Close navigation"
            >
              <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" aria-hidden>
                <path d="M2 2l10 10M12 2L2 12" />
              </svg>
            </button>
            <SidebarContents
              showFinance={showFinance}
              isDemoMode={isDemoMode}
              onNavigate={() => setOpen(false)}
            />
          </div>
        </>
      )}
    </>
  );
}
