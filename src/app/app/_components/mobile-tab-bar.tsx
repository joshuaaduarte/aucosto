"use client";

// Bottom tab bar for phones: Today, Do, a centre "+" (quick capture: a
// chooser of everything you can add; press and hold to repeat the last
// kind), Calendar, and More, a half-sheet with the other
// tools and theme/sign-out. Partners get Home, Money, +, Me.
// Tool list and grouping come from nav-model.tsx (shared with the sidebar).
// Hidden on lg+ where the sidebar takes over. Its height is published as
// --mobile-tabbar-height (globals.css) so the running-timer bar and FABs
// stack above it.

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Fragment, useRef, useState, useSyncExternalStore } from "react";
import { ThemeToggle } from "@/components/theme-toggle";
import { SignOutButton } from "../sign-out-button";
import { NAV_GROUPS, NavIcon, navActive, SETTINGS_PATHS, toolByHref, visibleTools } from "./nav-model";
import { openLastQuickCapture, openQuickCapture } from "./quick-capture";
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

const TAB_HREFS = ["/app", "/app/do", "/app/calendar"] as const;

type TabTool = { href: string; label: string; icon: React.ReactNode };

function tabTool(href: string, label?: string): TabTool {
  const tool = toolByHref(href);
  return { href, label: label ?? tool.label, icon: <NavIcon paths={tool.paths} size={18} /> };
}

const TABS: TabTool[] = [tabTool("/app"), tabTool("/app/do", "Do"), tabTool("/app/calendar")];

/** Partner's "Me" tab: their settings (sign-in, theme, notifications). */
const ME_TOOL: TabTool = {
  href: "/app/settings",
  label: "Me",
  icon: (
    <svg {...ip}>
      <circle cx="7.5" cy="5.25" r="2.5" />
      <path d="M2.5 13c.8-2.4 2.7-3.5 5-3.5s4.2 1.1 5 3.5" />
    </svg>
  ),
};

const HOLD_MS = 450;

/**
 * Centre "+": a tap opens the quick-capture chooser over the current page;
 * press and hold jumps straight to the last kind of thing you added.
 */
function PlusTab() {
  const timer = useRef<number | null>(null);
  const held = useRef(false);
  const cancel = () => {
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = null;
  };
  return (
    <div className="flex min-w-0 flex-1 items-center justify-center">
      <button
        type="button"
        onPointerDown={() => {
          held.current = false;
          cancel();
          timer.current = window.setTimeout(() => {
            held.current = true;
            timer.current = null;
            navigator.vibrate?.(10);
            openLastQuickCapture();
          }, HOLD_MS);
        }}
        onPointerUp={cancel}
        onPointerLeave={cancel}
        onPointerCancel={cancel}
        onContextMenu={(event) => event.preventDefault()}
        onClick={() => {
          // The hold already opened the sheet; swallow the click that follows it.
          if (held.current) {
            held.current = false;
            return;
          }
          openQuickCapture();
        }}
        aria-label="Add something (press and hold to repeat the last kind)"
        className="tabbar-plus"
        style={{ WebkitTouchCallout: "none", userSelect: "none" }}
      >
        <svg width="20" height="20" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden>
          <path d="M7.5 3v9M3 7.5h9" />
        </svg>
      </button>
    </div>
  );
}

function TabLink({ tool, active }: { tool: { href: string; label: string; icon: React.ReactNode }; active: boolean }) {
  return (
    <Link
      href={tool.href}
      aria-current={active ? "page" : undefined}
      className="flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 py-1.5"
      style={{ color: active ? "var(--text)" : "var(--text-faint)" }}
    >
      {tool.icon}
      <span className="text-[0.625rem] font-medium">{tool.label}</span>
    </Link>
  );
}

const SETTINGS_TOOL: TabTool = {
  href: "/app/settings",
  label: "Settings",
  icon: <NavIcon paths={SETTINGS_PATHS} size={18} />,
};

// No store to subscribe to — the hour is only re-read on re-render, which is
// all the reflect dot needs.
const emptySubscribe = () => () => {};

