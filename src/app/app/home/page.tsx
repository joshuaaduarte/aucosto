import Link from "next/link";
import { householdMemberNames, listHouseholdMembers } from "@/lib/household";
import { describeEventType } from "@/lib/event-types";
import { homeDaysUntil } from "@/lib/home";
import { billsDueWithin, dueLabel } from "@/lib/finance-planning";
import { formatUSDFromCents } from "@/lib/money";
import { listEventsByTool } from "@/lib/services/events";
import { listBills } from "@/lib/services/finance";
import { isHomeReady, listHomeLists, listHomeTasks } from "@/lib/services/home";
import { requireViewerContext } from "@/lib/viewer-context";
import { HomeLists, type ListView } from "./_components/lists";
import { ChoreBoard, type MemberOption, type TaskView } from "./_components/tasks";

export const dynamic = "force-dynamic";

function readNow(): Date {
  return new Date();
}

function toDateInput(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const faint = { color: "var(--text-faint)" } as const;

export default async function HomePage() {
  const context = await requireViewerContext();
  const userId = context.homeUserId;
  const now = readNow();

  if (!(await isHomeReady(userId))) {
    return (
      <Shell title="Home" subtitle="Shared lists, chores and home maintenance.">
        <p className="text-[0.875rem]" style={{ color: "var(--text-muted)" }}>
          The Home tables aren&apos;t in the database yet. Run{" "}
          <code className="font-mono text-[0.8125rem]">scripts/create-household-home.sql</code>{" "}
          (see <code className="font-mono text-[0.8125rem]">docs/household.md</code>), then reload.
        </p>
      </Shell>
    );
  }

  const shared = Boolean(context.householdId);
  const [lists, tasks, members, names, events, bills] = await Promise.all([
    listHomeLists(userId),
    listHomeTasks(userId),
    context.householdId ? listHouseholdMembers(context.householdId) : Promise.resolve([]),
    context.householdId ? householdMemberNames(context.householdId) : Promise.resolve({} as Record<string, string>),
    shared ? listEventsByTool(userId, ["home", "finance"], { limit: 8 }).catch(() => []) : Promise.resolve([]),
    context.financeVisible ? listBills(context.financeUserId) : Promise.resolve([]),
  ]);

  const memberOptions: MemberOption[] = members
    .filter((m) => !m.removed)
    .map((m) => ({ userId: m.userId, name: names[m.userId] ?? m.email }));
  const nameOf = (id: string | null) => (id ? (names[id] ?? null) : null);

  const taskViews: TaskView[] = tasks.map((task) => ({
    id: task.id,
    kind: task.kind,
    title: task.title,
    notes: task.notes,
    cadenceDays: task.cadenceDays,
    daysUntil: homeDaysUntil(task.nextDueAt, now),
    nextDueInput: toDateInput(task.nextDueAt),
    assigneeUserId: task.assigneeUserId,
    assigneeName: nameOf(task.assigneeUserId),
    rotate: task.rotate,
    lastDone: task.lastDoneAt
      ? `${task.lastDoneAt.toLocaleDateString([], { month: "short", day: "numeric" })}${
          shared && task.lastDoneByUserId ? ` by ${nameOf(task.lastDoneByUserId) ?? "someone"}` : ""
        }`
      : null,
  }));
  const billsSoon = billsDueWithin(bills, now, 7);

  const listViews: ListView[] = lists.map((list) => ({
    id: list.id,
    name: list.name,
    emoji: list.emoji,
    items: list.items.map((item) => ({
      id: item.id,
      title: item.title,
      checked: item.checkedAt != null,
      addedBy: shared ? nameOf(item.addedByUserId) : null,
    })),
  }));

  const today = toDateInput(now);

  return (
    <Shell
      title={context.householdName ?? "Home"}
      subtitle={
        shared
          ? `Shared with ${memberOptions.filter((m) => m.userId !== context.ownerUserId).map((m) => m.name).join(", ") || "your household"}.`
          : "Lists, chores and maintenance. Invite someone from Settings to share them."
      }
    >
      <Section title="Lists">
        <HomeLists lists={listViews} showAttribution={shared} />
      </Section>

      {billsSoon.length ? (
        <Section title="Bills this week">
          <ul className="rounded-lg border" style={{ borderColor: "var(--border-soft)" }}>
            {billsSoon.map((bill) => {
              const urgent = bill.daysUntil <= 1 && !bill.autopay;
              return (
                <li key={bill.id} className="border-t first:border-t-0" style={{ borderColor: "var(--border-faint)" }}>
                  <Link
                    href="/app/finance?tab=plan#budgets"
                    className="flex items-center justify-between gap-3 px-3 py-2.5 text-[0.875rem] hover:bg-bg-hover"
                  >
                    <span style={{ color: "var(--text)" }}>
                      {bill.name}
                      {bill.amountCents != null ? (
                        <span className="tabular" style={{ color: "var(--text-muted)" }}>
                          {" "}
                          {formatUSDFromCents(bill.amountCents)}
                        </span>
                      ) : null}
                    </span>
                    <span className="text-[0.75rem]" style={urgent ? { color: "var(--attention)" } : faint}>
                      {dueLabel(bill.daysUntil)}
                      {bill.autopay ? " · autopay" : ""}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </Section>
      ) : null}

      <Section title="Chores and upkeep">
        <ChoreBoard tasks={taskViews} members={memberOptions} viewerUserId={context.ownerUserId} today={today} />
      </Section>

      {shared && events.length ? (
        <details className="group">
          <summary className="cursor-pointer text-[0.6875rem] font-semibold uppercase tracking-wider" style={faint}>
            Recent activity
          </summary>
          <ul className="mt-3 space-y-1">
            {events.map((event) => {
              const meta = (event.meta ?? {}) as { actorUserId?: string };
              const who = nameOf(meta.actorUserId ?? null) ?? "Someone";
              return (
                <li key={event.id} className="text-[0.8125rem]" style={{ color: "var(--text-muted)" }}>
                  {who} {describeEventType(event.type)}{" "}
                  <span style={faint}>
                    {event.at.toLocaleDateString([], { month: "short", day: "numeric" })}
                  </span>
                </li>
              );
            })}
          </ul>
        </details>
      ) : null}
    </Shell>
  );
}

function Shell({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="space-y-10">
      <header className="fade-in">
        <p className="text-[0.75rem] font-medium uppercase tracking-wider" style={faint}>
          Home
        </p>
        <h1
          className="mt-1 text-[1.5rem] font-bold tracking-tight sm:text-[1.875rem]"
          style={{ color: "var(--text)", letterSpacing: "-0.025em" }}
        >
          {title}
        </h1>
        <p className="mt-1 text-[0.875rem]" style={{ color: "var(--text-muted)" }}>
          {subtitle}
        </p>
      </header>
      {children}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-[0.6875rem] font-semibold uppercase tracking-wider" style={faint}>
        {title}
      </h2>
      {children}
    </section>
  );
}
