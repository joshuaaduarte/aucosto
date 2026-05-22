"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { ThemeToggle } from "@/components/theme-toggle";
import { SignOutButton } from "./sign-out-button";

interface NavItem {
  href: string;
  label: string;
  match: (p: string) => boolean;
  finance: boolean;
  icon: React.ReactNode;
}

const navItems: NavItem[] = [
  {
    href: "/app",
    label: "Today",
    match: (p) => p === "/app",
    finance: false,
    icon: (
      <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden>
        <rect x="1.5" y="1.5" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.2" />
        <rect x="8.5" y="1.5" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.2" />
        <rect x="1.5" y="8.5" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.2" />
        <rect x="8.5" y="8.5" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.2" />
      </svg>
    ),
  },
  {
    href: "/app/calendar",
    label: "Calendar",
    match: (p) => p.startsWith("/app/calendar"),
    finance: false,
    icon: (
      <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden>
        <rect x="1.5" y="2.5" width="12" height="10" rx="1.2" stroke="currentColor" strokeWidth="1.2" />
        <path d="M4.5 1.5V4M10.5 1.5V4M1.5 6H13.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    href: "/app/time",
    label: "Time",
    match: (p) => p.startsWith("/app/time"),
    finance: false,
    icon: (
      <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden>
        <circle cx="7.5" cy="7.5" r="5.5" stroke="currentColor" strokeWidth="1.2" />
        <path d="M7.5 4.5V7.5l2 1.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    href: "/app/finance",
    label: "Finance",
    match: (p) => p.startsWith("/app/finance"),
    finance: true,
    icon: (
      <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden>
        <rect x="1.5" y="4" width="12" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.2" />
        <path d="M1.5 7.5h12" stroke="currentColor" strokeWidth="1.2" />
        <path d="M4.5 10.5h3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      </svg>
    ),
  },
];

function NavLinks({
  items,
  pathname,
  onNavigate,
}: {
  items: NavItem[];
  pathname: string;
  onNavigate?: () => void;
}) {
  return (
    <nav className="flex flex-col gap-0.5" aria-label="Tools">
      {items.map((item) => {
        const active = item.match(pathname);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              active
                ? "bg-paper-deep text-ink"
                : "text-ink-fade hover:bg-paper-deep/60 hover:text-ink"
            }`}
          >
            <span className={active ? "text-ink" : "text-ink-ghost"}>
              {item.icon}
            </span>
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

function SettingsLink({
  pathname,
  onNavigate,
}: {
  pathname: string;
  onNavigate?: () => void;
}) {
  const active = pathname.startsWith("/app/settings");
  return (
    <Link
      href="/app/settings"
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
        active
          ? "bg-paper-deep text-ink"
          : "text-ink-fade hover:bg-paper-deep/60 hover:text-ink"
      }`}
    >
      <span className={active ? "text-ink" : "text-ink-ghost"}>
        <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden>
          <circle cx="7.5" cy="7.5" r="2" stroke="currentColor" strokeWidth="1.2" />
          <path
            d="M7.5 1v1.5M7.5 12.5V14M1 7.5h1.5M12.5 7.5H14M2.697 2.697l1.06 1.06M11.243 11.243l1.06 1.06M2.697 12.303l1.06-1.06M11.243 3.757l1.06-1.06"
            stroke="currentColor"
            strokeWidth="1.2"
            strokeLinecap="round"
          />
        </svg>
      </span>
      Settings
    </Link>
  );
}

interface NavProps {
  showFinance: boolean;
  isDemoMode: boolean;
}

export function AppSidebar({ showFinance, isDemoMode }: NavProps) {
  const pathname = usePathname();
  const items = navItems.filter((i) => showFinance || !i.finance);

  return (
    <aside
      className="hidden lg:flex shrink-0 flex-col"
      style={{
        width: "220px",
        position: "sticky",
        top: 0,
        height: "100vh",
        overflowY: "auto",
        borderRight: "1px solid var(--rule-faint)",
        padding: "1.75rem 1rem",
      }}
    >
      <div className="mb-8 flex items-center gap-2 px-3">
        <Link
          href="/app"
          className="text-[1rem] font-semibold tracking-[-0.04em] text-ink transition-opacity hover:opacity-70"
        >
          aucosto
        </Link>
        {isDemoMode && (
          <span
            className="rounded px-1.5 py-0.5 font-mono text-[0.5625rem] uppercase tracking-[0.14em]"
            style={{ background: "var(--oxblood-soft)", color: "var(--oxblood)" }}
          >
            Demo
          </span>
        )}
      </div>

      <NavLinks items={items} pathname={pathname} />

      <div className="mt-auto flex flex-col gap-0.5">
        <SettingsLink pathname={pathname} />
        <div
          className="flex items-center gap-1 px-3 pt-3"
          style={{ borderTop: "1px solid var(--rule-faint)" }}
        >
          <ThemeToggle />
          <SignOutButton />
        </div>
      </div>
    </aside>
  );
}

export function MobileNav({ showFinance, isDemoMode }: NavProps) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const items = navItems.filter((i) => showFinance || !i.finance);

  return (
    <>
      <header
        className="lg:hidden sticky top-0 z-20 flex h-12 shrink-0 items-center gap-3 px-5"
        style={{
          background: "var(--paper)",
          borderBottom: "1px solid var(--rule-faint)",
        }}
      >
        <button
          onClick={() => setOpen(true)}
          className="rounded-md p-1.5 text-ink-fade transition-colors hover:bg-paper-deep hover:text-ink"
          aria-label="Open navigation"
        >
          <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden>
            <path
              d="M1.5 4h12M1.5 7.5h12M1.5 11h12"
              stroke="currentColor"
              strokeWidth="1.3"
              strokeLinecap="round"
            />
          </svg>
        </button>
        <Link
          href="/app"
          className="text-[0.9375rem] font-semibold tracking-[-0.04em] text-ink"
        >
          aucosto
        </Link>
        {isDemoMode && (
          <span
            className="rounded px-1.5 py-0.5 font-mono text-[0.5625rem] uppercase tracking-[0.14em]"
            style={{ background: "var(--oxblood-soft)", color: "var(--oxblood)" }}
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
            style={{ background: "rgba(0,0,0,0.25)" }}
            onClick={() => setOpen(false)}
            aria-hidden
          />
          <div
            className="fixed inset-y-0 left-0 z-40 flex flex-col"
            style={{
              width: "240px",
              background: "var(--paper)",
              borderRight: "1px solid var(--rule-faint)",
              padding: "1.5rem 1rem",
            }}
          >
            <div className="mb-8 flex items-center justify-between px-3">
              <Link
                href="/app"
                onClick={() => setOpen(false)}
                className="text-[1rem] font-semibold tracking-[-0.04em] text-ink"
              >
                aucosto
              </Link>
              <button
                onClick={() => setOpen(false)}
                className="rounded-md p-1.5 text-ink-fade transition-colors hover:bg-paper-deep hover:text-ink"
                aria-label="Close navigation"
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
                  <path
                    d="M2 2l10 10M12 2L2 12"
                    stroke="currentColor"
                    strokeWidth="1.3"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            </div>
            <NavLinks
              items={items}
              pathname={pathname}
              onNavigate={() => setOpen(false)}
            />
            <div className="mt-auto flex flex-col gap-0.5">
              <SettingsLink
                pathname={pathname}
                onNavigate={() => setOpen(false)}
              />
              <div
                className="flex items-center gap-1 px-3 pt-3"
                style={{ borderTop: "1px solid var(--rule-faint)" }}
              >
                <ThemeToggle />
                <SignOutButton />
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}
