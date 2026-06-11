import Link from "next/link";
import type { TopAction } from "./hub-types";

export function HubHeader({
  todayLong,
  greeting,
  firstName,
  subline,
  actions,
}: {
  todayLong: string;
  greeting: string;
  firstName: string | undefined;
  subline: string;
  actions: TopAction[];
}) {
  return (
    <header className="fade-in space-y-4 sm:space-y-5">
      <div>
        <p
          className="text-[0.72rem] font-medium uppercase tracking-wider"
          style={{ color: "var(--text-faint)" }}
        >
          {todayLong}
        </p>
        <h1
          className="mt-1 text-[2rem] font-bold tracking-tight sm:text-[2.5rem]"
          style={{ color: "var(--text)", letterSpacing: "-0.03em" }}
        >
          {greeting}
          {firstName ? `, ${firstName}` : ""}.
        </h1>
        <p
          className="mt-2 max-w-[42rem] text-[0.95rem] leading-[1.5]"
          style={{ color: "var(--text-muted)" }}
        >
          {subline}
        </p>
      </div>

      <TopActionsBar actions={actions} />
    </header>
  );
}

function TopActionsBar({ actions }: { actions: TopAction[] }) {
  if (actions.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {actions.map((action) => (
        <Link
          key={`${action.href}-${action.label}`}
          href={action.href}
          className="rounded-full border px-3 py-2 text-[0.8125rem] font-medium transition-colors hover:bg-bg-hover"
          style={{
            borderColor: "var(--border-faint)",
            color: "var(--text)",
            background: "var(--bg-page)",
          }}
        >
          <span>{action.label}</span>
          <span style={{ color: "var(--text-faint)" }}> · {action.detail}</span>
        </Link>
      ))}
    </div>
  );
}
