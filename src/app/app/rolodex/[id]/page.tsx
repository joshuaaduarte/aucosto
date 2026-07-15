import Link from "next/link";
import { notFound } from "next/navigation";
import { resolveActiveUserId } from "@/lib/viewer-context";
import {
  ensureRolodexTables,
  getPerson,
  getLinkedCalendarItems,
  getLinkedTimeEntries,
  listRelationsForEntity,
  listPersons,
} from "@/lib/services/rolodex";
import {
  ensureInsightTables,
  listInsightsForPerson,
} from "@/lib/services/captured-insights";
import { getWorkContextForRolodexPerson } from "@/lib/services/work";
import { InteractionTimeline } from "./_interaction-timeline";
import { RelationshipsSection } from "./_relationships-section";
import { InsightsSection } from "./_insights-section";

export const dynamic = "force-dynamic";

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  } catch {
    return iso;
  }
}

function formatBirthday(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString(undefined, { month: "long", day: "numeric" });
  } catch {
    return iso;
  }
}

export default async function PersonDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  try {
    await ensureRolodexTables();
  } catch {
    // degrade gracefully
  }

  const { id } = await params;
  const userId = await resolveActiveUserId();

  const person = await getPerson(userId, id).catch(() => null);
  if (!person) notFound();

  await ensureInsightTables().catch(() => {});

  const [linkedCalendar, linkedTime, personInsights, relations, allPersons, workContexts] =
    await Promise.all([
      getLinkedCalendarItems(userId, id).catch(() => []),
      getLinkedTimeEntries(userId, id).catch(() => []),
      listInsightsForPerson(userId, id, { limit: 10 }).catch(() => []),
      listRelationsForEntity(userId, id).catch(() => []),
      listPersons(userId).catch(() => []),
      getWorkContextForRolodexPerson(userId, id).catch(() => []),
    ]);

  const dueFollowUps = person.interactions.filter((i) => i.followUpNeeded);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="fade-in space-y-3">
        <Link
          href="/app/rolodex"
          className="inline-flex items-center gap-1 text-[0.8125rem] font-medium hover:underline"
          style={{ color: "var(--text-muted)" }}
        >
          ← Rolodex
        </Link>

        <header className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-xl font-semibold"
              style={{ background: "var(--border)", color: "var(--text-muted)" }}
              aria-hidden
            >
              {person.displayName.charAt(0).toUpperCase()}
            </div>
            <div>
              <h1
                className="text-[1.5rem] font-bold tracking-tight"
                style={{ color: "var(--text)", letterSpacing: "-0.025em" }}
              >
                {person.displayName}
              </h1>
              <p className="flex items-center gap-1.5 text-[0.875rem]" style={{ color: "var(--text-muted)" }}>
                {person.contactKind === "pet" && <span className="shrink-0 rounded px-1.5 py-0.5 text-[0.625rem] font-medium" style={{ background: "var(--bg-tint)", border: "1px solid var(--border-faint)" }}>🐾 Pet</span>}
                {person.contactKind === "organization" && <span className="shrink-0 rounded px-1.5 py-0.5 text-[0.625rem] font-medium" style={{ background: "var(--bg-tint)", border: "1px solid var(--border-faint)" }}>🏢 Org</span>}
                {person.contactKind === "group" && <span className="shrink-0 rounded px-1.5 py-0.5 text-[0.625rem] font-medium" style={{ background: "var(--bg-tint)", border: "1px solid var(--border-faint)" }}>👥 Group</span>}
                <span>{[person.relationshipType, person.organization, person.birthday ? `🎂 ${formatBirthday(person.birthday)}` : null].filter(Boolean).join(" · ")}</span>
              </p>
            </div>
          </div>
          <Link
            href={`/app/rolodex/${id}/edit`}
            className="btn-ghost shrink-0 px-3 py-1.5 text-[0.875rem] font-medium"
            style={{ color: "var(--text-muted)" }}
          >
            Edit
          </Link>
        </header>
      </div>

      {/* Work context (linked into a Work workspace) */}
      {workContexts.length > 0 && (
        <section className="fade-in-delay-1 space-y-2">
          {workContexts.map((ctx) => (
            <Link
              key={ctx.workPersonId}
              href="/app/work?tab=people"
              className="flex items-center justify-between rounded-lg px-3 py-2.5"
              style={{ background: "var(--bg-tint)", border: "1px solid var(--border-faint)" }}
            >
              <span className="text-[0.875rem]" style={{ color: "var(--text)" }}>
                <span className="font-medium">💼 {ctx.workspaceName}</span>
                {[ctx.role, ctx.relationship, ctx.team].filter(Boolean).length > 0 && (
                  <span style={{ color: "var(--text-muted)" }}>
                    {" · "}
                    {[ctx.role, ctx.relationship, ctx.team].filter(Boolean).join(" · ")}
                  </span>
                )}
              </span>
              <span className="shrink-0 text-[0.8125rem]" style={{ color: "var(--text-ghost)" }}>
                Work Hub →
              </span>
            </Link>
          ))}
        </section>
      )}

      {/* Notes */}
      {person.notes && (
        <div className="fade-in-delay-1 rounded-lg p-4" style={{ background: "var(--bg-tint)", border: "1px solid var(--border-faint)" }}>
          <p className="text-[0.8125rem]" style={{ color: "var(--text-muted)", whiteSpace: "pre-wrap" }}>
            {person.notes}
          </p>
        </div>
      )}

      {/* Insights involving this person */}
      <InsightsSection personId={id} insights={personInsights} />

      {/* Follow-ups due */}
      {dueFollowUps.length > 0 && (
        <section className="fade-in-delay-1 space-y-2">
          <h2
            className="text-[0.6875rem] font-semibold uppercase tracking-wider"
            style={{ color: "var(--accent-strong)" }}
          >
            Follow-ups due
          </h2>
          {dueFollowUps.map((fu) => (
            <div
              key={fu.id}
              className="rounded-lg px-3 py-2.5"
              style={{ background: "var(--accent-tint)", border: "1px solid var(--accent-soft)" }}
            >
              <p className="font-medium text-[0.875rem]" style={{ color: "var(--text)" }}>{fu.title}</p>
              {fu.followUpDate && (
                <p className="text-[0.8125rem]" style={{ color: "var(--text-muted)" }}>
                  by {formatDate(fu.followUpDate)}
                </p>
              )}
            </div>
          ))}
        </section>
      )}

      {/* Gift ideas */}
      {person.giftIdeas.length > 0 && (
        <section className="fade-in-delay-1 space-y-2">
          <h2
            className="text-[0.6875rem] font-semibold uppercase tracking-wider"
            style={{ color: "var(--text-faint)" }}
          >
            Gift ideas
          </h2>
          <div className="flex flex-wrap gap-2">
            {person.giftIdeas.map((idea) => (
              <span
                key={idea}
                className="rounded-full px-2.5 py-0.5 text-[0.8125rem]"
                style={{ background: "var(--bg-tint)", border: "1px solid var(--border-faint)", color: "var(--text)" }}
              >
                🎁 {idea}
              </span>
            ))}
          </div>
        </section>
      )}

      <RelationshipsSection
        entityId={id}
        relations={relations}
        allPersons={allPersons}
      />

      <InteractionTimeline
        personId={id}
        personName={person.displayName}
        interactions={person.interactions}
      />

      {/* Linked calendar events */}
      {linkedCalendar.length > 0 && (
        <section className="fade-in-delay-2 space-y-2">
          <h2
            className="text-[0.6875rem] font-semibold uppercase tracking-wider"
            style={{ color: "var(--text-faint)" }}
          >
            Calendar events
          </h2>
          <div className="space-y-1">
            {linkedCalendar.map((item) => (
              <Link
                key={item.id}
                href="/app/calendar"
                className="flex items-center justify-between rounded-md px-3 py-2 text-[0.875rem] hover:bg-bg-hover"
                style={{ background: "var(--bg-tint)", border: "1px solid var(--border-faint)" }}
              >
                <span style={{ color: "var(--text)" }}>{item.title}</span>
                <span className="shrink-0 text-[0.8125rem]" style={{ color: "var(--text-ghost)" }}>
                  {formatDate(item.startAt)}
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Linked time entries */}
      {linkedTime.length > 0 && (
        <section className="fade-in-delay-2 space-y-2">
          <h2
            className="text-[0.6875rem] font-semibold uppercase tracking-wider"
            style={{ color: "var(--text-faint)" }}
          >
            Time entries
          </h2>
          <div className="space-y-1">
            {linkedTime.map((entry) => (
              <Link
                key={entry.id}
                href="/app/time"
                className="flex items-center justify-between rounded-md px-3 py-2 text-[0.875rem] hover:bg-bg-hover"
                style={{ background: "var(--bg-tint)", border: "1px solid var(--border-faint)" }}
              >
                <span style={{ color: "var(--text)" }}>{entry.title}</span>
                <span className="shrink-0 text-[0.8125rem]" style={{ color: "var(--text-ghost)" }}>
                  {formatDate(entry.startedAt)}
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Contact info */}
      {(person.emails.length > 0 || person.phones.length > 0) && (
        <section className="fade-in-delay-2 space-y-2">
          <h2
            className="text-[0.6875rem] font-semibold uppercase tracking-wider"
            style={{ color: "var(--text-faint)" }}
          >
            Contact info
          </h2>
          <div className="space-y-1">
            {person.emails.map((e) => (
              <p key={e.value} className="text-[0.875rem]" style={{ color: "var(--text)" }}>
                <span style={{ color: "var(--text-muted)" }}>{e.label}: </span>
                <a href={`mailto:${e.value}`} style={{ color: "var(--accent)" }}>{e.value}</a>
              </p>
            ))}
            {person.phones.map((p) => (
              <p key={p.value} className="text-[0.875rem]" style={{ color: "var(--text)" }}>
                <span style={{ color: "var(--text-muted)" }}>{p.label}: </span>
                {p.value}
              </p>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
