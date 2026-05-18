import Link from "next/link";
import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <div
      className="flex min-h-screen flex-col"
      style={{ backgroundColor: "var(--paper)", color: "var(--ink)" }}
    >
      {/* Top bar */}
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-6 sm:px-10 sm:py-8">
        <Link
          href="/"
          className="flex items-center gap-1.5 text-sm font-medium text-ink-fade transition-colors hover:text-ink"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
            <path d="M11 7H3M6.5 3.5 3 7l3.5 3.5" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          aucosto
        </Link>
      </header>

      {/* Sign-in card */}
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col items-center justify-center px-6 pb-20 pt-8 sm:px-10">
        <div className="fade-in w-full max-w-sm">
          {/* Wordmark */}
          <div className="mb-8 text-center">
            <span
              className="text-[1.8rem] font-semibold tracking-[-0.04em] text-ink"
              style={{ fontFamily: "var(--font-dm-sans), sans-serif" }}
            >
              aucosto
            </span>
          </div>

          {/* Card */}
          <div
            className="rounded-xl px-7 py-8"
            style={{
              background: "var(--surface)",
              boxShadow: "var(--surface-shadow)",
            }}
          >
            <div className="mb-7">
              <h1 className="text-[1.4rem] font-semibold tracking-[-0.02em] text-ink">
                Welcome back
              </h1>
              <p className="mt-1 text-sm text-ink-fade">
                Sign in to your dashboard.
              </p>
            </div>

            <LoginForm />
          </div>

          <p className="mt-6 text-center font-mono text-[0.6875rem] uppercase tracking-[0.14em] text-ink-ghost">
            Private · No tracking · One user
          </p>
        </div>
      </main>
    </div>
  );
}
