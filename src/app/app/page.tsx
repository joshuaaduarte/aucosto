import Link from "next/link";
import { auth } from "@/auth";
import { startOfMonth, startOfPreviousMonth } from "@/lib/money";
import { listAccounts, listTransactions } from "@/lib/services/finance";
import { getRunningEntry, listCompletedSince } from "@/lib/services/time";
import { startOfWeek } from "@/lib/time";
import { sumDurations } from "@/lib/time-summary";
import { getViewerContext } from "@/lib/viewer-context";
import { deriveHubPrompts } from "./_lib/hub-prompts";
import { CardMenu } from "./card-menu";

const toneAccent: Record<string, string> = {
  amber: "var(--accent)",
  sky: "var(--text)",
  emerald: "var(--text)",
  zinc: "var(--text-faint)",
};

/* ──────────────────────────────────────────────────────────────────
   Icons (kept here — small set, no need for a shared file)
   ────────────────────────────────────────────────────────────────── */
const ip = {
  width: 14,
  height: 14,
  viewBox: "0 0 15 15",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.25,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

function ClockIcon() {
  return (
    <svg {...ip}>
      <circle cx="7.5" cy="7.5" r="5.5" />
      <path d="M7.5 4.5V7.5l2 1.25" />
    </svg>
  );
}
function WalletIcon() {
  return (
    <svg {...ip}>
      <path d="M2 5.5C2 4.67 2.67 4 3.5 4H12a1 1 0 0 1 1 1v6.5c0 .83-.67 1.5-1.5 1.5h-8A1.5 1.5 0 0 1 2 11.5V5.5Z" />
      <path d="M10 8.25h2.5" />
    </svg>
  );
}
function CalendarIcon() {
  return (
    <svg {...ip}>
      <rect x="2" y="3" width="11" height="10" rx="1.5" />
      <path d="M2 6h11M5 1.75v2.5M10 1.75v2.5" />
    </svg>
  );
}
function ConnectionIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="3" cy="3" r="1.5" />
      <circle cx="10" cy="10" r="1.5" />
      <path d="M4.4 4.4 8.6 8.6" />
    </svg>
  );
}
function ArrowRight() {
  return (
    <svg width="11" height="11" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M2.5 6.5h8M7 3l3.5 3.5L7 10" />
    </svg>
  );
}

/* ──────────────────────────────────────────────────────────────────
   Page
   ────────────────────────────────────────────────────────────────── */

