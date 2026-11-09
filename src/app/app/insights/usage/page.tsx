import Link from "next/link";
import { redirect } from "next/navigation";
import {
  QUIET_AFTER_DAYS,
  USAGE_GOAL_DAYS,
  buildUsageReport,
  usageHeadline,
  usageWindowStart,
  weekLabel,
  type UsageAreaRow,
  type UsageCounts,
  type UsageDay,
  type UsageReport,
} from "@/lib/insights";
import { householdMemberNames } from "@/lib/household";
import { PARTNER_HOME_PATH } from "@/lib/household-access";
import { listExecutedAuditTimes } from "@/lib/services/assistant-audit";
import { listUsageEvents } from "@/lib/services/events";
import { requireViewerContext } from "@/lib/viewer-context";
import { EmptyNote, SectionCard } from "../_components/charts";

export const dynamic = "force-dynamic";

const YOU = "var(--series-you)";
const PARTNER = "var(--series-partner)";
const AGENT = "var(--text-faint)";

const WEEKDAYS = ["M", "T", "W", "T", "F", "S", "S"];

/** Opacity step for a count: one hue, light to dark (never a second colour). */
function intensity(count: number): number {
  if (count >= 6) return 1;
  if (count >= 3) return 0.7;
  return 0.4;
}

function plural(count: number, one: string, many = `${one}s`): string {
  return `${count} ${count === 1 ? one : many}`;
}

