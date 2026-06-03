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

function HomeIcon() {
  return (
    <svg {...iconProps}>
      <path d="M2 6.5 7.5 2l5.5 4.5V13H2V6.5Z" />
      <path d="M6 13V9h3v4" />
    </svg>
  );
}
function CalendarIcon() {
  return (
    <svg {...iconProps}>
      <rect x="2" y="3" width="11" height="10" rx="1.5" />
      <path d="M2 6h11M5 1.75v2.5M10 1.75v2.5" />
    </svg>
  );
}
function ClockIcon() {
  return (
    <svg {...iconProps}>
      <circle cx="7.5" cy="7.5" r="5.5" />
      <path d="M7.5 4.5V7.5l2 1.25" />
    </svg>
  );
}
function WalletIcon() {
  return (
    <svg {...iconProps}>
      <path d="M2 5.5C2 4.67 2.67 4 3.5 4H12a1 1 0 0 1 1 1v6.5c0 .83-.67 1.5-1.5 1.5h-8A1.5 1.5 0 0 1 2 11.5V5.5Z" />
      <path d="M10 8.25h2.5" />
    </svg>
  );
}
function PlateIcon() {
  return (
    <svg {...iconProps}>
      <circle cx="7.5" cy="7.5" r="5.5" />
      <circle cx="7.5" cy="7.5" r="2.5" />
    </svg>
  );
}
function ListIcon() {
  return (
    <svg {...iconProps}>
      <path d="M5 4h8M5 7.5h8M5 11h5" />
      <circle cx="2.5" cy="4" r="0.6" fill="currentColor" />
      <circle cx="2.5" cy="7.5" r="0.6" fill="currentColor" />
      <circle cx="2.5" cy="11" r="0.6" fill="currentColor" />
    </svg>
  );
}
function PulseIcon() {
  return (
    <svg {...iconProps}>
      <path d="M1.5 8h2.25l1.5-4 2 8 1.75-4h4.5" />
    </svg>
  );
}
function ProjectsIcon() {
  return (
    <svg {...iconProps}>
      <rect x="2" y="3" width="11" height="3" rx="0.75" />
      <rect x="2" y="8.5" width="7.5" height="3" rx="0.75" />
    </svg>
  );
}
function SignalIcon() {
  return (
    <svg {...iconProps}>
      <path d="M2 11h11M3.5 11V8M6 11V6M8.5 11V4M11 11V2" />
    </svg>
  );
}
function ArrowRight() {
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
function ConnectionIcon() {
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

type ToolStatus = "live" | "soon";
type Tool = {
  title: string;
  body: string;
  status: ToolStatus;
  Icon: () => React.ReactElement;
  href?: string;
};

const tools: Tool[] = [
  {
    title: "Today",
    body: "See what is running, what needs attention, and what is next.",
    status: "live",
    Icon: HomeIcon,
    href: "/app",
  },
  {
    title: "Calendar",
    body: "Fixed commitments and intentional blocks. Shape the week before it happens to you.",
    status: "live",
    Icon: CalendarIcon,
    href: "/app/calendar",
  },
  {
    title: "Do List",
    body: "Capture tasks, bucket them by area, and see estimates collide with reality.",
    status: "live",
    Icon: ListIcon,
    href: "/app/do",
  },
  {
    title: "Time",
    body: "Start a session when you begin, then close it when you switch tasks.",
    status: "live",
    Icon: ClockIcon,
    href: "/app/time",
  },
  {
    title: "Finance",
    body: "True spend separated from transfers. Net worth, monthly pace, the category pulling hardest.",
    status: "live",
    Icon: WalletIcon,
    href: "/app/finance",
  },
  {
    title: "Calories",
    body: "Log meals, track macros, and spot patterns across the week.",
    status: "soon",
    Icon: PlateIcon,
  },
  {
    title: "Meal planning",
    body: "Plan ahead. Grocery lists generate themselves. Nothing falls through the fridge gap.",
    status: "soon",
    Icon: ListIcon,
  },
  {
    title: "Fitness",
    body: "Track workouts, lifts, and runs in one place.",
    status: "soon",
    Icon: PulseIcon,
  },
  {
    title: "Projects",
    body: "Outcomes, milestones, and linked Do items. Plan the work without turning it into office cosplay.",
    status: "live",
    Icon: ProjectsIcon,
    href: "/app/projects",
  },
  {
    title: "Signals",
    body: "Bring sleep, temperature, and activity into one stream.",
    status: "soon",
    Icon: SignalIcon,
  },
];

const intersections: Array<{ a: string; b: string; line: string }> = [
  {
    a: "Time",
    b: "Finance",
    line: "See earnings next to logged hours without doing the math yourself.",
  },
  {
    a: "Calendar",
    b: "Time",
    line: "Open gaps and unfilled blocks become focus suggestions, not guilt.",
  },
  {
    a: "Finance",
    b: "Meals",
    line: "Compare meal plans with what you actually bought.",
  },
  {
    a: "Fitness",
    b: "Signals",
    line: "View sleep and intake together in one place.",
  },
];

/* Stylized workspace preview: sidebar + a page */

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
            <PreviewItem icon={<HomeIcon />} label="Today" active />
            <PreviewItem icon={<CalendarIcon />} label="Calendar" />
            <PreviewItem icon={<ListIcon />} label="Do List" />
            <PreviewItem icon={<ProjectsIcon />} label="Projects" />
            <PreviewItem icon={<ClockIcon />} label="Time" />
            <PreviewItem icon={<WalletIcon />} label="Finance" />

            <p
              className="mt-4 px-2 pb-1 text-[0.625rem] font-medium uppercase tracking-wider"
              style={{ color: "var(--text-faint)" }}
            >
              Coming soon
            </p>
            <PreviewItem icon={<PlateIcon />} label="Calories" muted />
            <PreviewItem icon={<PulseIcon />} label="Fitness" muted />
            <PreviewItem icon={<ProjectsIcon />} label="Projects" muted />
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
                title="Long run · East River"
                meta="Calendar · 7:00am"
                value="10 km"
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
  muted = false,
}: {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  muted?: boolean;
}) {
  return (
    <div
      className="flex items-center gap-2 rounded px-2 py-1 text-[0.8125rem]"
      style={{
        background: active ? "var(--bg-active)" : "transparent",
        color: muted
          ? "var(--text-faint)"
          : active
            ? "var(--text)"
            : "var(--text-muted)",
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
  const liveCount = tools.filter((t) => t.status === "live").length;

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
            Personal workspace
          </span>
          <h1
            className="mt-5 text-[2rem] font-semibold leading-[1.05] tracking-[-0.03em] sm:text-[3.25rem] lg:text-[4rem]"
            style={{ color: "var(--text)" }}
          >
            All your tools, in one place{" "}
            <span style={{ color: "var(--text-muted)" }}>
              so they work together.
            </span>
          </h1>
          <p
            className="fade-in-delay-1 mt-5 max-w-2xl text-base leading-[1.6] sm:mt-6 sm:text-[1.0625rem]"
            style={{ color: "var(--text-muted)" }}
          >
            Aucosto brings calendar, do, projects, time, and money into one
            workspace. The goal is fewer tabs, clearer context, and less manual
            stitching between planning and real life.
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
              {liveCount} live · {tools.length - liveCount} coming soon
            </span>
          </div>
        </div>

        <WorkspacePreview />
      </main>

      {/* Tools / page tree */}
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
              Separate tools, shared context.{" "}
              <span style={{ color: "var(--text-muted)" }}>
                Each tool has its own page, and they still work together.
              </span>
            </h2>
          </div>

          <ul
            className="rounded-lg overflow-hidden"
            style={{
              background: "var(--bg-page)",
              border: "1px solid var(--border-soft)",
            }}
          >
            {tools.map((tool, i) => {
              const Inner = (
                <div
                  className="group grid grid-cols-[28px_1fr_auto] items-start gap-3 px-4 py-3 transition-colors sm:gap-4 sm:px-5 sm:py-4"
                  style={{
                    borderTop:
                      i === 0 ? "none" : "1px solid var(--border-faint)",
                  }}
                >
                  <span
                    className="mt-0.5 flex h-6 w-6 items-center justify-center rounded"
                    style={{
                      background:
                        tool.status === "live"
                          ? "var(--bg-tint)"
                          : "transparent",
                      color:
                        tool.status === "live"
                          ? "var(--text)"
                          : "var(--text-faint)",
                    }}
                  >
                    <tool.Icon />
                  </span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p
                        className="text-[0.9375rem] font-semibold tracking-tight"
                        style={{
                          color:
                            tool.status === "live"
                              ? "var(--text)"
                              : "var(--text-muted)",
                        }}
                      >
                        {tool.title}
                      </p>
                      {tool.status === "live" ? (
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
                      ) : (
                        <span
                          className="inline-flex items-center rounded px-1.5 py-0.5 text-[0.625rem] font-medium uppercase tracking-wider"
                          style={{
                            background: "var(--bg-tint)",
                            color: "var(--text-faint)",
                          }}
                        >
                          Soon
                        </span>
                      )}
                    </div>
                    <p
                      className="mt-1 text-[0.8125rem] leading-relaxed sm:text-[0.875rem]"
                      style={{ color: "var(--text-muted)" }}
                    >
                      {tool.body}
                    </p>
                  </div>
                  {tool.href && (
                    <span
                      className="self-center opacity-0 transition-opacity group-hover:opacity-100"
                      style={{ color: "var(--text-faint)" }}
                    >
                      <ArrowRight />
                    </span>
                  )}
                </div>
              );

              return (
                <li key={tool.title}>
                  {tool.href ? (
                    <Link href={tool.href} className="block hover:bg-bg-hover">
                      {Inner}
                    </Link>
                  ) : (
                    Inner
                  )}
                </li>
              );
            })}
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
              Built for one person.
              <br />
              <span style={{ color: "var(--text-muted)" }}>
                Designed to understand all of them.
              </span>
            </h2>
          </div>
          <Link href="/login" className="btn-ink w-full shrink-0 sm:w-auto">
            Open your workspace
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



