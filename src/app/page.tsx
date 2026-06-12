import Link from "next/link";

/* Monoline tool icons: single set, reused across landing + app */

const iconProps = {
  width: 15,
  height: 15,
  viewBox: "0 0 15 15",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.25,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

function HomeIcon(): React.ReactElement {
  return (
    <svg {...iconProps}>
      <path d="M2 6.5 7.5 2l5.5 4.5V13H2V6.5Z" />
      <path d="M6 13V9h3v4" />
    </svg>
  );
}
function CalendarIcon(): React.ReactElement {
  return (
    <svg {...iconProps}>
      <rect x="2" y="3" width="11" height="10" rx="1.5" />
      <path d="M2 6h11M5 1.75v2.5M10 1.75v2.5" />
    </svg>
  );
}
function ClockIcon(): React.ReactElement {
  return (
    <svg {...iconProps}>
      <circle cx="7.5" cy="7.5" r="5.5" />
      <path d="M7.5 4.5V7.5l2 1.25" />
    </svg>
  );
}
function WalletIcon(): React.ReactElement {
  return (
    <svg {...iconProps}>
      <path d="M2 5.5C2 4.67 2.67 4 3.5 4H12a1 1 0 0 1 1 1v6.5c0 .83-.67 1.5-1.5 1.5h-8A1.5 1.5 0 0 1 2 11.5V5.5Z" />
      <path d="M10 8.25h2.5" />
    </svg>
  );
}
function ListIcon(): React.ReactElement {
  return (
    <svg {...iconProps}>
      <path d="M5 4h8M5 7.5h8M5 11h5" />
      <circle cx="2.5" cy="4" r="0.6" fill="currentColor" />
      <circle cx="2.5" cy="7.5" r="0.6" fill="currentColor" />
      <circle cx="2.5" cy="11" r="0.6" fill="currentColor" />
    </svg>
  );
}
function HabitIcon(): React.ReactElement {
  return (
    <svg {...iconProps}>
      <path d="M2 8.5 6 12.5 13 3.5" />
      <path d="M2 4.5 4.5 7" opacity="0.5" />
    </svg>
  );
}
function ProjectsIcon(): React.ReactElement {
  return (
    <svg {...iconProps}>
      <rect x="2" y="3" width="11" height="3" rx="0.75" />
      <rect x="2" y="8.5" width="7.5" height="3" rx="0.75" />
    </svg>
  );
}
function ReflectIcon(): React.ReactElement {
  return (
    <svg {...iconProps}>
      <path d="M11.5 8.5A5 5 0 1 1 6.5 3.5a4 4 0 0 0 5 5Z" />
    </svg>
  );
}
function InsightIcon(): React.ReactElement {
  return (
    <svg {...iconProps}>
      <path d="M1.5 8h2.25l1.5-4 2 8 1.75-4h4.5" />
    </svg>
  );
}
function RhythmIcon(): React.ReactElement {
  return (
    <svg {...iconProps}>
      <circle cx="7.5" cy="7.5" r="2.5" />
      <path d="M7.5 1.5v1.5M7.5 12v1.5M1.5 7.5h1.5M12 7.5h1.5M3.25 3.25l1 1M10.75 10.75l1 1M11.75 3.25l-1 1M4.25 10.75l-1 1" />
    </svg>
  );
}
function ArrowRight(): React.ReactElement {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 13 13"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.25"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M2.5 6.5h8M7 3l3.5 3.5L7 10" />
    </svg>
  );
}
function ConnectionIcon(): React.ReactElement {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 13 13"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.25"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="3" cy="3" r="1.5" />
      <circle cx="10" cy="10" r="1.5" />
      <path d="M4.4 4.4 8.6 8.6" />
    </svg>
  );
}

/* Content */

type Tool = {
  title: string;
  body: string;
  Icon: () => React.ReactElement;
  href: string;
};

