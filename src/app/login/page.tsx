import Link from "next/link";
import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <main className="relative flex flex-1 flex-col">
      <header className="mx-auto w-full max-w-[1280px] px-5 pt-6 sm:px-10 sm:pt-10">
        <div className="flex items-center justify-between gap-4 font-mono text-[0.6875rem] uppercase tracking-[0.22em] text-ink-fade">
          <Link href="/" className="text-ink hover:text-oxblood transition-colors">
            ← Aucosto
          </Link>
          <span className="hidden sm:inline">Subscriber entrance</span>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-[1280px] flex-1 flex-col items-center justify-center px-5 py-16 sm:px-10 sm:py-24">
        <div className="grid w-full max-w-5xl gap-14 lg:grid-cols-[1fr_1fr] lg:items-center">
          {/* Left column — editorial welcome */}
          <div className="lg:rule-r lg:border-rule lg:pr-14">
            <p className="font-mono text-[0.6875rem] uppercase tracking-[0.28em] text-ink-fade">
              The Subscribers’ Entrance
            </p>
            <h1 className="mt-6 font-display font-medium leading-[0.9] tracking-[-0.045em] text-ink text-[3rem] sm:text-[4rem]">
              Welcome back,
              <br />
              <span className="italic text-oxblood">dear reader.</span>
            </h1>
            <p className="mt-7 max-w-md font-serif text-[1.05rem] italic leading-[1.75] text-ink-soft">
              Today’s edition is set and waiting. The figures are reconciled,
              the columns are quiet, and the briefing is on the editor’s desk.
            </p>
            <p className="mt-7 font-serif text-sm italic text-ink-fade">
              ❦ Aucosto is printed in one copy, for one reader. ❦
            </p>
          </div>

          {/* Right column — the sign-in card, as a subscription slip */}
          <div className="rule-t rule-b border-ink py-10">
            <p className="font-mono text-[0.6875rem] uppercase tracking-[0.28em] text-oxblood">
              Identify yourself
            </p>
            <h2 className="mt-2 font-display text-2xl font-medium italic tracking-[-0.02em] text-ink">
              The subscription slip.
            </h2>

            <div className="mt-8">
              <LoginForm />
            </div>

            <p className="mt-8 font-serif text-xs italic text-ink-fade leading-relaxed">
              Set in Fraunces and Newsreader. No third-party sign-in, no
              tracking cookies, no analytics — just a quiet, single-reader
              publication.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
