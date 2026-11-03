import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { isPartnerPathAllowed, PARTNER_HOME_PATH } from "@/lib/household-access";
import { auth } from "@/auth";
import { dayKey } from "@/lib/reflect";
import { getReflection } from "@/lib/services/reflect";
import { getViewerContext } from "@/lib/viewer-context";
import { AppSidebar, MobileNav } from "./sidebar";
import { SignOutButton } from "./sign-out-button";
import { CommandPalette } from "./_components/command-palette";
import { MobileTabBar } from "./_components/mobile-tab-bar";
import { RunningTimerBar } from "./_components/running-timer-bar";
import { KeyboardInsetProbe } from "./_components/keyboard-inset-probe";
import { QuickCaptureHost } from "./_components/quick-capture";

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
  const isPartner = context?.role === "partner";

  if (context?.accessRemoved) {
    return <AccessRemoved />;
  }

  // Household partners only get Home, Finance and Settings. Enforced here on
  // the server (the proxy stamps x-pathname); their personal-tool scope is
  // their own empty userId anyway, so nothing private could leak regardless.
  if (isPartner) {
    const pathname = (await headers()).get("x-pathname") ?? "";
    if (!isPartnerPathAllowed(pathname)) {
      redirect(PARTNER_HOME_PATH);
    }
  }

  const navProps = {
    showFinance: context?.financeVisible ?? false,
    isDemoMode: context?.isDemoMode ?? false,
    isPartner,
    workspaceLabel: isPartner
      ? (context?.householdName ?? "Household")
      : `${context?.displayName?.split(" ")[0] ?? "Your"}'s workspace`,
  };

  // Subtle badge on the More tab while today has no saved reflection.
  // Belt-and-braces try/catch: a cosmetic badge read must never be able to
  // take down every page in the app.
  let todayReflection = null;
  if (context && !isPartner) {
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

      {/* Mobile bottom tabs + global running-timer bar. */}
      {context ? (
        <>
          <MobileTabBar
            showFinance={navProps.showFinance}
            needsReflect={!isPartner && !todayReflection}
            isPartner={isPartner}
          />
          {isPartner ? null : <RunningTimerBar userId={context.effectiveUserId} />}
        </>
      ) : null}

      {context ? (
        <QuickCaptureHost financeVisible={navProps.showFinance} isPartner={isPartner} />
      ) : null}
      {isPartner ? null : <CommandPalette />}
    </div>
  );
}

function AccessRemoved() {
  return (
    <div
      className="flex min-h-screen flex-1 items-center justify-center px-6"
      style={{ background: "var(--bg-page)" }}
    >
      <div className="max-w-sm space-y-4 text-center">
        <p className="text-[1.125rem] font-semibold" style={{ color: "var(--text)" }}>
          Your household access was removed
        </p>
        <p className="text-[0.875rem]" style={{ color: "var(--text-muted)" }}>
          Ask the household owner to send you a new invite if this was a mistake.
        </p>
        <div className="flex justify-center">
          <SignOutButton />
        </div>
      </div>
    </div>
  );
}
