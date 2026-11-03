"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { NAV_GROUPS, NavIcon, navActive, SETTINGS_PATHS, visibleTools, type NavTool } from "./_components/nav-model";
import { ThemeToggle } from "@/components/theme-toggle";
import { openCommandPalette } from "./_components/command-palette";
import { openQuickCapture } from "./_components/quick-capture";
import { SignOutButton } from "./sign-out-button";

function NavLink({
  tool,
  pathname,
  onNavigate,
}: {
  tool: NavTool;
  pathname: string;
  onNavigate?: () => void;
}) {
  const active = navActive(tool.href, pathname);
  return (
    <Link href={tool.href} onClick={onNavigate} aria-current={active ? "page" : undefined} className="nav-item group">
      <span className="shrink-0" style={{ color: active ? "var(--text)" : "var(--text-faint)" }}>
        <NavIcon paths={tool.paths} />
      </span>
      <span className="truncate">{tool.label}</span>
    </Link>
  );
}

interface NavProps {
  showFinance: boolean;
  isDemoMode: boolean;
  isPartner?: boolean;
  workspaceLabel?: string;
}

function SidebarContents({
  showFinance,
  isDemoMode,
  isPartner = false,
  workspaceLabel = "Your workspace",
  onNavigate,
}: NavProps & { onNavigate?: () => void }) {
  const pathname = usePathname();
  const tools = visibleTools({ showFinance, isPartner });
  const groups = NAV_GROUPS.map((group) => ({ ...group, tools: tools.filter((t) => t.group === group.id) })).filter(
    (group) => group.tools.length > 0,
  );

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
            {workspaceLabel}
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

      {/* Quick capture: the desktop twin of the phone's centre "+". */}
      <button
        type="button"
        onClick={() => openQuickCapture()}
        className="mb-1 flex w-full items-center gap-2 rounded px-2 py-1 text-left text-[0.8125rem] font-medium transition-colors hover:bg-bg-hover"
        style={{ color: "var(--text)" }}
      >
        <span
          className="inline-flex h-4 w-4 items-center justify-center rounded-full"
          style={{ background: "var(--accent)", color: "#fff" }}
          aria-hidden
        >
          <svg width="10" height="10" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M7.5 3v9M3 7.5h9" />
          </svg>
        </span>
        <span>New</span>
        <span className="ml-auto font-mono text-[0.6875rem]" style={{ color: "var(--text-ghost)" }}>
          N
        </span>
      </button>

      {/* Search affordance — opens the global command palette */}
      {isPartner ? null : (
      <button
        type="button"
        onClick={() => openCommandPalette()}
        className="mb-4 flex w-full items-center gap-2 rounded px-2 py-1 text-left text-[0.8125rem] transition-colors hover:bg-bg-hover"
        style={{ color: "var(--text-faint)" }}
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
      )}

      <nav className="mb-2 flex flex-col gap-4" aria-label="Tools">
        {groups.map((group) => (
          <div key={group.id}>
            {isPartner ? null : (
              <p
                className="mb-1 px-2 text-[0.6875rem] font-semibold uppercase tracking-wider"
                style={{ color: "var(--text-faint)" }}
              >
                {group.label}
              </p>
            )}
            <div className="flex flex-col gap-0.5">
              {group.tools.map((tool) => (
                <NavLink key={tool.href} tool={tool} pathname={pathname} onNavigate={onNavigate} />
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="mt-auto pt-3" style={{ borderTop: "1px solid var(--border-faint)" }}>
        <Link
          href="/app/settings"
          onClick={onNavigate}
          aria-current={pathname.startsWith("/app/settings") ? "page" : undefined}
          className="nav-item"
        >
          <span style={{ color: "var(--text-faint)" }}>
            <NavIcon paths={SETTINGS_PATHS} />
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

export function AppSidebar(props: NavProps) {
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
      <SidebarContents {...props} />
    </aside>
  );
}

export function MobileNav(props: NavProps) {
  const { isDemoMode } = props;
  const [open, setOpen] = useState(false);

  return (
    <>
      <header
        className="lg:hidden sticky top-0 z-20 flex h-12 shrink-0 items-center gap-2 px-4"
        style={{
          background: "var(--bg-app)",
          borderBottom: "1px solid var(--border-faint)",
          // Installed-app mode extends under the iOS status bar
          // (black-translucent) — pad the header down past it. 0 in Safari.
          paddingTop: "var(--safe-area-top)",
          height: "calc(3rem + var(--safe-area-top))",
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
              paddingTop: "calc(0.875rem + var(--safe-area-top))",
              paddingBottom: "calc(0.875rem + var(--safe-area-bottom))",
              overflowY: "auto",
            }}
          >
            <button
              onClick={() => setOpen(false)}
              className="btn-icon absolute right-2"
              style={{ top: "calc(0.5rem + var(--safe-area-top))" }}
              aria-label="Close navigation"
            >
              <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" aria-hidden>
                <path d="M2 2l10 10M12 2L2 12" />
              </svg>
            </button>
            <SidebarContents {...props} onNavigate={() => setOpen(false)} />
          </div>
        </>
      )}
    </>
  );
}
