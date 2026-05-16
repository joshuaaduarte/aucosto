import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getViewerContext } from "@/lib/viewer-context";
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
  const displayName = context?.displayName ?? session.user.name ?? session.user.email ?? "you";

  return (
    <div className="relative flex min-h-full flex-1 flex-col">
      <div className="absolute inset-x-0 top-0 -z-10 h-72 bg-[radial-gradient(circle_at_top_left,_rgba(14,165,233,0.12),_transparent_35%),radial-gradient(circle_at_top_right,_rgba(168,85,247,0.09),_transparent_26%)]" />
      <header className="sticky top-0 z-30 border-b border-zinc-200/80 bg-zinc-50/90 backdrop-blur supports-[backdrop-filter]:bg-zinc-50/80 dark:border-zinc-800/80 dark:bg-zinc-950/90 dark:supports-[backdrop-filter]:bg-zinc-950/80">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-6 py-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:gap-6">
            <div>
              <Link
                href="/app"
                className="font-mono text-xs uppercase tracking-[0.24em] text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
              >
                aucosto
              </Link>
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                Daily steering for time, money, and recovery.
              </p>
            </div>
            <AppNav showFinance={context?.financeVisible ?? false} />
          </div>

          <div className="flex items-center justify-between gap-3 lg:justify-end">
            {context?.isDemoMode ? (
              <span className="inline-flex rounded-full bg-sky-50 px-3 py-1 text-xs font-medium text-sky-700 dark:bg-sky-500/10 dark:text-sky-300">
                Demo mode
              </span>
            ) : null}
            <div className="text-right">
              <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                {displayName}
              </p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                {context?.isDemoMode ? "Showing demo workspace" : "Personal workspace"}
              </p>
            </div>
            {context?.appLockEnabled ? <LockNowButton /> : null}
            <SignOutButton />
          </div>
        </div>
      </header>
      <div className="mx-auto w-full max-w-6xl flex-1 px-6 py-8 sm:py-10">
        {context?.appLockEnabled && !context.isUnlocked ? <UnlockScreen /> : children}
      </div>
    </div>
  );
}