const tools: Tool[] = [
  {
    title: "Time",
    body: "Track sessions as you work; see where the hours actually go.",
    Icon: ClockIcon,
    href: "/app/time",
  },
  {
    title: "Do List",
    body: "Capture tasks, sort by area, compare plan vs. reality.",
    Icon: ListIcon,
    href: "/app/do",
  },
  {
    title: "Calendar",
    body: "Fixed commitments and planned focus blocks on one timeline.",
    Icon: CalendarIcon,
    href: "/app/calendar",
  },
  {
    title: "Habits",
    body: "One-tap daily logging with streaks and consistency.",
    Icon: HabitIcon,
    href: "/app/habits",
  },
  {
    title: "Projects",
    body: "Outcomes, milestones, progress, and linked tasks.",
    Icon: ProjectsIcon,
    href: "/app/projects",
  },
  {
    title: "Finance",
    body: "Spend, net worth, and monthly pace from linked accounts.",
    Icon: WalletIcon,
    href: "/app/finance",
  },
  {
    title: "Reflect",
    body: "A nightly check-in on mood, energy, and the day.",
    Icon: ReflectIcon,
    href: "/app/reflect",
  },
  {
    title: "Insights",
    body: "Cross-tool patterns and trends across everything.",
    Icon: InsightIcon,
    href: "/app/insights",
  },
  {
    title: "Rhythms",
    body: "Guided flows for the day's natural transitions — wake-up, work, wind-down, sleep, workout.",
    Icon: RhythmIcon,
    href: "/app/rhythms",
  },
];

const intersections: Array<{ a: string; b: string; line: string }> = [
  {
    a: "Time",
    b: "Finance",
    line: "See earnings next to the hours you logged.",
  },
  {
    a: "Calendar",
    b: "Time",
    line: "Open gaps turn into focus suggestions.",
  },
  {
    a: "Habits",
    b: "Reflect",
    line: "Watch streaks line up against how the day felt.",
  },
  {
    a: "Projects",
    b: "Time",
    line: "Roll logged sessions up into real project progress.",
  },
];

/* Stylized workspace preview: sidebar + a page */

const previewNav: Array<{ icon: React.ReactNode; label: string; active?: boolean }> = [
  { icon: <HomeIcon />, label: "Today", active: true },
  { icon: <CalendarIcon />, label: "Calendar" },
  { icon: <ListIcon />, label: "Do List" },
  { icon: <HabitIcon />, label: "Habits" },
  { icon: <ClockIcon />, label: "Time" },
  { icon: <ProjectsIcon />, label: "Projects" },
  { icon: <ReflectIcon />, label: "Reflect" },
  { icon: <InsightIcon />, label: "Insights" },
  { icon: <RhythmIcon />, label: "Rhythms" },
  { icon: <WalletIcon />, label: "Finance" },
];

