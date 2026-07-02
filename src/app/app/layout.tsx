import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { dayKey } from "@/lib/reflect";
import { getReflection } from "@/lib/services/reflect";
import { getViewerContext } from "@/lib/viewer-context";
import { AppSidebar, MobileNav } from "./sidebar";
import { MobileTabBar } from "./_components/mobile-tab-bar";
import { RunningTimerBar } from "./_components/running-timer-bar";
import { KeyboardInsetProbe } from "./_components/keyboard-inset-probe";

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

  // Subtle badge on the More tab while today has no saved reflection.
  // Belt-and-braces try/catch: a cosmetic badge read must never be able to
  // take down every page in the app.
  let todayReflection = null;
  if (context && context.isUnlocked) {
    try {
      todayReflection = await getReflection(
        context.effectiveUserId,
        dayKey(new Date()),
      );
    } catch (error) {
      console.error("[layout] reflection badge read failed", error);
    }
  }

  return (
    <div className="flex min-h-screen flex-1" style={{ background: "var(--bg-app)" }}>
      <KeyboardInsetProbe />
      <AppSidebar {...navProps} />

      <div
        className="flex flex-1 flex-col min-w-0"
        style={{ background: "var(--bg-page)" }}
      >
        <MobileNav {...navProps} />

        <main
          className="flex-1 w-full max-w-[940px] mx-auto px-6 py-10 sm:px-12 sm:py-14 lg:px-20 lg:py-14"
          style={{
            paddingBottom: "calc(var(--bottom-inset) + 3.5rem)",
          }}
        >
          {children}
        </main>
      </div>

      {/* Mobile bottom tabs + global running-timer bar — not on the lock screen. */}
      {context && context.isUnlocked ? (
        <>
          <MobileTabBar
            showFinance={navProps.showFinance}
            needsReflect={!todayReflection}
          />
          <RunningTimerBar userId={context.effectiveUserId} />
        </>
      ) : null}
    </div>
  );
}