function agoLabel(at: Date | null, now: Date): string {
  if (!at) return "Never";
  const days = Math.floor(
    (new Date(now).setHours(0, 0, 0, 0) - new Date(at).setHours(0, 0, 0, 0)) / 86_400_000,
  );
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 14) return `${days} days ago`;
  return at.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export default async function UsagePage() {
  const context = await requireViewerContext();
  // Owner-only: the numbers cover personal tools a partner never sees.
  if (context.role !== "owner") redirect(PARTNER_HOME_PATH);

  const now = new Date();
  const from = usageWindowStart(now);
  const viewerUserId = context.effectiveUserId;
  const household =
    context.householdUserId && !context.isDemoMode ? context.householdUserId : null;
  const owners = household ? [viewerUserId, household] : [viewerUserId];

  const [events, auditTimes, memberNames] = await Promise.all([
    listUsageEvents(owners, from, now),
    listExecutedAuditTimes(viewerUserId, from),
    context.householdId && household
      ? householdMemberNames(context.householdId).catch(() => ({}) as Record<string, string>)
      : Promise.resolve({} as Record<string, string>),
  ]);

  const partnerEntry = Object.entries(memberNames).find(
    ([userId]) => userId !== context.ownerUserId,
  );
  const partnerName = partnerEntry?.[1]?.split(" ")[0] ?? "Partner";
  const hasPartner = Boolean(household);

  const report = buildUsageReport(events, {
    now,
    viewerUserId,
    agentActionTimes: auditTimes.map((time) => time.getTime()),
    hasPartner,
  });

  const activeAreas = report.areas
    .filter((area) => area.totals.you + area.totals.partner + area.totals.agent > 0)
    .sort(
      (a, b) =>
        b.totals.you + b.totals.partner - (a.totals.you + a.totals.partner) ||
        b.totals.agent - a.totals.agent,
    );
  const quietAreas = report.areas.filter((area) => area.quiet);
  const anyActivity = activeAreas.length > 0;

  return (
    <div className="space-y-6">
      <header className="fade-in">
        <Link
          href="/app/insights"
          className="text-[0.75rem] font-medium uppercase tracking-wider"
          style={{ color: "var(--text-faint)" }}
        >
          ← Insights
        </Link>
        <h1
          className="mt-1 text-[1.5rem] font-bold tracking-tight sm:text-[1.875rem]"
          style={{ color: "var(--text)", letterSpacing: "-0.025em" }}
        >
          Usage
        </h1>
        <p
          className="mt-2 max-w-[38rem] text-[0.95rem] leading-[1.5]"
          style={{ color: "var(--text-muted)" }}
        >
          {usageHeadline(report)}
        </p>
      </header>

      <section className="fade-in-delay-1 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile
          label="Last 7 days"
          value={`${report.goal.last7}`}
          unit="of 7 days"
          note={
            report.goal.last7 >= USAGE_GOAL_DAYS
              ? `Goal of ${USAGE_GOAL_DAYS} reached`
              : `Goal is ${USAGE_GOAL_DAYS}`
          }
          good={report.goal.last7 >= USAGE_GOAL_DAYS}
        />
        <StatTile
          label="7 days before"
          value={`${report.goal.prior7}`}
          unit="of 7 days"
          note={
            report.goal.met
              ? "Two weeks running"
              : report.goal.prior7 >= USAGE_GOAL_DAYS
                ? `Goal of ${USAGE_GOAL_DAYS} reached`
                : `Goal is ${USAGE_GOAL_DAYS}`
          }
          good={report.goal.prior7 >= USAGE_GOAL_DAYS}
        />
        <StatTile
          label="Streak"
          value={`${report.streak}`}
          unit={report.streak === 1 ? "day" : "days"}
          note="Days in a row"
        />
        <StatTile
          label="Your last entry"
          value={agoLabel(report.lastYouAt, now)}
          note={
            report.lastYouAt
              ? report.lastYouAt.toLocaleTimeString(undefined, {
                  hour: "numeric",
                  minute: "2-digit",
                })
              : "In the last 8 weeks"
          }
          small
        />
      </section>

      <div className="fade-in-delay-2 grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        <SectionCard eyebrow="Every day" title="The last 8 weeks">
          <DayGrid report={report} partnerName={partnerName} />
        </SectionCard>

        <SectionCard eyebrow="Who logged it" title="Last 7 days against the 7 before">
          <WhoBars report={report} partnerName={partnerName} />
        </SectionCard>
      </div>

      <div className="fade-in-delay-3 space-y-6">
        <SectionCard
          eyebrow="By part of the app"
          title="Where the entries land"
          aside={
            <span className="text-[0.72rem]" style={{ color: "var(--text-faint)" }}>
              8 weeks, oldest to newest
            </span>
          }
        >
          {anyActivity ? (
            <AreaTable
              areas={activeAreas}
              weekKeys={report.weeks.map((week) => week.key)}
              hasPartner={hasPartner}
              partnerName={partnerName}
              now={now}
            />
          ) : (
            <EmptyNote>
              Nothing has been logged in the last 8 weeks. The first entry you make
              shows up here.
            </EmptyNote>
          )}
        </SectionCard>

        {quietAreas.length > 0 ? (
          <SectionCard
            eyebrow="Quiet"
            title={`No entry by a person in ${QUIET_AFTER_DAYS} days`}
          >
            <ul className="flex flex-wrap gap-1.5">
              {quietAreas.map((area) => (
                <li key={area.key}>
                  <Link
                    href={area.href}
                    className="inline-flex items-center gap-1.5 rounded px-2.5 py-1.5 text-[0.8rem] font-medium"
                    style={{ background: "var(--bg-tint)", color: "var(--text-muted)" }}
                  >
                    {area.label}
                    {area.totals.agent > 0 ? (
                      <span
                        className="text-[0.7rem] font-normal"
                        style={{ color: "var(--text-faint)" }}
                      >
                        agent only
                      </span>
                    ) : null}
                  </Link>
                </li>
              ))}
            </ul>
            <p
              className="mt-3 text-[0.78rem] leading-[1.5]"
              style={{ color: "var(--text-faint)" }}
            >
              These are candidates to hide from the menu, or to pick back up.
            </p>
          </SectionCard>
        ) : null}

        <p className="text-[0.75rem] leading-[1.6]" style={{ color: "var(--text-faint)" }}>
          Counts are entries in the activity log, not page views, so a day you only
          looked around does not count. Automatic syncs are left out
          {report.autoLast7 > 0 ? ` (${report.autoLast7} in the last 7 days)` : ""}.
          Agent entries are the ones made through the assistant API with a key.
        </p>
      </div>
    </div>
  );
}

function StatTile({
  label,
  value,
  unit,
  note,
  good,
  small,
}: {
  label: string;
  value: string;
  unit?: string;
  note: string;
  good?: boolean;
  small?: boolean;
}) {
  return (
    <div
      className="rounded-md border p-3.5"
      style={{ borderColor: "var(--border-soft)", background: "var(--bg-page)" }}
    >
      <p
        className="text-[0.6875rem] font-semibold uppercase tracking-wider"
        style={{ color: "var(--text-faint)" }}
      >
        {label}
      </p>
      <p className="mt-1.5 flex items-baseline gap-1.5" style={{ color: "var(--text)" }}>
        <span
          className={
            small
              ? "text-[1.15rem] font-semibold leading-[2rem] tracking-tight"
              : "text-[1.75rem] font-bold leading-8 tracking-tight tabular-nums"
          }
        >
          {value}
        </span>
        {unit ? (
          <span className="text-[0.78rem]" style={{ color: "var(--text-muted)" }}>
            {unit}
          </span>
        ) : null}
      </p>
      <p
        className="mt-1 text-[0.75rem]"
        style={{ color: good ? "var(--positive)" : "var(--text-faint)" }}
      >
        {good ? "✓ " : ""}
        {note}
      </p>
    </div>
  );
}