function WorkspacePreview() {
  return (
    <div
      className="fade-in-delay-2 relative mt-12 px-1 sm:mt-16 sm:px-0 lg:mt-20"
      aria-hidden
    >
      <div
        className="overflow-hidden rounded-lg"
        style={{
          background: "var(--bg-page)",
          boxShadow:
            "0 0 0 1px var(--border-soft), 0 18px 50px -20px rgba(0,0,0,0.18)",
        }}
      >
        <div className="grid min-h-[360px] grid-cols-1 sm:grid-cols-[200px_1fr] sm:min-h-[420px]">
          {/* Sidebar */}
          <aside
            className="hidden sm:flex flex-col p-3"
            style={{
              background: "var(--bg-app)",
              borderRight: "1px solid var(--border-soft)",
            }}
          >
            <p
              className="px-2 pb-3 text-[0.75rem] font-semibold"
              style={{ color: "var(--text)" }}
            >
              Joshua&apos;s workspace
            </p>

            <p
              className="px-2 pb-1 text-[0.625rem] font-medium uppercase tracking-wider"
              style={{ color: "var(--text-faint)" }}
            >
              Workspace
            </p>
            {previewNav.map((item) => (
              <PreviewItem
                key={item.label}
                icon={item.icon}
                label={item.label}
                active={item.active}
              />
            ))}
          </aside>

          {/* Page */}
          <div className="p-4 sm:p-7">
            <p
              className="text-[0.6875rem] font-medium uppercase tracking-wider"
              style={{ color: "var(--text-faint)" }}
            >
              Thursday, May 21
            </p>
            <h3
              className="mt-1 text-xl font-semibold tracking-tight sm:text-2xl"
              style={{ color: "var(--text)" }}
            >
              Good morning, Joshua.
            </h3>

            {/* Callout */}
            <div
              className="mt-5 rounded-xl px-3.5 py-3 sm:flex sm:items-start sm:gap-3 sm:rounded-md"
              style={{
                background: "var(--bg-tint)",
                border: "1px solid var(--border-faint)",
              }}
            >
              <div className="flex items-start gap-3">
                <span
                  className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded"
                  style={{ color: "var(--text-muted)" }}
                >
                  <ConnectionIcon />
                </span>
                <div className="min-w-0">
                  <p
                    className="text-[0.8125rem] font-medium leading-5 sm:leading-normal"
                    style={{ color: "var(--text)" }}
                  >
                    Time x Finance - $34 / hr earned this week
                  </p>
                  <p
                    className="mt-0.5 text-[0.75rem]"
                    style={{ color: "var(--text-muted)" }}
                  >
                    18h 42m logged · $642 in
                  </p>
                </div>
              </div>
              <div
                className="mt-3 grid grid-cols-2 gap-2 sm:mt-0 sm:ml-auto sm:min-w-[148px] sm:grid-cols-1"
                style={{ color: "var(--text-muted)" }}
              >
                <p
                  className="rounded-lg px-2.5 py-2 text-[0.6875rem] font-medium"
                  style={{
                    background: "var(--bg-page)",
                    border: "1px solid var(--border-faint)",
                  }}
                >
                  Hourly read
                </p>
                <p
                  className="rounded-lg px-2.5 py-2 text-[0.6875rem] font-medium"
                  style={{
                    background: "var(--bg-page)",
                    border: "1px solid var(--border-faint)",
                  }}
                >
                  Cross-tool signal
                </p>
              </div>
            </div>

            {/* Mini "database" */}
            <p
              className="mt-6 text-[0.6875rem] font-medium uppercase tracking-wider"
              style={{ color: "var(--text-faint)" }}
            >
              This week
            </p>
            <div className="mt-2 space-y-0">
              <PreviewRow
                title="aucosto polish"
                meta="Time · running"
                value="1h 12m"
                active
              />
              <PreviewRow
                title="Groceries - Costco"
                meta="Finance · cleared"
                value="-$214.30"
              />
              <PreviewRow
                title="Wind-down routine"
                meta="Rhythms · 9:30pm"
                value="done"
              />
              <PreviewRow
                title="Read · 'The Decision Stack'"
                meta="Time · 23m"
                value="-"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Floating "live" pill that connects landing copy to the preview */}
      <div
        className="absolute -top-3 left-4 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 sm:left-8"
        style={{
          background: "var(--bg-page)",
          color: "var(--text-muted)",
          boxShadow: "0 0 0 1px var(--border-soft)",
          fontSize: "0.6875rem",
          fontWeight: 500,
        }}
      >
        <span
          className="ink-pulse inline-block h-1.5 w-1.5 rounded-full"
          style={{ background: "var(--accent)" }}
        />
        Live preview
      </div>
    </div>
  );
}

function PreviewItem({
  icon,
  label,
  active = false,
}: {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
}) {
  return (
    <div
      className="flex items-center gap-2 rounded px-2 py-1 text-[0.8125rem]"
      style={{
        background: active ? "var(--bg-active)" : "transparent",
        color: active ? "var(--text)" : "var(--text-muted)",
        fontWeight: active ? 600 : 500,
      }}
    >
      <span style={{ color: active ? "var(--text)" : "var(--text-faint)" }}>
        {icon}
      </span>
      {label}
    </div>
  );
}

function PreviewRow({
  title,
  meta,
  value,
  active = false,
}: {
  title: string;
  meta: string;
  value: string;
  active?: boolean;
}) {
  return (
    <div
      className="grid grid-cols-[1fr_auto] items-baseline gap-3 py-2"
      style={{ borderTop: "1px solid var(--border-faint)" }}
    >
      <div className="min-w-0">
        <div className="flex items-center gap-1.5">
          {active && (
            <span
              className="inline-block h-1.5 w-1.5 shrink-0 rounded-full"
              style={{ background: "var(--accent)" }}
            />
          )}
          <p
            className="truncate text-[0.8125rem] font-medium"
            style={{ color: "var(--text)" }}
          >
            {title}
          </p>
        </div>
        <p
          className="mt-0.5 text-[0.6875rem]"
          style={{ color: "var(--text-faint)" }}
        >
          {meta}
        </p>
      </div>
      <span
        className="font-mono text-[0.75rem] tabular"
        style={{ color: active ? "var(--accent-strong)" : "var(--text-muted)" }}
      >
        {value}
      </span>
    </div>
  );
}

