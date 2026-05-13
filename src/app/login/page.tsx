import Link from "next/link";
import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6 py-24">
      <div className="w-full max-w-sm space-y-8">
        <div className="space-y-1 text-center">
          <Link
            href="/"
            className="font-mono text-xs uppercase tracking-[0.2em] text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
          >
            aucosto
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight">
            Welcome back.
          </h1>
        </div>
        <LoginForm />
      </div>
    </main>
  );
}
