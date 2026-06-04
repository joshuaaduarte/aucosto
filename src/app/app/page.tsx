import Link from "next/link";
import { auth } from "@/auth";
import { startOfMonth, startOfPreviousMonth } from "@/lib/money";
import { listUpcomingCalendarItems } from "@/lib/services/calendar";
import { listSuggestedDoItems } from "@/lib/services/do";
import { listAccounts, listTransactions } from "@/lib/services/finance";
import { listSuggestedHabits } from "@/lib/services/habits";
import { listProjects } from "@/lib/services/projects";
import { getRunningEntry, listCompletedSince } from "@/lib/services/time";
import { startOfWeek } from "@/lib/time";
import { sumDurations } from "@/lib/time-summary";
import { getViewerContext } from "@/lib/viewer-context";
import { deriveHubPrompts, type HubPrompt } from "./_lib/hub-prompts";
import { CardMenu } from "./card-menu";

const toneAccent: Record<string, string> = {
  amber: "var(--accent)",
  sky: "var(--text)",
  emerald: "var(--text)",
  zinc: "var(--text-faint)",
};

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
function SparkIcon() {
  return (
    <svg {...ip}>
      <path d="M7.5 2.25 8.7 5.4l3.05 1.2-3.05 1.2-1.2 3.15-1.2-3.15-3.05-1.2 3.05-1.2 1.2-3.15Z" />
    </svg>
  );
}

type TopAction = {
  href: string;
  label: string;
  detail: string;
};

type FocusModule = {
  eyebrow: string;
  title: string;
  body: string;
  primary: TopAction;
  secondary?: TopAction;
};

type ConnectionItem = {
  tone: "sky" | "amber" | "emerald" | "zinc";
  title: string;
  body: string;
  href: string;
  ctaLabel: string;
};