/* Page */

export default function LandingPage() {
  return (
    <div
      className="flex min-h-screen flex-col"
      style={{ backgroundColor: "var(--bg-app)", color: "var(--text)" }}
    >
      {/* Top bar */}
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-5 sm:px-10 sm:py-6">
        <span
          className="text-[1rem] font-semibold tracking-tight"
          style={{ color: "var(--text)" }}
        >
          aucosto
        </span>
        <Link
          href="/login"
          className="inline-flex items-center gap-1.5 rounded px-2 py-1 text-[0.8125rem] font-medium transition-colors hover:bg-bg-hover"
          style={{ color: "var(--text-muted)" }}
        >
          Sign in
          <ArrowRight />
        </Link>
      </header>

      {/* Hero */}
      <main className="mx-auto flex w-full max-w-5xl flex-col px-6 pb-16 pt-8 sm:px-10 sm:pt-12 sm:pb-24">
        <div className="fade-in max-w-3xl">
          <span
            className="inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-[0.6875rem] font-medium uppercase tracking-wider"
            style={{
              background: "var(--bg-tint)",
              color: "var(--text-muted)",
              border: "1px solid var(--border-faint)",
            }}
          >
            <ConnectionIcon />
            A personal workspace built for one.
          </span>
          <h1
            className="mt-5 text-[2rem] font-semibold leading-[1.05] tracking-[-0.03em] sm:text-[3.25rem] lg:text-[4rem]"
            style={{ color: "var(--text)" }}
          >
            Your whole day,{" "}
            <span style={{ color: "var(--text-muted)" }}>
              in one operating system.
            </span>
          </h1>
          <p
            className="fade-in-delay-1 mt-5 max-w-2xl text-base leading-[1.6] sm:mt-6 sm:text-[1.0625rem]"
            style={{ color: "var(--text-muted)" }}
          >
            Time, tasks, calendar, habits, projects, money, reflection, insights,
            and daily rhythms — nine tools that share one context. No team, no
            tabs, no manual stitching. Just one workspace that understands the
            whole day.
          </p>
          <div className="fade-in-delay-2 mt-7 flex flex-wrap items-center gap-3">
            <Link href="/login" className="btn-ink">
              Open your workspace
              <span className="ml-2">
                <ArrowRight />
              </span>
            </Link>
            <a
              href="#tools"
              className="inline-flex items-center gap-1 px-2 py-1 text-[0.875rem] font-medium transition-colors hover:underline"
              style={{ color: "var(--text-muted)" }}
            >
              See what&apos;s inside
            </a>
            <span
              className="ml-2 inline-flex items-center gap-1.5 text-[0.75rem]"
              style={{ color: "var(--text-faint)" }}
            >
              <span
                className="inline-block h-1.5 w-1.5 rounded-full"
                style={{ background: "var(--accent)" }}
              />
              {tools.length} tools, all live
            </span>
          </div>
        </div>

        <WorkspacePreview />
      </main>

      {/* Tools grid */}
      <section
        id="tools"
        style={{ borderTop: "1px solid var(--border-faint)" }}
      >
        <div className="mx-auto w-full max-w-5xl px-6 py-14 sm:px-10 sm:py-20">
          <div className="mb-10 max-w-2xl">
            <p className="eyebrow mb-3">The tools</p>
            <h2
              className="text-[1.75rem] font-semibold tracking-tight sm:text-[2.25rem]"
              style={{ color: "var(--text)" }}
            >
              Nine tools, shared context.{" "}
              <span style={{ color: "var(--text-muted)" }}>
                Each has its own page, and they still work together.
              </span>
            </h2>
          </div>

          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {tools.map((tool) => (
              <li key={tool.title}>
                <Link
                  href={tool.href}
                  className="group flex h-full flex-col rounded-lg p-5 transition-colors hover:bg-bg-hover"
                  style={{
                    background: "var(--bg-page)",
                    border: "1px solid var(--border-soft)",
                  }}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className="flex h-7 w-7 items-center justify-center rounded"
                      style={{
                        background: "var(--bg-tint)",
                        color: "var(--text)",
                      }}
                    >
                      <tool.Icon />
                    </span>
                    <span
                      className="opacity-0 transition-opacity group-hover:opacity-100"
                      style={{ color: "var(--text-faint)" }}
                    >
                      <ArrowRight />
                    </span>
                  </div>
                  <div className="mt-3 flex items-center gap-2">
                    <p
                      className="text-[0.9375rem] font-semibold tracking-tight"
                      style={{ color: "var(--text)" }}
                    >
                      {tool.title}
                    </p>
                    <span
                      className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[0.625rem] font-medium uppercase tracking-wider"
                      style={{
                        background: "var(--accent-tint)",
                        color: "var(--accent-strong)",
                      }}
                    >
                      <span
                        className="inline-block h-1 w-1 rounded-full"
                        style={{ background: "var(--accent)" }}
                      />
                      Live
                    </span>
                  </div>
                  <p
                    className="mt-1.5 text-[0.8125rem] leading-relaxed sm:text-[0.875rem]"
                    style={{ color: "var(--text-muted)" }}
                  >
                    {tool.body}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* When tools talk */}
      <section style={{ borderTop: "1px solid var(--border-faint)" }}>
        <div className="mx-auto w-full max-w-5xl px-6 py-14 sm:px-10 sm:py-20">
          <div className="mb-10 max-w-2xl">
            <p className="eyebrow mb-3">When tools talk</p>
            <h2
              className="text-[1.75rem] font-semibold tracking-tight sm:text-[2.25rem]"
              style={{ color: "var(--text)" }}
            >
              Most tools refuse to share what they know.{" "}
              <span style={{ color: "var(--text-muted)" }}>
                Aucosto makes that the whole point.
              </span>
            </h2>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {intersections.map((c) => (
              <div
                key={`${c.a}-${c.b}`}
                className="rounded-md p-5"
                style={{
                  background: "var(--bg-page)",
                  border: "1px solid var(--border-soft)",
                }}
              >
                <div className="flex items-center gap-2">
                  <span
                    className="inline-flex items-center rounded px-1.5 py-0.5 text-[0.6875rem] font-medium"
                    style={{
                      background: "var(--bg-tint)",
                      color: "var(--text)",
                    }}
                  >
                    {c.a}
                  </span>
                  <span style={{ color: "var(--text-faint)" }}>
                    <ConnectionIcon />
                  </span>
                  <span
                    className="inline-flex items-center rounded px-1.5 py-0.5 text-[0.6875rem] font-medium"
                    style={{
                      background: "var(--bg-tint)",
                      color: "var(--text)",
                    }}
                  >
                    {c.b}
                  </span>
                </div>
                <p
                  className="mt-3 text-[0.9375rem] leading-relaxed"
                  style={{ color: "var(--text-muted)" }}
                >
                  {c.line}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section style={{ borderTop: "1px solid var(--border-faint)" }}>
        <div className="mx-auto flex w-full max-w-5xl flex-col items-start gap-5 px-6 py-14 sm:flex-row sm:items-center sm:justify-between sm:px-10 sm:py-20">
          <div>
            <h2
              className="text-[1.75rem] font-semibold tracking-tight sm:text-[2.25rem]"
              style={{ color: "var(--text)" }}
            >
              A personal workspace built for one.
              <br />
              <span style={{ color: "var(--text-muted)" }}>
                Designed to understand the whole day.
              </span>
            </h2>
          </div>
          <Link href="/login" className="btn-ink w-full shrink-0 sm:w-auto">
            Sign in
            <span className="ml-2">
              <ArrowRight />
            </span>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer style={{ borderTop: "1px solid var(--border-faint)" }}>
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-5 sm:px-10">
          <p
            className="text-[0.75rem]"
            style={{ color: "var(--text-faint)" }}
          >
            Aucosto · Built for one.
          </p>
          <Link
            href="/login"
            className="text-[0.8125rem] font-medium transition-colors hover:underline"
            style={{ color: "var(--text-muted)" }}
          >
            Sign in
          </Link>
        </div>
      </footer>
    </div>
  );
}
