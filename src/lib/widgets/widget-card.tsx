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
      className="group block rounded-lg border border-zinc-200 bg-white p-6 transition-colors hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700"
    >
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-mono text-xs uppercase tracking-[0.2em] text-zinc-500">
          {name}
        </h3>
        <span
          aria-hidden
          className="text-zinc-400 transition-transform group-hover:translate-x-0.5"
        >
          &rarr;
        </span>
      </div>
      {children}
    </Link>
  );
}
