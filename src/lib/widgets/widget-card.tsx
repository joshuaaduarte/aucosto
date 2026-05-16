import Link from "next/link";

export function WidgetCard({
  name,
  href,
  children,
}: {
  name: string;
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="group block rounded-[1.75rem] border border-zinc-200/80 bg-white/90 p-6 shadow-[0_20px_60px_-40px_rgba(24,24,27,0.35)] transition-all hover:-translate-y-0.5 hover:border-zinc-300 hover:shadow-[0_24px_70px_-40px_rgba(24,24,27,0.42)] dark:border-zinc-800/80 dark:bg-zinc-900/90 dark:shadow-none dark:hover:border-zinc-700"
    >
      <div className="mb-5 flex items-center justify-between gap-4">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-zinc-500">
            {name}
          </p>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Open detail view
          </p>
        </div>
        <span
          aria-hidden
          className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-zinc-200 bg-zinc-50 text-zinc-400 transition-transform group-hover:translate-x-0.5 group-hover:text-zinc-700 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-500 dark:group-hover:text-zinc-200"
        >
          &rarr;
        </span>
      </div>
      {children}
    </Link>
  );
}
