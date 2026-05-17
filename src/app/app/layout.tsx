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
    <div className="relative flex min-h-full flex-1 flex-col overflow-hidden">
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-80 bg-[radial-gradient(circle_at_top_left,_rgba(56,189,248,0.12),_transparent_34%),radial-gradient(circle_at_top_right,_rgba(168,85,247,0.08),_transparent_24%)]" />
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-full bg-[linear-gradient(rgba(24,24,27,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(24,24,27,0.03)_1px,transparent_1px)] bg-[size:28px_28px] opacity-40" />
      <header className="sticky top-0 z-30 px-4 pt-4 sm:px-6 sm:pt-5">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 rounded-[1.75rem] border border-zinc-200/80 bg-white/88 px-4 py-4 shadow-[0_20px_60px_-42px_rgba(24,24,27,0.18)] backdrop-blur sm:px-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:gap-6">
            <div>
              <Link
                href="/app"
                className="font-mono text-xs uppercase tracking-[0.24em] text-zinc-500 hover:text-zinc-900"
              >
                aucosto
              </Link>
              <p className="mt-1 text-sm text-zinc-500">
                Daily steering for time, money, and recovery.
              </p>
            </div>
            <AppNav showFinance={context?.financeVisible ?? false} />
          </div>

          <div className="flex w-full flex-col gap-2 lg:w-auto lg:items-end">
            <div className="flex flex-wrap items-center gap-2 sm:gap-3 lg:justify-end">
              {context?.isDemoMode ? (
                <span className="inline-flex rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-medium text-sky-700">
                  Demo mode
                </span>
              ) : null}
              <div className="min-w-0 flex-1 text-left sm:text-right lg:flex-none">
                <p className="truncate text-sm font-medium text-zinc-900">
                  {displayName}
                </p>
                <p className="text-xs text-zinc-500">
                  {context?.isDemoMode ? "Showing demo workspace" : "Personal workspace"}
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:justify-end sm:gap-3">
              {context?.appLockEnabled ? <LockNowButton /> : null}
              <SignOutButton />
            </div>
          </div>
        </div>
      </header>
      <div className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 pb-safe sm:px-6 sm:py-8 lg:py-10">
        {context?.appLockEnabled && !context.isUnlocked ? <UnlockScreen /> : children}
      </div>
    </div>
  );
}
