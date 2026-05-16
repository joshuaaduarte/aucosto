import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AppNav } from "./app-nav";
import { SignOutButton } from "./sign-out-button";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const displayName = session.user.name ?? session.user.email ?? "you";

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
            <AppNav />
          </div>

          <div className="flex items-center justify-between gap-4 lg:justify-end">
            <div className="text-right">
              <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                {displayName}
              </p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Personal workspace
              </p>
            </div>
            <SignOutButton />
          </div>
        </div>
      </header>
      <div className="mx-auto w-full max-w-6xl flex-1 px-6 py-8 sm:py-10">
        {children}
      </div>
    </div>
  );
}
