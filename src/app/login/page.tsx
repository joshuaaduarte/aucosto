import Link from "next/link";
import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <div
      className="flex min-h-screen flex-col"
      style={{ backgroundColor: "var(--bg-app)", color: "var(--text)" }}
    >
      <header
        className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-5 sm:px-10 sm:py-6"
        style={{ paddingTop: "calc(1.25rem + var(--safe-area-top))" }}
      >
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 rounded px-2 py-1 text-[0.8125rem] font-medium transition-colors hover:bg-bg-hover"
          style={{ color: "var(--text-muted)" }}
        >
          <svg
            width="13"
            height="13"
            viewBox="0 0 13 13"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.25"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="M10.5 6.5h-8M6 3 2.5 6.5 6 10" />
          </svg>
          aucosto
        </Link>
      </header>

      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col items-center justify-center px-6 pb-20 pt-8 sm:px-10">
        <div className="fade-in w-full max-w-[360px]">
          <div className="mb-8 text-center">
            <p
              className="text-[1.25rem] font-semibold tracking-tight"
              style={{ color: "var(--text)" }}
            >
              aucosto
            </p>
            <p
              className="mt-2 text-[0.875rem]"
              style={{ color: "var(--text-muted)" }}
            >
              Personal workspace
            </p>
          </div>

          <div className="space-y-1">
            <h1
              className="text-[1.125rem] font-semibold tracking-tight"
              style={{ color: "var(--text)" }}
            >
              Welcome back
            </h1>
            <p
              className="text-[0.8125rem]"
              style={{ color: "var(--text-muted)" }}
            >
              Sign in to open your workspace.
            </p>
          </div>

          <div className="mt-6">
            <LoginForm />
          </div>

          <p
            className="mt-8 text-center text-[0.6875rem]"
            style={{ color: "var(--text-faint)" }}
          >
            Private · No tracking · One user
          </p>
        </div>
      </main>
    </div>
  );
}
