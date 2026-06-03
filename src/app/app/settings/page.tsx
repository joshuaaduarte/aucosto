import { getViewerContext } from "@/lib/viewer-context";
import { PrivacyPanel } from "../privacy-panel";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const context = await getViewerContext();

  return (
    <div className="space-y-10">
      <header className="fade-in flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p
            className="text-[0.75rem] font-medium uppercase tracking-wider"
            style={{ color: "var(--text-faint)" }}
          >
            Settings
          </p>
          <h1
            className="mt-1 text-[1.5rem] font-bold tracking-tight sm:text-[1.875rem]"
            style={{ color: "var(--text)", letterSpacing: "-0.025em" }}
          >
            Settings
          </h1>
        </div>
        <p
          className="text-[0.8125rem] sm:max-w-[38rem] sm:text-right"
          style={{ color: "var(--text-muted)" }}
        >
          Privacy, app lock, and demo workspace controls live here now.
        </p>
      </header>

      <section
        id="finance"
        className="rounded-md border p-5"
        style={{
          borderColor: "var(--border-soft)",
          background: "var(--bg-page)",
        }}
      >
        <p
          className="text-[0.6875rem] font-semibold uppercase tracking-wider"
          style={{ color: "var(--text-faint)" }}
        >
          Controls
        </p>
        <h2
          className="mt-1 text-[1rem] font-semibold tracking-tight"
          style={{ color: "var(--text)" }}
        >
          Manage what shows up in your workspace.
        </h2>
        <div className="mt-4">
          <PrivacyPanel
            financeVisible={context?.financeVisible ?? false}
            appLockEnabled={context?.appLockEnabled ?? false}
            isDemoMode={context?.isDemoMode ?? false}
          />
        </div>
      </section>
    </div>
  );
}