/** Household partner: Home, Money, +, Me — no More sheet. */
function PartnerTabBar({ showFinance }: { showFinance: boolean }) {
  const pathname = usePathname();
  const home = tabTool("/app/home");
  const money = tabTool("/app/finance");
  const isActive = (href: string) => navActive(href, pathname);
  return (
    <nav className="mobile-tabbar lg:hidden" aria-label="Primary">
      <TabLink tool={home} active={isActive(home.href)} />
      {showFinance ? <TabLink tool={money} active={isActive(money.href)} /> : null}
      <PlusTab />
      <TabLink tool={ME_TOOL} active={isActive(ME_TOOL.href)} />
    </nav>
  );
}

export function MobileTabBar({
  showFinance,
  needsReflect = false,
  isPartner = false,
}: {
  showFinance: boolean;
  /** Today has no saved reflection yet — show a subtle dot on More. */
  needsReflect?: boolean;
  isPartner?: boolean;
}) {
  if (isPartner) return <PartnerTabBar showFinance={showFinance} />;
  return <OwnerTabBar showFinance={showFinance} needsReflect={needsReflect} />;
}

function OwnerTabBar({
  showFinance,
  needsReflect,
}: {
  showFinance: boolean;
  needsReflect: boolean;
}) {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  useBodyScrollLock(moreOpen);

  // The reflection nudge only makes sense in the evening — before 6pm there's
  // nothing to act on yet, so a dot all day reads as false urgency. The hour
  // check must run client-side: the server is TZ-pinned to LA, but we want the
  // viewer's actual local hour. The server snapshot is false so SSR (and
  // the morning) never paints the dot.
  const isEvening = useSyncExternalStore(
    emptySubscribe,
    () => new Date().getHours() >= 18,
    () => false,
  );
  const showReflectDot = needsReflect && isEvening;

  const moreTools = visibleTools({ showFinance, isPartner: false }).filter(
    (tool) => !(TAB_HREFS as readonly string[]).includes(tool.href),
  );
  const moreGroups = NAV_GROUPS.map((group) => ({
    ...group,
    tools: moreTools.filter((tool) => tool.group === group.id),
  })).filter((group) => group.tools.length > 0);
  const moreActive = [...moreTools, SETTINGS_TOOL].some((tool) => navActive(tool.href, pathname));

  return (
    <>
      <nav className="mobile-tabbar lg:hidden" aria-label="Primary">
        {TABS.map((tab, index) => {
          const active = navActive(tab.href, pathname);
          return (
            <Fragment key={tab.href}>
              {index === 2 ? <PlusTab /> : null}
              <TabLink tool={tab} active={active} />
            </Fragment>
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
            <div className="space-y-4">
              {moreGroups.map((group) => (
                <section key={group.id}>
                  <p
                    className="text-[0.6875rem] font-semibold uppercase tracking-wider"
                    style={{ color: "var(--text-faint)" }}
                  >
                    {group.label}
                  </p>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    {group.tools.map((tool) => (
                      <MoreLink
                        key={tool.href}
                        href={tool.href}
                        label={tool.label}
                        icon={<NavIcon paths={tool.paths} size={18} />}
                        active={navActive(tool.href, pathname)}
                        onNavigate={() => setMoreOpen(false)}
                      />
                    ))}
                  </div>
                </section>
              ))}
            </div>

            <div
              className="mt-4 flex items-center justify-between border-t pt-3"
              style={{ borderColor: "var(--border-faint)" }}
            >
              <Link
                href={SETTINGS_TOOL.href}
                onClick={() => setMoreOpen(false)}
                className="btn-ghost inline-flex items-center gap-1.5"
              >
                {SETTINGS_TOOL.icon}
                Settings
              </Link>
              <div className="flex items-center gap-1">
                <ThemeToggle />
                <SignOutButton />
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

function MoreLink({
  href,
  label,
  icon,
  active,
  onNavigate,
}: {
  href: string;
  label: string;
  icon: React.ReactNode;
  active: boolean;
  onNavigate: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className="flex items-center gap-2.5 rounded-md border px-3 py-3 text-[0.875rem] font-medium"
      style={{
        borderColor: active ? "var(--border)" : "var(--border-faint)",
        background: active ? "var(--bg-tint)" : "var(--bg-page)",
        color: "var(--text)",
      }}
    >
      <span style={{ color: "var(--text-muted)" }}>{icon}</span>
      {label}
    </Link>
  );
}
