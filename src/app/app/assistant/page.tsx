// Assistant-facing snapshot: a control panel of raw facts for an external
// assistant to reason about. No prose, no recommendations — just what's true
// right now, derived entirely through buildAssistantSnapshot().

import {
  buildAssistantSnapshot,
  type AssistantSnapshot,
} from "@/lib/assistant-snapshot";
import { resolveActiveUserId } from "@/lib/viewer-context";

export const dynamic = "force-dynamic";

const GREEN = "#10b981";
const AMBER = "#f59e0b";
const RED = "#ef4444";
const NEUTRAL = "#9ca3af";

export default async function AssistantPage() {
  const userId = await resolveActiveUserId();
  const snapshot = await buildAssistantSnapshot(userId);
  return <SnapshotView snapshot={snapshot} />;
}

function SnapshotView({ snapshot }: { snapshot: AssistantSnapshot }) {
  const { meta, now, today, active, recent, flags } = snapshot;
  const longDate = new Date(meta.generatedAt).toLocaleDateString([], {
    weekday: "long",
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: meta.timezone,
  });

  const todayOpenPriorityCount = today.openTasks.filter(
    (task) => task.priority === "today",
  ).length;

  return (
    <div className="space-y-7 font-mono text-[0.8125rem]">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <h1
          className="text-[1rem] font-bold tracking-wide"
          style={{ color: "var(--text)" }}
        >
          ASSISTANT SNAPSHOT
        </h1>
        <span className="text-[0.75rem]" style={{ color: "var(--text-faint)" }}>
          generated at {formatClockFromISO(meta.generatedAt, meta.timezone)}
        </span>
      </header>

      <Section title="Meta">
        <Row label="Date" value={longDate} />
        <Row label="Time" value={`${formatHHMM(meta.currentTimeLocal)}  (${meta.timezone})`} />
        {meta.wakeTime ? (
          <Row label="Woke up" value={formatHHMM(meta.wakeTime)} />
        ) : (
          <Row label="Woke up" value="not logged" faint />
        )}
      </Section>

      <Section title="Now">
        {now.runningTimer ? (
          <Row
            label="Timer"
            value={`${now.runningTimer.title} · ${now.runningTimer.category ?? "uncategorized"} · ${formatMinutes(now.runningTimer.elapsedMinutes)} running`}
          />
        ) : (
          <Row label="Timer" value="none running" faint />
        )}
        {now.nextEvent ? (
          <Row
            label="Next"
            value={`${formatClockFromISO(now.nextEvent.startsAt, meta.timezone)}  ${now.nextEvent.title}  (in ${now.nextEvent.minutesUntil} min, ${formatMinutes(now.nextEvent.durationMinutes)})`}
          />
        ) : (
          <Row label="Next" value="nothing else scheduled today" faint />
        )}
      </Section>

      <Section title="Flags">
        <FlagRow
          label="hasRunningTimer"
          active={flags.hasRunningTimer}
          tone={flags.hasRunningTimer ? GREEN : NEUTRAL}
          detail={flags.hasRunningTimer ? now.runningTimer?.title ?? "" : ""}
        />
        <FlagRow
          label="lateStart"
          active={flags.lateStart}
          tone={flags.lateStart ? AMBER : GREEN}
        />
        <FlagRow
          label="driftRisk"
          active={flags.driftRisk}
          tone={flags.driftRisk ? RED : GREEN}
        />
        <FlagRow
          label="crowdedDay"
          active={flags.crowdedDay}
          tone={flags.crowdedDay ? AMBER : GREEN}
          detail={`${today.calendarItems.length} events`}
        />
        <FlagRow
          label="openDay"
          active={flags.openDay}
          tone={flags.openDay ? AMBER : GREEN}
          detail={`${today.calendarItems.length} events`}
        />
        <FlagRow
          label="momentumDay"
          active={flags.momentumDay}
          tone={flags.momentumDay ? GREEN : NEUTRAL}
          detail={`${formatMinutes(today.totalTrackedMinutes)} of 4h target`}
        />
        <FlagRow
          label="unfinishedPriority"
          active={flags.unfinishedPriority}
          tone={flags.unfinishedPriority ? RED : GREEN}
          detail={todayOpenPriorityCount > 0 ? `${todayOpenPriorityCount} in today lane` : ""}
        />
        <FlagRow
          label="habitRecovery"
          active={flags.habitRecoveryNeeded}
          tone={flags.habitRecoveryNeeded ? RED : GREEN}
        />
        <FlagRow
          label="financeNeedsAttention"
          active={flags.financeNeedsAttention}
          tone={flags.financeNeedsAttention ? AMBER : NEUTRAL}
          detail="deferred"
        />
      </Section>

      <Section title="Today">
        <div className="space-y-4">
          <div>
            <SubHeader
              label="Calendar"
              value={`${today.calendarItems.length} items  /  ${formatMinutes(today.totalScheduledMinutes)} scheduled`}
            />
            {today.calendarItems.length === 0 ? (
              <EmptyLine text="nothing scheduled" />
            ) : (
              <div className="mt-1 space-y-0.5">
                {today.calendarItems.map((item, index) => (
                  <div
                    key={`${item.title}-${index}`}
                    className="grid grid-cols-[4.5rem_1fr_4rem_3.5rem] items-center gap-2"
                  >
                    <span style={{ color: "var(--text-faint)" }}>
                      {formatHHMM(item.startTime)}
                    </span>
                    <span
                      className="truncate"
                      style={{ color: "var(--text)" }}
                    >
                      {item.title}
                    </span>
                    <span style={{ color: "var(--text-faint)" }}>
                      {formatMinutes(item.durationMinutes)}
                    </span>
                    <span style={{ color: "var(--text-faint)" }}>
                      {item.done ? "[done]" : ""}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <SubHeader
              label="Tracked"
              value={`${formatMinutes(today.totalTrackedMinutes)} (today)`}
            />
            {today.timeEntries.length === 0 && !now.runningTimer ? (
              <EmptyLine text="nothing tracked yet" />
            ) : (
              <div className="mt-1 space-y-0.5">
                {today.timeEntries.map((entry, index) => (
                  <div
                    key={`${entry.title}-${index}`}
                    className="grid grid-cols-[9rem_1fr_6rem_4rem] items-center gap-2"
                  >
                    <span style={{ color: "var(--text-faint)" }}>
                      {formatClockFromISO(entry.startedAt, meta.timezone)}–
                      {formatClockFromISO(entry.endedAt, meta.timezone)}
                    </span>
                    <span style={{ color: "var(--text)" }}>{entry.title}</span>
                    <span style={{ color: "var(--text-faint)" }}>
                      {entry.category ?? ""}
                    </span>
                    <span style={{ color: "var(--text-faint)" }}>
                      {formatMinutes(entry.durationMinutes)}
                    </span>
                  </div>
                ))}
                {now.runningTimer ? (
                  <div className="grid grid-cols-[9rem_1fr_6rem_4rem] items-center gap-2">
                    <span style={{ color: "var(--text-faint)" }}>
                      {formatClockFromISO(now.runningTimer.startedAt, meta.timezone)}→
                    </span>
                    <span style={{ color: "var(--text)" }}>
                      {now.runningTimer.title}
                    </span>
                    <span style={{ color: "var(--text-faint)" }}>
                      {now.runningTimer.category ?? ""}
                    </span>
                    <span style={{ color: GREEN }}>running</span>
                  </div>
                ) : null}
              </div>
            )}
          </div>

          <div>
            <SubHeader
              label="Tasks"
              value={`${today.openTasks.length} open / ${today.completedTasksCount} completed today`}
            />
            {today.openTasks.length === 0 ? (
              <EmptyLine text="no open tasks" />
            ) : (
              <div className="mt-1 space-y-0.5">
                {today.openTasks.map((task, index) => (
                  <div
                    key={`${task.title}-${index}`}
                    className="grid grid-cols-[5rem_1fr_8rem] items-center gap-2"
                  >
                    <span style={{ color: "var(--text-faint)" }}>
                      {task.priority ? `[${task.priority}]` : ""}
                    </span>
                    <span style={{ color: "var(--text)" }}>{task.title}</span>
                    <span
                      className="truncate"
                      style={{ color: "var(--text-faint)" }}
                    >
                      {task.projectName ?? ""}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <SubHeader
              label="Habits"
              value={`${today.habitsCompleted} of ${today.habitsTotal} done`}
            />
            <div className="mt-1 space-y-0.5">
              {today.habits.map((habit, index) => (
                <div
                  key={`${habit.name}-${index}`}
                  className="grid grid-cols-[1.25rem_1fr_5rem_5rem] items-center gap-2"
                >
                  <span style={{ color: habit.done ? GREEN : "var(--text-faint)" }}>
                    {habit.done ? "✓" : "○"}
                  </span>
                  <span style={{ color: "var(--text)" }}>{habit.name}</span>
                  <span style={{ color: "var(--text-faint)" }}>
                    streak {habit.streak}
                  </span>
                  <span style={{ color: "var(--text-faint)" }}>
                    {habit.bucket}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Section>

      <Section title="Active projects">
        {active.projects.length === 0 ? (
          <EmptyLine text="no active projects" />
        ) : (
          <div className="space-y-0.5">
            {active.projects.map((project, index) => (
              <div
                key={`${project.name}-${index}`}
                className="grid grid-cols-[1fr_6rem_6rem_8rem_5rem] items-center gap-2"
              >
                <span style={{ color: "var(--text)" }}>{project.name}</span>
                <span style={{ color: "var(--text-faint)" }}>{project.status}</span>
                <span style={{ color: momentumColor(project.momentum) }}>
                  {project.momentum}
                </span>
                <span style={{ color: "var(--text-faint)" }}>
                  {project.lastWorkedDaysAgo === null
                    ? "never worked"
                    : project.lastWorkedDaysAgo === 0
                      ? "worked today"
                      : `${project.lastWorkedDaysAgo}d ago`}
                </span>
                <span style={{ color: "var(--text-faint)" }}>
                  {project.openTaskCount} open
                </span>
              </div>
            ))}
          </div>
        )}
      </Section>

      <Section title="Recent">
        <div className="space-y-4">
          <div>
            <SubHeader label="Yesterday" value="" />
            <div className="mt-1 space-y-0.5">
              <Row label="Tracked" value={formatMinutes(recent.yesterday.trackedMinutes)} indent />
              <Row label="Tasks" value={`${recent.yesterday.completedTasks} completed`} indent />
              <Row
                label="Habits"
                value={`${recent.yesterday.habitsCompleted} of ${recent.yesterday.habitsTotal}${
                  recent.yesterday.reflection?.mood
                    ? `  mood ${recent.yesterday.reflection.mood}/5`
                    : ""
                }${
                  recent.yesterday.reflection?.note
                    ? `  "${recent.yesterday.reflection.note}"`
                    : ""
                }`}
                indent
              />
            </div>
          </div>

          <div>
            <SubHeader label="Last 7 days" value="" />
            <div className="mt-1 space-y-0.5">
              <Row
                label="Tracked"
                value={`${formatMinutes(recent.last7Days.trackedMinutes)}  avg ${formatMinutes(recent.last7Days.avgDailyMinutes)}/day`}
                indent
              />
              <Row
                label="Habits"
                value={
                  recent.last7Days.habitsConsistency.length === 0
                    ? "—"
                    : recent.last7Days.habitsConsistency
                        .map((h) => `${h.name} ${h.doneCount}/${h.scheduledCount}`)
                        .join("  ")
                }
                indent
              />
            </div>
          </div>

          <div>
            <SubHeader label="Recent events" value="" />
            {recent.recentEvents.length === 0 ? (
              <EmptyLine text="none" />
            ) : (
              <div className="mt-1 space-y-0.5">
                {recent.recentEvents.map((event, index) => (
                  <div
                    key={`${event.label}-${index}`}
                    className="grid grid-cols-[6rem_1fr] items-center gap-2"
                  >
                    <span style={{ color: "var(--text-faint)" }}>
                      {formatClockFromISO(event.at, meta.timezone)}
                    </span>
                    <span style={{ color: "var(--text)" }}>
                      {event.tool}.{event.label}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <div className="mb-2 flex items-center gap-2">
        <span
          className="text-[0.6875rem] font-semibold uppercase tracking-wider"
          style={{ color: "var(--text-faint)" }}
        >
          {title}
        </span>
        <span className="h-px flex-1" style={{ background: "var(--border-faint)" }} />
      </div>
      {children}
    </section>
  );
}

function SubHeader({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline gap-2">
      <span
        className="w-20 shrink-0 text-[0.75rem] font-semibold"
        style={{ color: "var(--text)" }}
      >
        {label}
      </span>
      <span style={{ color: "var(--text-faint)" }}>{value}</span>
    </div>
  );
}

function Row({
  label,
  value,
  faint,
  indent,
}: {
  label: string;
  value: string;
  faint?: boolean;
  indent?: boolean;
}) {
  return (
    <div className={`flex items-baseline gap-2 ${indent ? "pl-2" : ""}`}>
      <span
        className="w-20 shrink-0 text-[0.75rem]"
        style={{ color: "var(--text-faint)" }}
      >
        {label}
      </span>
      <span style={{ color: faint ? "var(--text-faint)" : "var(--text)" }}>
        {value}
      </span>
    </div>
  );
}

function FlagRow({
  label,
  active,
  tone,
  detail,
}: {
  label: string;
  active: boolean;
  tone: string;
  detail?: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <span
        className="inline-block h-2 w-2 shrink-0 rounded-full"
        style={{ background: tone }}
        aria-hidden
      />
      <span className="w-44 shrink-0" style={{ color: "var(--text)" }}>
        {label}
      </span>
      <span style={{ color: "var(--text-faint)" }}>{active ? "yes" : "no"}</span>
      {detail ? (
        <span style={{ color: "var(--text-faint)" }}>· {detail}</span>
      ) : null}
    </div>
  );
}

function EmptyLine({ text }: { text: string }) {
  return (
    <p className="text-[0.8125rem]" style={{ color: "var(--text-faint)" }}>
      {text}
    </p>
  );
}

function momentumColor(momentum: "strong" | "slowing" | "stalled" | "none"): string {
  switch (momentum) {
    case "strong":
      return GREEN;
    case "slowing":
      return AMBER;
    case "stalled":
      return RED;
    default:
      return NEUTRAL;
  }
}

/** "HH:MM" (24h) -> "h:mm AM/PM". */
function formatHHMM(value: string): string {
  const [hStr, mStr] = value.split(":");
  const h = Number(hStr);
  const m = Number(mStr);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return value;
  const period = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${period}`;
}

function formatClockFromISO(iso: string, timezone: string): string {
  return new Date(iso).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
    timeZone: timezone,
  });
}

function formatMinutes(minutes: number): string {
  const value = Math.max(0, Math.round(minutes));
  if (value === 0) return "0m";
  const h = Math.floor(value / 60);
  const m = value % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}
