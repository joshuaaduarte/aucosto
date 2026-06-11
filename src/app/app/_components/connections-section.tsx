import Link from "next/link";
import { toneAccent, type ConnectionItem } from "./hub-types";
import { ArrowRight } from "./icons";

export function ConnectionsSection({ connections }: { connections: ConnectionItem[] }) {
  if (connections.length === 0) return null;

  return (
    <section className="fade-in-delay-3">
      <div className="mb-3 flex items-center justify-between gap-3 px-1">
        <p
          className="text-[0.6875rem] font-semibold uppercase tracking-wider"
          style={{ color: "var(--text-faint)" }}
        >
          Cross-tool connections
        </p>
        <p
          className="text-[0.75rem]"
          style={{ color: "var(--text-faint)" }}
        >
          This is where the tools should feel like one system.
        </p>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {connections.map((item) => (
          <ConnectionCard key={`${item.title}-${item.href}`} item={item} />
        ))}
      </div>
    </section>
  );
}

function ConnectionCard({ item }: { item: ConnectionItem }) {
  return (
    <Link
      href={item.href}
      className="rounded-lg border px-4 py-4 transition-colors hover:bg-bg-hover"
      style={{ borderColor: "var(--border-faint)", background: "var(--bg-page)" }}
    >
      <div className="flex items-start gap-3">
        <span
          className="mt-1 inline-block h-2 w-2 shrink-0 rounded-full"
          style={{ background: toneAccent[item.tone] ?? "var(--text)" }}
        />
        <div className="min-w-0">
          <p
            className="text-[0.92rem] font-semibold tracking-tight"
            style={{ color: "var(--text)" }}
          >
            {item.title}
          </p>
          <p
            className="mt-1 text-[0.84rem] leading-[1.5]"
            style={{ color: "var(--text-muted)" }}
          >
            {item.body}
          </p>
          <p
            className="mt-2 inline-flex items-center gap-1 text-[0.78rem] font-medium"
            style={{ color: "var(--text-faint)" }}
          >
            {item.ctaLabel}
            <ArrowRight />
          </p>
        </div>
      </div>
    </Link>
  );
}