export default async function HubPage() {
  const session = await auth();
  const context = await getViewerContext();
  const firstName = session?.user?.name?.split(" ")[0];
  const timezone = resolveViewerTimeZone(context?.timezone);

  const userId = context?.effectiveUserId;
  const financeVisible = context?.financeVisible ?? false;
  const financeHasPin = false;
  const financeLocked = false;

  const [
    runningEntry,
    weekEntries,
    accounts,
    thisMonthTx,
    lastMonthTx,
    suggestedTasks,
    suggestedHabits,
    projects,
    upcomingCalendar,
  ] = userId
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
        listSuggestedDoItems(userId, { limit: 3 }),
        listSuggestedHabits(userId, { limit: 3 }),
        listProjects(userId),
        listUpcomingCalendarItems(userId, { limit: 3 }),
      ])
    : [null, [], [], [], [], [], [], [], []];

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

  const topActions = deriveTopActions({
    runningEntry,
    suggestedTasks,
    suggestedHabits,
    upcomingCalendar,
    financeVisible,
    accounts,
  });
  const focus = deriveFocusModule({
    runningEntry,
    suggestedTasks,
    suggestedHabits,
    projects,
    upcomingCalendar,
    topActions,
  });
  const connections = deriveConnections({
    runningEntry,
    suggestedTasks,
    suggestedHabits,
    projects,
    upcomingCalendar,
  });

  const todayLong = new Intl.DateTimeFormat([], {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: timezone,
  }).format(new Date());

  const greeting = hourOfDayGreeting(timezone);

  return (
    <div className="space-y-7 sm:space-y-8">
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
            {composeSubline({
              runningEntry,
              weekTotalMs,
              financeVisible,
              financeLocked,
              thisMonthSpentCents,
            })}
          </p>
        </div>

        <TopActionsBar actions={topActions} />
      </header>

      <FocusModuleCard focus={focus} />

      <CrossToolCallout
        runningEntry={runningEntry}
        weekTotalMs={weekTotalMs}
        financeVisible={financeVisible && !financeLocked}
        thisMonthSpentCents={thisMonthSpentCents}
      />

      <section className="fade-in-delay-1">
        <div className="mb-3 flex items-center justify-between gap-3 px-1">
          <p
            className="text-[0.6875rem] font-semibold uppercase tracking-wider"
            style={{ color: "var(--text-faint)" }}
          >
            Quick actions
          </p>
          <p
            className="text-[0.75rem]"
            style={{ color: "var(--text-faint)" }}
          >
            Keep the common moves one tap away.
          </p>
        </div>
        <div
          className="grid grid-cols-1 gap-px sm:grid-cols-2"
          style={{
            background: "var(--border-faint)",
            borderRadius: "10px",
            overflow: "hidden",
            border: "1px solid var(--border-faint)",
          }}
        >
          <QuickCard
            href="/app/time"
            icon={<ClockIcon />}
            label="Time"
            value={runningEntry ? "Running" : formatHoursMs(weekTotalMs)}
            meta={
              runningEntry
                ? runningEntry.label ?? "Untitled session"
                : weekTotalMs > 0
                  ? "tracked this week"
                  : "nothing running right now"
            }
            running={Boolean(runningEntry)}
            actionLabel={runningEntry ? "Review session" : "Start session"}
            actionHref="/app/time"
          />
          {financeVisible ? (
            <QuickCard
              href="/app/finance"
              icon={<WalletIcon />}
              label="Finance"
              value={financeLocked ? "Locked" : formatCents(thisMonthSpentCents)}
              meta={
                financeLocked
                  ? "tap to unlock"
                  : lastMonthSpentCents > 0
                    ? `vs ${formatCents(lastMonthSpentCents)} last month`
                    : "spent this month"
              }
              actionLabel="Review finance"
              actionHref="/app/finance"
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
              value={upcomingCalendar[0] ? "Scheduled" : "Open"}
              meta={
                upcomingCalendar[0]
                  ? upcomingCalendar[0].title
                  : "no block is protected yet"
              }
              actionLabel="Add block"
              actionHref="/app/calendar"
            />
          )}
          <QuickCard
            href="/app/do"
            icon={<ConnectionIcon />}
            label="Do List"
            value={suggestedTasks[0] ? suggestedTasks[0].title : "Quiet"}
            meta={
              suggestedTasks[0]
                ? `${formatMinutesLabel(suggestedTasks[0].estimatedMinutes)} · ${humanizeDoStatus(suggestedTasks[0].status)}`
                : "capture the next task worth doing"
            }
            actionLabel="Add task"
            actionHref="/app/do"
          />
          <QuickCard
            href="/app/habits"
            icon={<ConnectionIcon />}
            label="Habits"
            value={
              suggestedHabits[0]
                ? suggestedHabits[0].completedToday
                  ? "Handled"
                  : suggestedHabits[0].dueToday
                    ? "Due today"
                    : "Keep warm"
                : "Quiet"
            }
            meta={
              suggestedHabits[0]
                ? `${suggestedHabits[0].title} · ${suggestedHabits[0].currentStreak} streak`
                : "add a repeatable behavior"
            }
            actionLabel="Log habit"
            actionHref="/app/habits"
          />
        </div>
      </section>

      {prompts.length > 0 && (
        <section className="fade-in-delay-2">
          <div className="mb-3 flex items-center justify-between gap-3 px-1">
            <p
              className="text-[0.6875rem] font-semibold uppercase tracking-wider"
              style={{ color: "var(--text-faint)" }}
            >
              What needs a decision
            </p>
            <p
              className="text-[0.75rem]"
              style={{ color: "var(--text-faint)" }}
            >
              Read these as prompts, not status blurbs.
            </p>
          </div>
          <ul className="space-y-2">
            {prompts.map((prompt, i) => (
              <SignalRow key={`${prompt.text}-${i}`} prompt={prompt} />
            ))}
          </ul>
        </section>
      )}

      {connections.length > 0 && (
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
      )}

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
    </div>
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

function FocusModuleCard({ focus }: { focus: FocusModule }) {
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

function QuickCard({
  href,
  icon,
  label,
  value,
  meta,
  running,
  actionLabel,
  actionHref,
  menu,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  value: string;
  meta: string;
  running?: boolean;
  actionLabel: string;
  actionHref: string;
  menu?: React.ReactNode;
}) {
  return (
    <div className="group relative" style={{ background: "var(--bg-page)" }}>
      <Link href={href} className="block px-4 py-4 transition-colors hover:bg-bg-hover">
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
          className="mt-2 line-clamp-2 text-[1.45rem] font-semibold tracking-tight sm:text-[1.55rem]"
          style={{
            color: "var(--text)",
            letterSpacing: "-0.03em",
            fontFeatureSettings: '"tnum" 1',
          }}
        >
          {value}
        </p>
        <p
          className="mt-1 line-clamp-2 text-[0.83rem] leading-[1.45]"
          style={{ color: "var(--text-muted)" }}
        >
          {meta}
        </p>
      </Link>
      <div className="flex items-center justify-between px-4 pb-4 pt-1">
        <Link
          href={actionHref}
          className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[0.75rem] font-medium transition-colors hover:bg-bg-hover"
          style={{ color: "var(--text)" }}
        >
          {actionLabel}
          <ArrowRight />
        </Link>
        {menu}
      </div>
    </div>
  );
}

function SignalRow({ prompt }: { prompt: HubPrompt }) {
  return (
    <li
      className="grid grid-cols-[14px_1fr] gap-3 rounded-lg border px-3 py-3 sm:grid-cols-[14px_1fr_auto] sm:items-start"
      style={{ borderColor: "var(--border-faint)", background: "var(--bg-page)" }}
    >
      <span
        className="mt-1.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full"
        style={{
          background: toneAccent[prompt.tone] ?? "var(--text)",
        }}
      />
      <p
        className="min-w-0 text-[0.92rem] leading-[1.55]"
        style={{ color: "var(--text)" }}
      >
        {prompt.text}
      </p>
      <Link
        href={prompt.href}
        className="mt-2 inline-flex items-center gap-1 text-[0.8rem] font-medium sm:mt-0 sm:justify-self-end"
        style={{ color: "var(--text-muted)" }}
      >
        {prompt.ctaLabel}
        <ArrowRight />
      </Link>
    </li>
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
  const lines: { headline: string; body: string } = (() => {
    if (financeVisible && weekTotalMs > 0 && thisMonthSpentCents > 0) {
      const weekHours = weekTotalMs / 3_600_000;
      return {
        headline: "Time and money are finally in the same room",
        body: `${weekHours.toFixed(1)}h is logged this week, and ${formatCents(thisMonthSpentCents)} has gone out this month. The point of the hub is deciding what to do with that context.`,
      };
    }
    if (runningEntry) {
      return {
        headline: "One live thread is already open",
        body: "The dashboard knows a session is in motion. Let that steer the next decision instead of starting fresh somewhere else.",
      };
    }
    if (weekTotalMs > 0) {
      return {
        headline: "The week already has shape",
        body: `${formatHoursMs(weekTotalMs)} is logged so far. Use that evidence to decide what deserves the next block.`,
      };
    }
    return {
      headline: "Use the quiet before the day uses you",
      body: "Nothing is running yet. A small plan here will make the rest of the workspace smarter.",
    };
  })();

  return (
    <div
      className="fade-in-delay-1 flex items-start gap-3 rounded-lg px-4 py-3.5"
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

function deriveTopActions(input: {
  runningEntry: Awaited<ReturnType<typeof getRunningEntry>>;
  suggestedTasks: Awaited<ReturnType<typeof listSuggestedDoItems>>;
  suggestedHabits: Awaited<ReturnType<typeof listSuggestedHabits>>;
  upcomingCalendar: Awaited<ReturnType<typeof listUpcomingCalendarItems>>;
  financeVisible: boolean;
  accounts: Awaited<ReturnType<typeof listAccounts>>;
}): TopAction[] {
  const actions: TopAction[] = [];

  if (input.runningEntry) {
    actions.push({
      href: "/app/time",
      label: "Resume timer",
      detail: input.runningEntry.label ?? "active session",
    });
  } else {
    actions.push({
      href: "/app/time",
      label: "Start session",
      detail: input.suggestedTasks[0]?.title ?? "open a focused block",
    });
  }

  if (input.upcomingCalendar.length === 0) {
    actions.push({
      href: "/app/calendar",
      label: "Plan today",
      detail: "no block is protected yet",
    });
  } else {
    actions.push({
      href: "/app/calendar",
      label: "Check calendar",
      detail: formatShortWhen(input.upcomingCalendar[0]!.startsAt),
    });
  }

  if (input.suggestedHabits[0] && !input.suggestedHabits[0].completedToday) {
    actions.push({
      href: "/app/habits",
      label: "Log habit",
      detail: input.suggestedHabits[0].title,
    });
  } else if (input.financeVisible && input.accounts.some((account) => Boolean(account.dueDate))) {
    actions.push({
      href: "/app/finance",
      label: "Review finance",
      detail: "due dates and pace",
    });
  } else {
    actions.push({
      href: "/app/do",
      label: "Add task",
      detail: "capture the next move",
    });
  }

  return actions.slice(0, 3);
}

function deriveFocusModule(input: {
  runningEntry: Awaited<ReturnType<typeof getRunningEntry>>;
  suggestedTasks: Awaited<ReturnType<typeof listSuggestedDoItems>>;
  suggestedHabits: Awaited<ReturnType<typeof listSuggestedHabits>>;
  projects: Awaited<ReturnType<typeof listProjects>>;
  upcomingCalendar: Awaited<ReturnType<typeof listUpcomingCalendarItems>>;
  topActions: TopAction[];
}): FocusModule {
  const atRiskProject = input.projects.find(
    (project) =>
      project.status !== "done" &&
      project.healthFlags.some((flag) => flag.tone === "warning"),
  );

  if (input.runningEntry) {
    return {
      eyebrow: "What matters now",
      title: `Stay with ${input.runningEntry.label ?? "the live session"}`,
      body:
        input.runningEntry.doItem
          ? `This timer is tied to ${input.runningEntry.doItem.title}. Finish the loop cleanly instead of letting the session blur into the rest of the day.`
          : input.runningEntry.habit
            ? `This session is supporting ${input.runningEntry.habit.title}. When you stop, make sure the habit gets the credit for it.`
            : "A session is already in motion. The best dashboard move is usually to finish or reflect on that before starting something else.",
      primary: {
        href: "/app/time",
        label: "Review session",
        detail: "stop or continue with context",
      },
      secondary: input.runningEntry.doItem
        ? {
            href: "/app/do",
            label: "Open linked task",
            detail: input.runningEntry.doItem.title,
          }
        : undefined,
    };
  }

  if (atRiskProject) {
    return {
      eyebrow: "What matters today",
      title: atRiskProject.name,
      body:
        atRiskProject.healthFlags[0]?.message ??
        "This project needs a clearer next move before it quietly drifts.",
      primary: {
        href: "/app/projects",
        label: "Open project",
        detail: `${atRiskProject.openTaskCount} open tasks`,
      },
      secondary:
        atRiskProject.upcomingBlocks.length === 0
          ? {
              href: "/app/calendar",
              label: "Protect time",
              detail: "no block is scheduled yet",
            }
          : undefined,
    };
  }

  if (input.suggestedTasks[0]) {
    const nextTask = input.suggestedTasks[0];
    return {
      eyebrow: "What matters today",
      title: nextTask.title,
      body: nextTask.projectName
        ? `${nextTask.projectName} is already asking for movement here. Turn it into time or finish it while it is still clearly next.`
        : "This is the cleanest next task in the workspace right now. If it matters, give it protected time before something noisier wins.",
      primary: {
        href: "/app/do",
        label: "Open Do List",
        detail: formatMinutesLabel(nextTask.estimatedMinutes),
      },
      secondary: {
        href: "/app/calendar",
        label: "Plan a block",
        detail: "turn intent into time",
      },
    };
  }

  if (input.suggestedHabits[0]) {
    const habit = input.suggestedHabits[0];
    return {
      eyebrow: "What matters today",
      title: habit.title,
      body: habit.completedToday
        ? `Today is already handled here. Use the streak momentum to keep the rest of the day honest.`
        : habit.dueToday
          ? `${habit.targetLabel} is still due today. Log it or give it a real block before the day closes.`
          : "No urgent tasks are ahead of this, which makes it a good low-friction behavior to keep warm.",
      primary: {
        href: "/app/habits",
        label: "Open habits",
        detail: `${habit.currentStreak} streak`,
      },
      secondary: {
        href: "/app/calendar",
        label: "Plan a block",
        detail: "make room for it",
      },
    };
  }

  if (input.upcomingCalendar[0]) {
    return {
      eyebrow: "What matters today",
      title: input.upcomingCalendar[0].title,
      body: `The next scheduled block starts ${formatShortWhen(input.upcomingCalendar[0].startsAt)}. Use the space before it to line up the task, habit, or session that belongs there.`,
      primary: {
        href: "/app/calendar",
        label: "Open calendar",
        detail: formatShortWhen(input.upcomingCalendar[0].startsAt),
      },
      secondary: input.topActions[0],
    };
  }

  return {
    eyebrow: "What matters today",
    title: "Start with one protected move",
    body: "The dashboard is quiet right now, which is useful if you turn it into intention. Protect one block, capture one task, or start one focused session before the day fills itself in.",
    primary: input.topActions[0] ?? {
      href: "/app/calendar",
      label: "Plan today",
      detail: "make the first block real",
    },
    secondary: input.topActions[1],
  };
}

function deriveConnections(input: {
  runningEntry: Awaited<ReturnType<typeof getRunningEntry>>;
  suggestedTasks: Awaited<ReturnType<typeof listSuggestedDoItems>>;
  suggestedHabits: Awaited<ReturnType<typeof listSuggestedHabits>>;
  projects: Awaited<ReturnType<typeof listProjects>>;
  upcomingCalendar: Awaited<ReturnType<typeof listUpcomingCalendarItems>>;
}): ConnectionItem[] {
  const items: ConnectionItem[] = [];

  if (input.runningEntry?.doItem) {
    items.push({
      tone: "sky",
      title: "Timer is attached to a Do item",
      body: `${input.runningEntry.doItem.title} is already in execution. Keep the task and session in sync so the work lands cleanly.`,
      href: "/app/do",
      ctaLabel: "Open linked task",
    });
  }

  const dueHabit = input.suggestedHabits.find(
    (habit) => habit.dueToday && !habit.completedToday,
  );
  if (dueHabit) {
    items.push({
      tone: "amber",
      title: "A due habit still has no closure",
      body: `${dueHabit.title} is due today with a ${dueHabit.currentStreak}-day streak behind it. Log it or give it protected time.`,
      href: "/app/habits",
      ctaLabel: "Handle habit",
    });
  }

  const blockedProject = input.projects.find(
    (project) =>
      project.status !== "done" &&
      project.scheduledThisWeekMinutes === 0 &&
      project.openTaskCount > 0,
  );
  if (blockedProject) {
    items.push({
      tone: "amber",
      title: "A live project has no time protected",
      body: `${blockedProject.name} still has ${blockedProject.openTaskCount} open tasks, but nothing is on the calendar for it this week.`,
      href: "/app/projects",
      ctaLabel: "Open project",
    });
  }

  if (!input.runningEntry && input.upcomingCalendar.length === 0 && input.suggestedTasks[0]) {
    items.push({
      tone: "zinc",
      title: "The next task has no calendar home yet",
      body: `${input.suggestedTasks[0].title} looks like the next move, but no upcoming block is protecting it.`,
      href: "/app/calendar",
      ctaLabel: "Protect time",
    });
  }

  return items.slice(0, 4);
}

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

  if (bits.length === 0) return "Quiet so far. Use the first move below to give the day a shape.";
  if (bits.length === 1) return capitalize(bits[0]!) + ".";
  return capitalize(bits.slice(0, -1).join(", ")) + ", and " + bits.at(-1) + ".";
}

function humanizeDoStatus(status: string) {
  switch (status) {
    case "in_progress":
      return "in progress";
    case "ready":
      return "ready";
    case "scheduled":
      return "scheduled";
    case "waiting":
      return "waiting";
    case "done":
      return "done";
    default:
      return status;
  }
}

function formatMinutesLabel(minutes: number | null | undefined) {
  if (!minutes || minutes <= 0) return "no estimate yet";
  if (minutes < 60) return `${minutes}m estimate`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder === 0
    ? `${hours}h estimate`
    : `${hours}h ${remainder}m estimate`;
}

function formatShortWhen(date: Date) {
  return date.toLocaleString([], {
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
  });
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
