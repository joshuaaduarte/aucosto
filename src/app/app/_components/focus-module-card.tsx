import Link from "next/link";
import { SparkIcon } from "./icons";
import type { FocusModule, TopAction } from "./hub-types";

export function FocusModuleCard({ focus }: { focus: FocusModule }) {
  return (
    <section
      className="fade-in-delay-1 rounded-xl px-5 py-5 sm:px-6 sm:py-6"
      style={{
        background: "linear-gradient(180deg, var(--bg-page) 0%, var(--bg-tint) 100%)",
        border: "1px solid var(--border-faint)",
      }}
    >
      <div className="flex items-start gap-3">
        <span
          className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
          style={{ background: "var(--accent-tint)", color: "var(--accent-strong)" }}
        >
          <SparkIcon />
        </span>
        <div className="min-w-0 flex-1">
          <p
            className="text-[0.6875rem] font-semibold uppercase tracking-wider"
            style={{ color: "var(--text-faint)" }}
          >
            {focus.eyebrow}
          </p>
          <h2
            className="mt-1 text-[1.3rem] font-semibold tracking-tight sm:text-[1.55rem]"
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
          <div className="mt-4 flex flex-wrap gap-2">
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
      className="inline-flex flex-col items-start gap-0.5 rounded-[1.1rem] px-3 py-2 text-[0.85rem] font-medium transition-colors sm:flex-row sm:items-center sm:gap-2 sm:rounded-full"
      style={{
        background: primary ? "var(--text)" : "var(--bg-page)",
        color: primary ? "var(--bg-page)" : "var(--text)",
        border: primary ? "1px solid transparent" : "1px solid var(--border-faint)",
      }}
    >
      <span>{action.label}</span>
      <span style={{ color: primary ? "rgba(255,255,255,0.72)" : "var(--text-faint)" }}>
        {action.detail}
      </span>
    </Link>
  );
}
