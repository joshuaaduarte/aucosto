import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getViewerContext } from "@/lib/viewer-context";
import { AppSidebar, MobileNav } from "./sidebar";
import { MobileTabBar } from "./_components/mobile-tab-bar";
import { RunningTimerBar } from "./_components/running-timer-bar";

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

  const navProps = {
    showFinance: context?.financeVisible ?? false,
    isDemoMode: context?.isDemoMode ?? false,
  };

  return (
    <div className="flex min-h-screen flex-1" style={{ background: "var(--bg-app)" }}>
      <AppSidebar {...navProps} />

      <div
        className="flex flex-1 flex-col min-w-0"
        style={{ background: "var(--bg-page)" }}
      >
        <MobileNav {...navProps} />

        <main
          className="flex-1 w-full max-w-[940px] mx-auto px-6 py-10 sm:px-12 sm:py-14 lg:px-20 lg:py-14"
          style={{
            paddingBottom:
              "calc(3.5rem + var(--mobile-tabbar-height) + var(--timer-bar-height) + var(--safe-area-bottom))",
          }}
        >
          {children}
        </main>
      </div>

      {/* Mobile bottom tabs + global running-timer bar — not on the lock screen. */}
      {context && context.isUnlocked ? (
        <>
          <MobileTabBar />
          <RunningTimerBar userId={context.effectiveUserId} />
        </>
      ) : null}
    </div>
  );
}
