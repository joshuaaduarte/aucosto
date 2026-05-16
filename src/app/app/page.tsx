import Link from "next/link";
import { auth } from "@/auth";
import { getViewerContext } from "@/lib/viewer-context";
import { ActivityWidget } from "@/lib/widgets/activity";
import { FinanceWidget } from "@/lib/widgets/finance";
import { TimeTrackerWidget } from "@/lib/widgets/time-tracker";
import { PrivacyPanel } from "./privacy-panel";

const prompts = [
  "Protect one block of deep work before the day fragments.",
  "Check spend drift before it becomes stress later in the month.",
  "Use the hub to notice pressure early, not after the fact.",
];

export default async function HubPage() {
  const session = await auth();
  const context = await getViewerContext();
  const firstName = session?.user?.name?.split(" ")[0];

  return (
    <div className="space-y-6 lg:space-y-8">
      <section className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="rounded-[2rem] border border-zinc-200/80 bg-gradient-to-br from-white via-zinc-50 to-sky-50/70 p-6 shadow-[0_24px_80px_-45px_rgba(24,24,27,0.28)] dark:border-zinc-800/80 dark:from-zinc-950 dark:via-zinc-950 dark:to-sky-950/20 dark:shadow-none sm:p-7">
          <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-zinc-500">
            Daily overview
          </p>
          <h1 className="mt-3 max-w-3xl text-3xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50 sm:text-4xl">
            {firstName ? `Hey, ${firstName}.` : "Welcome back."} Steer the day from one calm place.
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-zinc-600 dark:text-zinc-300 sm:text-base">
            Start with the highest-signal view, then drop into time or finance only when the numbers tell you to.
          </p>

          <div className="mt-6 flex flex-wrap gap-2.5">
            <Link
              href="/app/time"
              className="inline-flex min-h-11 items-center justify-center rounded-full bg-zinc-950 px-5 text-sm font-medium text-white transition-colors hover:bg-zinc-800 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200"
            >
              Open time tracker
            </Link>
            {context?.financeVisible ? (
              <Link
                href="/app/finance#transactions"
                className="inline-flex min-h-11 items-center justify-center rounded-full border border-zinc-200 bg-white/80 px-5 text-sm font-medium text-zinc-700 transition-colors hover:border-zinc-300 hover:text-zinc-900 dark:border-zinc-800 dark:bg-zinc-900/80 dark:text-zinc-300 dark:hover:border-zinc-700 dark:hover:text-zinc-100"
              >
                Review money flow
              </Link>
            ) : null}
          </div>
        </div>

        <aside className="rounded-[2rem] border border-zinc-200/80 bg-white/90 p-6 shadow-[0_24px_80px_-50px_rgba(24,24,27,0.24)] dark:border-zinc-800/80 dark:bg-zinc-900/90 dark:shadow-none sm:p-7">
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-zinc-500">
            Right now
          </p>
          <ul className="mt-4 space-y-3">
            {prompts.map((prompt) => (
              <li key={prompt} className="flex gap-3 rounded-2xl border border-zinc-200/80 bg-zinc-50/80 px-4 py-3 text-sm text-zinc-600 dark:border-zinc-800 dark:bg-zinc-950/60 dark:text-zinc-300">
                <span className="mt-1 h-2 w-2 rounded-full bg-sky-500" />
                <span>{prompt}</span>
              </li>
            ))}
          </ul>
        </aside>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <div className={`grid gap-4 ${context?.financeVisible ? "md:grid-cols-2" : "md:grid-cols-1"}`}>
          <TimeTrackerWidget />
          {context?.financeVisible ? <FinanceWidget /> : null}
        </div>
        <div>
          <ActivityWidget />
        </div>
      </section>

      <PrivacyPanel
        financeVisible={context?.financeVisible ?? false}
        appLockEnabled={context?.appLockEnabled ?? false}
        isDemoMode={context?.isDemoMode ?? false}
      />
    </div>
  );
}
