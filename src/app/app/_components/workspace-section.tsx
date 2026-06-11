import Link from "next/link";
import { ArrowRight, CalendarIcon, ClockIcon, ConnectionIcon, WalletIcon } from "./icons";

export function WorkspaceSection({ financeVisible }: { financeVisible: boolean }) {
  return (
    <section className="fade-in-delay-3">
      <div className="mb-3 flex items-center justify-between gap-3 px-1">
        <p
          className="text-[0.6875rem] font-semibold uppercase tracking-wider"
          style={{ color: "var(--text-faint)" }}
        >
          Your workspace
        </p>
        <p
          className="text-[0.75rem]"
          style={{ color: "var(--text-faint)" }}
        >
          Jump straight into the tool you want.
        </p>
      </div>
      <ul className="flex flex-col gap-0.5">
        <ToolLink href="/app/calendar" icon={<CalendarIcon />} label="Calendar" hint="Planned time for the week." />
        <ToolLink href="/app/do" icon={<ConnectionIcon />} label="Do List" hint="Tasks, estimates, and actuals." />
        <ToolLink href="/app/habits" icon={<ConnectionIcon />} label="Habits" hint="Repeatable behaviors, streaks, and due-today rhythm." />
        <ToolLink href="/app/projects" icon={<ConnectionIcon />} label="Projects" hint="Outcomes, milestones, and linked work." />
        <ToolLink href="/app/time" icon={<ClockIcon />} label="Time" hint="Logged sessions and where the week went." />
        {financeVisible && (
          <ToolLink href="/app/finance" icon={<WalletIcon />} label="Finance" hint="Net worth, spend, and monthly pace." />
        )}
      </ul>
    </section>
  );
}

function ToolLink({
  href,
  icon,
  label,
  hint,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  hint: string;
}) {
  return (
    <li>
      <Link
        href={href}
        className="group grid grid-cols-[20px_1fr_auto] items-center gap-3 rounded-md px-2 py-2.5 transition-colors hover:bg-bg-hover"
      >
        <span style={{ color: "var(--text-faint)" }}>{icon}</span>
        <div className="min-w-0">
          <p
            className="text-[0.9375rem] font-semibold tracking-tight"
            style={{ color: "var(--text)" }}
          >
            {label}
          </p>
          <p
            className="mt-0.5 text-[0.8125rem]"
            style={{ color: "var(--text-muted)" }}
          >
            {hint}
          </p>
        </div>
        <span
          className="opacity-0 transition-opacity group-hover:opacity-100"
          style={{ color: "var(--text-faint)" }}
        >
          <ArrowRight />
        </span>
      </Link>
    </li>
  );
}