export default async function HubPage() {
  const session = await auth();
  const context = await getViewerContext();
  const firstName = session?.user?.name?.split(" ")[0];
  const timezone = resolveViewerTimeZone(context?.timezone);

  const userId = context?.effectiveUserId;
  const financeVisible = context?.financeVisible ?? false;
  const financeHasPin = false;
  const financeLocked = false;

  const [runningEntry, weekEntries, accounts, thisMonthTx, lastMonthTx] = userId
    ? await Promise.all([
        getRunningEntry(userId),
        listCompletedSince(userId, startOfWeek()),
        financeVisible && !financeLocked
          ? listAccounts(userId)
          : Promise.resolve([]),
        financeVisible && !financeLocked
          ? listTransactions(userId, { since: startOfMonth(), limit: 1000 })
          : Promise.resolve([]),
        financeVisible && !financeLocked
          ? listTransactions(userId, {
              since: startOfPreviousMonth(),
              limit: 1000,
            })
          : Promise.resolve([]),
      ])
    : [null, [], [], [], []];

  const monthStart = startOfMonth();
  const previousMonthStart = startOfPreviousMonth();
  const weekTotalMs = sumDurations(weekEntries);
  const thisMonthSpentCents = sumSpend(
    thisMonthTx.filter((t) => t.date >= monthStart),
  );
  const lastMonthSpentCents = sumSpend(
    lastMonthTx.filter(
      (t) => t.date >= previousMonthStart && t.date < monthStart,
    ),
  );

  const prompts = deriveHubPrompts({
    runningEntry,
    weekTotalMs,
    accounts: financeVisible && !financeLocked ? accounts : undefined,
    thisMonthSpentCents:
      financeVisible && !financeLocked ? thisMonthSpentCents : undefined,
    lastMonthSpentCents:
      financeVisible && !financeLocked ? lastMonthSpentCents : undefined,
  });

  const todayLong = new Intl.DateTimeFormat([], {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: timezone,
  }).format(new Date());

  const greeting = hourOfDayGreeting(timezone);

  return (
    <div className="space-y-10">
      {/* ── Page header ─────────────────────────────────────── */}
      <header className="fade-in">
        <p
          className="text-[0.75rem] font-medium uppercase tracking-wider"
          style={{ color: "var(--text-faint)" }}
        >
          {todayLong}
        </p>
        <h1
          className="mt-1 text-[2rem] font-bold tracking-tight sm:text-[2.5rem]"
          style={{ color: "var(--text)", letterSpacing: "-0.025em" }}
        >
          {greeting}
          {firstName ? `, ${firstName}` : ""}.
        </h1>
        <p
          className="mt-2 text-[0.9375rem]"
          style={{ color: "var(--text-muted)" }}
        >
          {composeSubline({
            runningEntry,
            weekTotalMs,
            financeVisible,
            financeLocked,
            thisMonthSpentCents,
          })}
        </p>
      </header>

      {/* ── Cross-tool callout — the headline insight ─────── */}
      <CrossToolCallout
        runningEntry={runningEntry}
        weekTotalMs={weekTotalMs}
        financeVisible={financeVisible && !financeLocked}
        thisMonthSpentCents={thisMonthSpentCents}
      />

      {/* ── Quick cards ─────────────────────────────────────── */}
      <section className="fade-in-delay-1">
        <p
          className="mb-2 px-1 text-[0.6875rem] font-semibold uppercase tracking-wider"
          style={{ color: "var(--text-faint)" }}
        >
          Quick read
        </p>
        <div className="grid grid-cols-1 gap-px sm:grid-cols-2"
             style={{ background: "var(--border-faint)", borderRadius: "8px", overflow: "hidden", border: "1px solid var(--border-faint)" }}>
          <QuickCard
            href="/app/time"
            icon={<ClockIcon />}
            label="Time"
            value={runningEntry ? "Running" : formatHoursMs(weekTotalMs)}
            meta={
              runningEntry
                ? (runningEntry.label ?? "Untitled session")
                : "this week so far"
            }
            running={Boolean(runningEntry)}
          />
          {financeVisible ? (
            <QuickCard
              href="/app/finance"
              icon={<WalletIcon />}
              label="Finance"
              value={
                financeLocked
                  ? "Locked"
                  : formatCents(thisMonthSpentCents)
              }
              meta={
                financeLocked
                  ? "Tap to unlock"
                  : lastMonthSpentCents > 0
                    ? `vs ${formatCents(lastMonthSpentCents)} last month`
                    : "spent this month"
              }
              menu={
                <CardMenu
                  widgetId="finance"
                  hasPin={financeHasPin}
                  isLocked={financeLocked}
                />
              }
            />
          ) : (
            <QuickCard
              href="/app/calendar"
              icon={<CalendarIcon />}
              label="Calendar"
              value="Today"
              meta="see what's scheduled"
            />
          )}
        </div>
      </section>

      {/* ── Signals ─────────────────────────────────────────── */}
      {prompts.length > 0 && (
        <section className="fade-in-delay-2">
          <p
            className="mb-2 px-1 text-[0.6875rem] font-semibold uppercase tracking-wider"
            style={{ color: "var(--text-faint)" }}
          >
            Today&apos;s signals
          </p>
          <ul className="space-y-1.5">
            {prompts.map((prompt, i) => (
              <li
                key={`${prompt.text}-${i}`}
                className="grid grid-cols-[20px_1fr] items-start gap-3 rounded-md px-3 py-2.5 transition-colors hover:bg-bg-hover"
              >
                <span
                  className="mt-1.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full"
                  style={{
                    background: toneAccent[prompt.tone] ?? "var(--text)",
                  }}
                />
                <p
                  className="text-[0.9375rem] leading-[1.55]"
                  style={{ color: "var(--text)" }}
                >
                  {prompt.text}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ── Tools index ───────────────────────────────────── */}
      <section className="fade-in-delay-3">
        <p
          className="mb-2 px-1 text-[0.6875rem] font-semibold uppercase tracking-wider"
          style={{ color: "var(--text-faint)" }}
        >
          Your workspace
        </p>
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
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────
   Subcomponents
   ────────────────────────────────────────────────────────────────── */

function QuickCard({
  href,
  icon,
  label,
  value,
  meta,
  running,
  menu,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  value: string;
  meta: string;
  running?: boolean;
  menu?: React.ReactNode;
}) {
  return (
    <div className="group relative" style={{ background: "var(--bg-page)" }}>
      <Link
        href={href}
        className="block px-4 py-4 transition-colors hover:bg-bg-hover"
      >
        <div className="flex items-center gap-2">
          <span style={{ color: "var(--text-faint)" }}>{icon}</span>
          <span
            className="text-[0.75rem] font-semibold uppercase tracking-wider"
            style={{ color: "var(--text-faint)" }}
          >
            {label}
          </span>
          {running && (
            <span
              className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[0.625rem] font-medium uppercase tracking-wider"
              style={{
                background: "var(--accent-tint)",
                color: "var(--accent-strong)",
              }}
            >
              <span
                className="ink-pulse inline-block h-1 w-1 rounded-full"
                style={{ background: "var(--accent)" }}
              />
              Live
            </span>
          )}
        </div>
        <p
          className="mt-2 text-[1.5rem] font-semibold tracking-tight"
          style={{
            color: "var(--text)",
            letterSpacing: "-0.025em",
            fontFeatureSettings: '"tnum" 1',
          }}
        >
          {value}
        </p>
        <p
          className="mt-0.5 text-[0.8125rem]"
          style={{ color: "var(--text-muted)" }}
        >
          {meta}
        </p>
      </Link>
      {menu}
    </div>
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
        className="group grid grid-cols-[20px_1fr_auto] items-center gap-3 rounded-md px-2 py-2 transition-colors hover:bg-bg-hover"
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

function CrossToolCallout({
  runningEntry,
  weekTotalMs,
  financeVisible,
  thisMonthSpentCents,
}: {
  runningEntry: { label: string | null } | null;
  weekTotalMs: number;
  financeVisible: boolean;
  thisMonthSpentCents: number;
}) {
  // Pick the most useful intersection given the data we have.
  const lines: { headline: string; body: string } = (() => {
    if (financeVisible && weekTotalMs > 0 && thisMonthSpentCents > 0) {
      const weekHours = weekTotalMs / 3_600_000;
      return {
        headline: "Time × Finance",
        body: `${weekHours.toFixed(1)}h logged this week · ${formatCents(thisMonthSpentCents)} out the door this month. The intersection lives here.`,
      };
    }
    if (runningEntry) {
      return {
        headline: "Time",
        body: `A session is open right now. The hub will stay aware of it until you close it.`,
      };
    }
    if (weekTotalMs > 0) {
      return {
        headline: "This week",
        body: `${formatHoursMs(weekTotalMs)} logged so far — open Time to add to it, or Calendar to shape what's next.`,
      };
    }
    return {
      headline: "A quiet start",
      body: "Nothing's running and nothing's overdue. Pick a tool below — the others will catch on.",
    };
  })();

  return (
    <div
      className="fade-in-delay-1 flex items-start gap-3 rounded-md px-4 py-3.5"
      style={{
        background: "var(--bg-tint)",
        border: "1px solid var(--border-faint)",
      }}
    >
      <span
        className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded"
        style={{ color: "var(--text)" }}
      >
        <ConnectionIcon />
      </span>
      <div className="min-w-0">
        <p
          className="text-[0.8125rem] font-semibold"
          style={{ color: "var(--text)" }}
        >
          {lines.headline}
        </p>
        <p
          className="mt-0.5 text-[0.875rem] leading-[1.5]"
          style={{ color: "var(--text-muted)" }}
        >
          {lines.body}
        </p>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────
   Helpers (no client APIs here — these are pure values used in
   Server Components, so they avoid the react-hooks/purity gotcha)
   ────────────────────────────────────────────────────────────────── */

function hourOfDayGreeting(timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    hour12: false,
    timeZone,
  }).formatToParts(new Date());
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? "12");
  if (hour < 5) return "Still up";
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  if (hour < 21) return "Good evening";
  return "Good night";
}

function resolveViewerTimeZone(timeZone: string | null | undefined): string {
  if (!timeZone || timeZone === "UTC") {
    return "America/Los_Angeles";
  }
  return timeZone;
}

function composeSubline({
  runningEntry,
  weekTotalMs,
  financeVisible,
  financeLocked,
  thisMonthSpentCents,
}: {
  runningEntry: unknown;
  weekTotalMs: number;
  financeVisible: boolean;
  financeLocked: boolean;
  thisMonthSpentCents: number;
}): string {
  const bits: string[] = [];
  if (runningEntry) bits.push("a session is running");
  if (weekTotalMs > 0) bits.push(`${formatHoursMs(weekTotalMs)} logged this week`);
  if (financeVisible && !financeLocked && thisMonthSpentCents > 0)
    bits.push(`${formatCents(thisMonthSpentCents)} spent this month`);

  if (bits.length === 0) return "Quiet so far — open a tool to start the day.";
  if (bits.length === 1) return capitalize(bits[0]!) + ".";
  return capitalize(bits.slice(0, -1).join(", ")) + ", and " + bits.at(-1) + ".";
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function sumSpend(transactions: { amount: number }[]): number {
  return transactions.reduce(
    (acc, t) => (t.amount < 0 ? acc + Math.abs(t.amount) : acc),
    0,
  );
}

function formatHoursMs(ms: number): string {
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function formatCents(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(cents / 100);
}