function dayTitle(day: UsageDay, partnerName: string, hasPartner: boolean): string {
  const label = day.date.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  if (day.future) return label;
  const parts = [`you ${day.you}`];
  if (hasPartner) parts.push(`${partnerName} ${day.partner}`);
  parts.push(`agents ${day.agent}`);
  return `${label}: ${parts.join(", ")}`;
}

/** One square per day. Your entries fill it; a partner or an agent leaves a dot. */
function DayCell({
  day,
  partnerName,
  hasPartner,
}: {
  day: UsageDay;
  partnerName: string;
  hasPartner: boolean;
}) {
  const title = dayTitle(day, partnerName, hasPartner);
  if (day.future) {
    return (
      <span
        title={title}
        className="block aspect-square w-full rounded-[5px] border border-dashed"
        style={{ borderColor: "var(--border-faint)" }}
      />
    );
  }
  const dot = day.you > 0 ? null : day.partner > 0 ? PARTNER : day.agent > 0 ? AGENT : null;
  return (
    <span
      title={title}
      aria-label={title}
      role="img"
      className="relative block aspect-square w-full rounded-[5px]"
      style={{ background: "var(--bg-tint-strong)" }}
    >
      {day.you > 0 ? (
        <span
          className="absolute inset-0 rounded-[5px]"
          style={{ background: YOU, opacity: intensity(day.you) }}
        />
      ) : null}
      {day.you > 0 && day.partner > 0 ? (
        <span
          className="absolute right-[3px] top-[3px] h-[7px] w-[7px] rounded-full"
          style={{ background: PARTNER, boxShadow: "0 0 0 2px var(--bg-page)" }}
        />
      ) : null}
      {dot ? (
        <span
          className="absolute left-1/2 top-1/2 h-[8px] w-[8px] -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{ background: dot }}
        />
      ) : null}
    </span>
  );
}

function DayGrid({ report, partnerName }: { report: UsageReport; partnerName: string }) {
  return (
    <div>
      <div
        className="grid items-center gap-x-1.5 gap-y-1.5"
        style={{ gridTemplateColumns: "3.25rem repeat(7, minmax(0, 2.1rem)) minmax(3.5rem, 1fr)" }}
      >
        <span />
        {WEEKDAYS.map((letter, index) => (
          <span
            key={index}
            className="text-center text-[0.6875rem] font-medium"
            style={{ color: "var(--text-faint)" }}
          >
            {letter}
          </span>
        ))}
        <span
          className="pl-2 text-[0.6875rem] font-medium"
          style={{ color: "var(--text-faint)" }}
        >
          Days
        </span>

        {report.weeks.map((week, index) => {
          const current = index === report.weeks.length - 1;
          return (
            <div key={week.key} className="contents">
              <span
                className="text-[0.72rem] tabular-nums"
                style={{ color: current ? "var(--text)" : "var(--text-faint)" }}
              >
                {current ? "This wk" : weekLabel(week.key)}
              </span>
              {week.days.map((day) => (
                <DayCell
                  key={day.key}
                  day={day}
                  partnerName={partnerName}
                  hasPartner={report.hasPartner}
                />
              ))}
              <span
                className="pl-2 text-[0.8rem] tabular-nums"
                style={{
                  color: week.activeDays > 0 ? "var(--text)" : "var(--text-ghost)",
                  fontWeight: week.activeDays >= USAGE_GOAL_DAYS ? 600 : 400,
                }}
              >
                {week.activeDays}
                {week.activeDays >= USAGE_GOAL_DAYS ? " ✓" : ""}
              </span>
            </div>
          );
        })}
      </div>

      <ul
        className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[0.75rem]"
        style={{ color: "var(--text-muted)" }}
      >
        <li className="flex items-center gap-1.5">
          <span className="flex gap-[2px]">
            {[0.4, 0.7, 1].map((opacity) => (
              <span
                key={opacity}
                className="h-3 w-3 rounded-[3px]"
                style={{ background: YOU, opacity }}
              />
            ))}
          </span>
          You, fewer to more entries
        </li>
        {report.hasPartner ? (
          <li className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ background: PARTNER }} />
            {partnerName}
          </li>
        ) : null}
        <li className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full" style={{ background: AGENT }} />
          Agent only
        </li>
      </ul>
    </div>
  );
}

