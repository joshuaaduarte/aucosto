import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getViewerContext } from "@/lib/viewer-context";
import { AppNav } from "./app-nav";
import { LockNowButton } from "./lock-now-button";
import { SignOutButton } from "./sign-out-button";
import { UnlockScreen } from "./unlock-screen";

const EPOCH = Date.UTC(2025, 0, 1);

function dateline(d: Date) {
  const issue = Math.max(
    1,
    Math.floor((d.getTime() - EPOCH) / (24 * 60 * 60 * 1000)) + 1,
  );
  const roman = toRoman(issue);
  const human = d.toLocaleDateString([], {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  return { issue, roman, human };
}

function toRoman(num: number): string {
  const pairs: [number, string][] = [
    [1000, "M"], [900, "CM"], [500, "D"], [400, "CD"],
    [100, "C"], [90, "XC"], [50, "L"], [40, "XL"],
    [10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"],
  ];
  let n = num;
  let out = "";
  for (const [v, s] of pairs) {
    while (n >= v) {
      out += s;
      n -= v;
    }
  }
  return out;
}

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
  const displayName =
    context?.displayName ?? session.user.name ?? session.user.email ?? "you";

  const { issue, roman, human } = dateline(new Date());

  return (
    <div className="relative flex min-h-full flex-1 flex-col">
      <header className="relative">
        <div className="mx-auto w-full max-w-[1280px] px-5 pt-5 sm:px-10 sm:pt-8">
          {/* top metadata strip — issue / weather / reader */}
          <div className="flex items-center justify-between gap-4 pb-3 font-mono text-[0.6875rem] uppercase tracking-[0.22em] text-ink-fade">
            <span className="hidden sm:inline">
              Vol. I · No.&nbsp;<span className="tabular text-ink">{roman}</span>
            </span>
            <span className="sm:hidden">
              No.&nbsp;<span className="tabular text-ink">{issue}</span>
            </span>
            <span className="text-center text-ink-fade">
              {context?.isDemoMode ? (
                <span className="text-oxblood">
                  ❦ Demonstration Edition ❦
                </span>
              ) : (
                <>An edition of one</>
              )}
            </span>
            <span className="hidden text-right sm:inline">
              For{" "}
              <span className="not-italic text-ink">{displayName}</span>
            </span>
            <span className="text-right sm:hidden">
              <span className="not-italic text-ink truncate max-w-[8rem] inline-block align-bottom">{displayName}</span>
            </span>
          </div>

          {/* masthead */}
          <div className="double-rule-t double-rule-b border-ink py-4 sm:py-6">
            <div className="flex flex-col items-center text-center">
              <Link
                href="/app"
                className="font-display font-medium italic leading-[0.85] tracking-[-0.05em] text-ink text-[3.4rem] sm:text-[6rem] lg:text-[8rem]"
                style={{ fontVariationSettings: '"SOFT" 100, "WONK" 1, "opsz" 144' }}
              >
                aucosto
              </Link>
              <p className="mt-2 font-serif text-sm italic text-ink-fade sm:text-base">
                A daily edition, set in print for a single reader.
              </p>
            </div>
          </div>

          {/* dateline + section nav */}
          <div className="flex flex-col gap-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4 font-mono text-[0.6875rem] uppercase tracking-[0.22em] text-ink-fade">
              <span aria-hidden className="hidden h-px w-8 bg-rule sm:block" />
              <span className="tabular text-ink">{human}</span>
            </div>
            <AppNav showFinance={context?.financeVisible ?? false} />
          </div>

          <div className="rule-b border-ink" />
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1280px] flex-1 px-5 py-8 pb-safe sm:px-10 sm:py-12">
        {context?.appLockEnabled && !context.isUnlocked ? (
          <UnlockScreen />
        ) : (
          children
        )}
      </main>

      <footer className="border-rule mt-auto">
        <div className="mx-auto w-full max-w-[1280px] px-5 sm:px-10">
          <div className="rule-t border-ink/50 flex flex-col gap-3 py-5 sm:flex-row sm:items-center sm:justify-between">
            <p className="font-mono text-[0.6875rem] uppercase tracking-[0.22em] text-ink-fade">
              Aucosto · The Daily Edition · Printed in one copy
            </p>
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              {context?.appLockEnabled ? <LockNowButton /> : null}
              <SignOutButton />
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
