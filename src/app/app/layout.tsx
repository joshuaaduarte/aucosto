import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getViewerContext } from "@/lib/viewer-context";
import { ThemeToggle } from "@/components/theme-toggle";
import { AppNav } from "./app-nav";
import { LockNowButton } from "./lock-now-button";
import { SignOutButton } from "./sign-out-button";
import { UnlockScreen } from "./unlock-screen";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const context = await getViewerContext();

  return (
    <div className="relative flex min-h-full flex-1 flex-col">
      {/* ── Header ─────────────────────────────────────────────── */}
      <header
        className="sticky top-0 z-20"
        style={{
          background: "var(--paper)",
          borderBottom: "1px solid var(--rule-faint)",
        }}
      >
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center gap-6 px-5 sm:px-10">
          {/* Wordmark */}
          <Link
            href="/app"
            className="shrink-0 text-[1rem] font-semibold tracking-[-0.04em] text-ink transition-opacity hover:opacity-70"
          >
            aucosto
          </Link>

          {/* Demo badge */}
          {context?.isDemoMode && (
            <span
              className="hidden shrink-0 rounded px-2 py-0.5 font-mono text-[0.625rem] uppercase tracking-[0.14em] sm:inline"
              style={{
                background: "var(--oxblood-soft)",
                color: "var(--oxblood)",
              }}
            >
              Demo
            </span>
          )}

          {/* Nav — takes remaining space */}
          <div className="flex-1">
            <AppNav showFinance={context?.financeVisible ?? false} />
          </div>

          {/* Right: theme toggle + lock + sign out */}
          <div className="flex shrink-0 items-center gap-1 sm:gap-3">
            <ThemeToggle />
            <div
              className="hidden h-4 w-px sm:block"
              style={{ background: "var(--rule-soft)" }}
            />
            {context?.appLockEnabled && (
              <span className="hidden sm:inline">
                <LockNowButton />
              </span>
            )}
            <SignOutButton />
          </div>
        </div>
      </header>

      {/* ── Content ────────────────────────────────────────────── */}
      <main className="mx-auto w-full max-w-5xl flex-1 px-5 py-8 pb-safe sm:px-10 sm:py-10">
        {context?.appLockEnabled && !context.isUnlocked ? (
          <UnlockScreen />
        ) : (
          children
        )}
      </main>

      {/* ── Footer ─────────────────────────────────────────────── */}
      <footer
        className="mt-auto"
        style={{ borderTop: "1px solid var(--rule-faint)" }}
      >
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-5 py-4 sm:px-10">
          <p className="font-mono text-[0.6875rem] uppercase tracking-[0.12em] text-ink-ghost">
            aucosto
          </p>
          <div className="flex items-center gap-4">
            {context?.appLockEnabled && (
              <span className="sm:hidden">
                <LockNowButton />
              </span>
            )}
            <span className="sm:hidden">
              <SignOutButton />
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
