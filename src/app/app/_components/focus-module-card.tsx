import Link from "next/link";
import { SparkIcon } from "./icons";
import type { FocusModule, TopAction } from "./hub-types";

// The hero of the hub: the single recommendation for right now. Accent
// frame + larger type make it read as the page's headline; everything
// below is supporting context.

export function FocusModuleCard({ focus }: { focus: FocusModule }) {
  return (
    <section
      className="fade-in rounded-xl px-5 py-6 sm:px-7 sm:py-7"
      style={{
        background:
          "linear-gradient(180deg, var(--accent-tint) 0%, var(--bg-page) 55%)",
        border: "1px solid var(--accent-tint-strong)",
        borderTop: "3px solid var(--accent)",
      }}
    >
      <div className="flex items-start gap-3 sm:gap-4">
        <span
          className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full sm:h-10 sm:w-10"
          style={{
            background: "var(--accent-tint)",
            color: "var(--accent-strong)",
            border: "1px solid var(--accent-tint-strong)",
          }}
        >
          <SparkIcon />
        </span>
        <div className="min-w-0 flex-1">
          <p
            className="text-[0.6875rem] font-semibold uppercase tracking-wider"
            style={{ color: "var(--accent-strong)" }}
          >
            {focus.eyebrow}
          </p>
          <h2
            className="mt-1.5 text-[1.5rem] font-bold tracking-tight sm:text-[1.85rem]"
            style={{ color: "var(--text)", letterSpacing: "-0.03em" }}
          >
            {focus.title}
          </h2>
          <p
            className="mt-2 max-w-[42rem] text-[0.95rem] leading-[1.6]"
            style={{ color: "var(--text-muted)" }}
          >
            {focus.body}
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <ActionPill action={focus.primary} primary />
            {focus.secondary ? <ActionPill action={focus.secondary} /> : null}
          </div>
        </div>
      </div>
    </section>
  );
}

function ActionPill({
  action,
  primary = false,
}: {
  action: TopAction;
  primary?: boolean;
}) {
  return (
    <Link
      href={action.href}
      className="inline-flex flex-col items-start gap-0.5 rounded-[1.1rem] px-4 py-2.5 text-[0.875rem] font-semibold transition-opacity hover:opacity-90 sm:flex-row sm:items-center sm:gap-2 sm:rounded-full"
      style={{
        background: primary ? "var(--text)" : "var(--bg-page)",
        color: primary ? "var(--bg-page)" : "var(--text)",
        border: primary
          ? "1px solid transparent"
          : "1px solid var(--border-soft)",
      }}
    >
      <span>{action.label}</span>
      {action.detail ? (
        <span
          className="text-[0.8125rem] font-normal"
          style={{
            color: primary ? "var(--bg-page)" : "var(--text-muted)",
            opacity: primary ? 0.75 : 1,
          }}
        >
          {action.detail}
        </span>
      ) : null}
    </Link>
  );
}
