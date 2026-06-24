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
  const { facts, signals, briefing, user, generatedAt } = snapshot;
  const longDate = new Date(generatedAt).toLocaleDateString([], {
    weekday: "long",
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: user.timezone,
  });

  const todayOpenPriorityCount = facts.today.tasks.open.filter(
    (task) => task.lane === "today",
  ).length;

  return (
    <div className="space-y-7 font-mono text-[0.8125rem]">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="flex items-baseline gap-3">
          <h1
            className="text-[1rem] font-bold tracking-wide"
            style={{ color: "var(--text)" }}
          >
            ASSISTANT SNAPSHOT
          </h1>
          <a
            href="/api/assistant/snapshot"
            className="text-[0.75rem] hover:underline"
            style={{ color: "var(--text-faint)" }}
          >
            [JSON]
          </a>
        </div>
        <span className="text-[0.75rem]" style={{ color: "var(--text-faint)" }}>
          generated at {formatClockFromISO(generatedAt, user.timezone)}
        </span>
      </header>

      {/* ━━ BRIEFING ━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <Section title="Briefing">
        <div className="space-y-3">
          <div className="space-y-1">
            <Row label="State" value={briefing.currentState} />
            <Row label="Tone" value={briefing.morningMessageInputs.tone} />
            <Row label="Drift risk" value={signals.driftRisk} />
          </div>

          {briefing.topSignals.length > 0 && (
            <Row label="Top signals" value={briefing.topSignals.join(" · ")} />
          )}

          {briefing.suggestedFocus.length > 0 && (
            <div>
              <SubHeader label="Suggested focus" value="" />
              <div className="mt-1 space-y-0.5 pl-2">
                {briefing.suggestedFocus.map((item, i) => (
                  <div key={i} style={{ color: "var(--text)" }}>
                    → {item}
                  </div>
                ))}
              </div>
            </div>
          )}

          {briefing.watchouts.length > 0 && (
            <div>
              <SubHeader label="Watchouts" value="" />
              <div className="mt-1 space-y-0.5 pl-2">
                {briefing.watchouts.map((item, i) => (
                  <div key={i} style={{ color: AMBER }}>
                    ⚠ {item}
                  </div>
                ))}
              </div>
            </div>
          )}

          {briefing.contextNotes.length > 0 && (
            <div>
              <SubHeader label="Context" value="" />
              <div className="mt-1 space-y-0.5 pl-2">
                {briefing.contextNotes.map((note, i) => (
                  <div key={i} style={{ color: "var(--text-faint)" }}>
                    · {note}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div>
            <SubHeader label="Morning inputs" value="" />
            <div className="mt-1 space-y-0.5">
              <Row
                label="Priority seeds"
                value={`[${briefing.morningMessageInputs.prioritySeedLabels.join(", ")}]`}
                indent
              />
              <Row
                label="Reminder seeds"
                value={`[${briefing.morningMessageInputs.reminderSeeds.join(", ")}]`}
                indent
              />
              <Row
                label="Journal prompt"
                value={`"${briefing.morningMessageInputs.journalPromptSeed}"`}
                indent
              />
            </div>
          </div>
        </div>
      </Section>

      <Section title="Meta">
        <Row label="Date" value={longDate} />
        <Row label="Time" value={`${formatHHMM(facts.today.localTime)}  (${user.timezone})`} />
        {facts.today.wokeUpAt ? (
          <Row label="Woke up" value={formatHHMM(facts.today.wokeUpAt)} />
        ) : (
          <Row label="Woke up" value="not logged" faint />
        )}
      </Section>

      <Section title="Now">
        {facts.today.time.runningTimer ? (
          <Row
            label="Timer"
            value={`${facts.today.time.runningTimer.title} · ${facts.today.time.runningTimer.category ?? "uncategorized"} · ${formatMinutes(facts.today.time.runningTimer.elapsedMinutes)} running`}
          />
        ) : (
          <Row label="Timer" value="none running" faint />
        )}
        {facts.today.calendar.nextEvent ? (
          <Row
            label="Next"
            value={`${formatClockFromISO(facts.today.calendar.nextEvent.startsAt, user.timezone)}  ${facts.today.calendar.nextEvent.title}  (in ${facts.today.calendar.nextEvent.minutesUntil} min, ${formatMinutes(facts.today.calendar.nextEvent.durationMinutes)})`}
          />
        ) : (
          <Row label="Next" value="nothing else scheduled today" faint />
        )}
      </Section>

      <Section title="Signals">
        <FlagRow
          label="hasRunningTimer"
          active={signals.hasRunningTimer}
          tone={signals.hasRunningTimer ? GREEN : NEUTRAL}
          detail={signals.hasRunningTimer ? facts.today.time.runningTimer?.title ?? "" : ""}
        />
        <FlagRow
          label="lateStart"
          active={signals.lateStart}
          tone={signals.lateStart ? AMBER : GREEN}
        />
        <FlagRow
          label="driftRisk"
          active={signals.driftRisk !== "low"}
          tone={
            signals.driftRisk === "high"
              ? RED
              : signals.driftRisk === "medium"
                ? AMBER
                : GREEN
          }
          detail={signals.driftRisk}
        />
        <FlagRow
          label="crowdedDay"
          active={signals.crowdedDay}
          tone={signals.crowdedDay ? AMBER : GREEN}
          detail={`${facts.today.calendar.totalScheduledMinutes}min scheduled`}
        />
        <FlagRow
          label="openDay"
          active={signals.openDay}
          tone={signals.openDay ? AMBER : GREEN}
          detail={`${facts.today.calendar.items.length} events`}
        />
        <FlagRow
          label="momentum"
          active={signals.momentum === "good"}
          tone={
            signals.momentum === "good"
              ? GREEN
              : signals.momentum === "medium"
                ? AMBER
                : NEUTRAL
          }
          detail={`${formatMinutes(facts.today.time.totalTrackedMinutes)} · ${signals.momentum}`}
        />
        <FlagRow
          label="unfinishedPriority"
          active={signals.unfinishedPriority}
          tone={signals.unfinishedPriority ? RED : GREEN}
          detail={todayOpenPriorityCount > 0 ? `${todayOpenPriorityCount} in today lane` : ""}
        />
        <FlagRow
          label="habitRecovery"
          active={signals.habitRecovery}
          tone={signals.habitRecovery ? RED : GREEN}
        />
        <FlagRow
          label="financeNeedsAttention"
          active={signals.financeNeedsAttention}
          tone={signals.financeNeedsAttention ? AMBER : NEUTRAL}
          detail="deferred"
        />
      </Section>

      <Section title="Today">
        <div className="space-y-4">
          <div>
            <SubHeader
              label="Calendar"
              value={`${facts.today.calendar.items.length} items  /  ${formatMinutes(facts.today.calendar.totalScheduledMinutes)} scheduled`}
            />
            {facts.today.calendar.items.length === 0 ? (
              <EmptyLine text="nothing scheduled" />
            ) : (
              <div className="mt-1 space-y-0.5">
                {facts.today.calendar.items.map((item, index) => (
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
              value={`${formatMinutes(facts.today.time.totalTrackedMinutes)} (today)`}
            />
            {facts.today.time.entries.length === 0 && !facts.today.time.runningTimer ? (
              <EmptyLine text="nothing tracked yet" />
            ) : (
              <div className="mt-1 space-y-0.5">
                {facts.today.time.entries.map((entry, index) => (
                  <div
                    key={`${entry.title}-${index}`}
                    className="grid grid-cols-[9rem_1fr_6rem_4rem] items-center gap-2"
                  >
                    <span style={{ color: "var(--text-faint)" }}>
                      {formatClockFromISO(entry.startedAt, user.timezone)}–
                      {formatClockFromISO(entry.endedAt, user.timezone)}
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
                {facts.today.time.runningTimer ? (
                  <div className="grid grid-cols-[9rem_1fr_6rem_4rem] items-center gap-2">
                    <span style={{ color: "var(--text-faint)" }}>
                      {formatClockFromISO(facts.today.time.runningTimer.startedAt, user.timezone)}→
                    </span>
                    <span style={{ color: "var(--text)" }}>
                      {facts.today.time.runningTimer.title}
                    </span>
                    <span style={{ color: "var(--text-faint)" }}>
                      {facts.today.time.runningTimer.category ?? ""}
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
              value={`${facts.today.tasks.open.length} open / ${facts.today.tasks.completedCount} completed today`}
            />
            {facts.today.tasks.open.length === 0 ? (
              <EmptyLine text="no open tasks" />
            ) : (
              <div className="mt-1 space-y-0.5">
                {facts.today.tasks.open.map((task, index) => (
                  <div
                    key={`${task.title}-${index}`}
                    className="grid grid-cols-[5rem_1fr_8rem] items-center gap-2"
                  >
                    <span style={{ color: "var(--text-faint)" }}>
                      {task.lane ? `[${task.lane}]` : ""}
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
              value={`${facts.today.habits.completedCount} of ${facts.today.habits.totalCount} done`}
            />
            <div className="mt-1 space-y-0.5">
              {facts.today.habits.items.map((habit, index) => (
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
        {facts.today.projects.length === 0 ? (
          <EmptyLine text="no active projects" />
        ) : (
          <div className="space-y-0.5">
            {facts.today.projects.map((project, index) => (
              <div
                key={`${project.name}-${index}`}
                className="grid grid-cols-[1fr_6rem_8rem_5rem] items-center gap-2"
              >
                <span style={{ color: "var(--text)" }}>{project.name}</span>
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
              <Row label="Tracked" value={formatMinutes(facts.yesterday.trackedMinutes)} indent />
              <Row label="Tasks" value={`${facts.yesterday.completedTasks} completed`} indent />
              <Row
                label="Habits"
                value={`${facts.yesterday.habitsCompleted} of ${facts.yesterday.habitsTotal}${
                  facts.yesterday.reflection?.mood
                    ? `  mood ${facts.yesterday.reflection.mood}/5`
                    : ""
                }${
                  facts.yesterday.reflection?.note
                    ? `  "${facts.yesterday.reflection.note}"`
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
                value={`${formatMinutes(facts.week.totalTrackedMinutes)}  avg ${formatMinutes(facts.week.avgDailyMinutes)}/day`}
                indent
              />
              <Row
                label="Habits"
                value={
                  facts.week.habitConsistency.length === 0
                    ? "—"
                    : facts.week.habitConsistency
                        .map((h) => `${h.name} ${h.doneCount}/${h.scheduledCount}`)
                        .join("  ")
                }
                indent
              />
            </div>
          </div>

          <div>
            <SubHeader label="Recent events" value="" />
            {facts.today.recentEvents.length === 0 ? (
              <EmptyLine text="none" />
            ) : (
              <div className="mt-1 space-y-0.5">
                {facts.today.recentEvents.map((event, index) => (
                  <div
                    key={`${event.label}-${index}`}
                    className="grid grid-cols-[6rem_1fr] items-center gap-2"
                  >
                    <span style={{ color: "var(--text-faint)" }}>
                      {formatClockFromISO(event.at, user.timezone)}
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