function WhoBars({ report, partnerName }: { report: UsageReport; partnerName: string }) {
  const rows: Array<{ key: keyof UsageCounts; label: string; color: string }> = [
    { key: "you", label: "You", color: YOU },
    ...(report.hasPartner
      ? [{ key: "partner" as const, label: partnerName, color: PARTNER }]
      : []),
    { key: "agent", label: "Agents", color: AGENT },
  ];
  const max = Math.max(
    1,
    ...rows.flatMap((row) => [report.last7[row.key], report.prior7[row.key]]),
  );

  return (
    <div className="space-y-4">
      {rows.map((row) => {
        const current = report.last7[row.key];
        const before = report.prior7[row.key];
        return (
          <div key={row.key}>
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-[0.875rem] font-medium" style={{ color: "var(--text)" }}>
                {row.label}
              </span>
              <span className="text-[0.8rem] tabular-nums" style={{ color: "var(--text-muted)" }}>
                <span className="font-semibold" style={{ color: "var(--text)" }}>
                  {plural(current, "entry", "entries")}
                </span>
                {` · ${before} before`}
              </span>
            </div>
            <div className="mt-1.5 space-y-[3px]">
              <Bar
                value={current}
                max={max}
                color={row.color}
                title={`${row.label}, last 7 days: ${plural(current, "entry", "entries")}`}
              />
              <Bar
                value={before}
                max={max}
                color={row.color}
                faded
                title={`${row.label}, 7 days before: ${plural(before, "entry", "entries")}`}
              />
            </div>
          </div>
        );
      })}
      <p className="text-[0.75rem]" style={{ color: "var(--text-faint)" }}>
        Solid bar is the last 7 days. The lighter bar under it is the 7 days before.
      </p>
    </div>
  );
}

function Bar({
  value,
  max,
  color,
  faded,
  title,
}: {
  value: number;
  max: number;
  color: string;
  faded?: boolean;
  title: string;
}) {
  return (
    <div
      title={title}
      className="h-2 w-full rounded-[4px]"
      style={{ background: "var(--bg-tint)" }}
    >
      {value > 0 ? (
        <div
          className="h-2 rounded-[4px]"
          style={{
            width: `${Math.max(2, (value / max) * 100)}%`,
            background: color,
            opacity: faded ? 0.4 : 1,
          }}
        />
      ) : null}
    </div>
  );
}

function AreaTable({
  areas,
  weekKeys,
  hasPartner,
  partnerName,
  now,
}: {
  areas: UsageAreaRow[];
  weekKeys: string[];
  hasPartner: boolean;
  partnerName: string;
  now: Date;
}) {
  return (
    <ul className="divide-y" style={{ borderColor: "var(--border-faint)" }}>
      {areas.map((area) => {
        const people = area.totals.you + area.totals.partner;
        const detail = [`you ${area.totals.you}`];
        if (hasPartner) detail.push(`${partnerName} ${area.totals.partner}`);
        detail.push(`agents ${area.totals.agent}`);
        return (
          <li
            key={area.key}
            className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 py-2.5 sm:grid-cols-[9rem_auto_minmax(0,1fr)_auto]"
            style={{ borderColor: "var(--border-faint)" }}
          >
            <Link
              href={area.href}
              className="truncate text-[0.875rem] font-medium"
              style={{ color: "var(--text)" }}
            >
              {area.label}
            </Link>
            <span className="flex gap-[3px]" aria-hidden>
              {area.weeks.map((counts, index) => {
                const byPeople = counts.you + counts.partner;
                return (
                  <span
                    key={weekKeys[index]}
                    title={`Week of ${weekLabel(weekKeys[index]!)}: you ${counts.you}${
                      hasPartner ? `, ${partnerName} ${counts.partner}` : ""
                    }, agents ${counts.agent}`}
                    className="relative block h-[1.1rem] w-[1.1rem] rounded-[4px]"
                    style={{ background: "var(--bg-tint-strong)" }}
                  >
                    {byPeople > 0 ? (
                      <span
                        className="absolute inset-0 rounded-[4px]"
                        style={{
                          background: counts.you > 0 ? YOU : PARTNER,
                          opacity: intensity(byPeople),
                        }}
                      />
                    ) : counts.agent > 0 ? (
                      <span
                        className="absolute left-1/2 top-1/2 h-[6px] w-[6px] -translate-x-1/2 -translate-y-1/2 rounded-full"
                        style={{ background: AGENT }}
                      />
                    ) : null}
                  </span>
                );
              })}
            </span>
            <span
              className="text-[0.78rem] tabular-nums"
              style={{ color: "var(--text-muted)" }}
            >
              {people === 0
                ? `Agent only · ${plural(area.totals.agent, "entry", "entries")}`
                : detail.join(" · ")}
            </span>
            <span
              className="text-right text-[0.75rem]"
              style={{ color: "var(--text-faint)" }}
            >
              {area.lastPersonAt ? agoLabel(area.lastPersonAt, now) : "No one yet"}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
