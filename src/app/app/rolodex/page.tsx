import Link from "next/link";
import { resolveActiveUserId } from "@/lib/viewer-context";
import {
  ensureRolodexTables,
  listPersons,
  listUnresolvedMentions,
} from "@/lib/services/rolodex";
import {
  createPersonFromMentionAction,
  resolveMentionFormAction,
} from "./actions";

export const dynamic = "force-dynamic";

const RELATIONSHIP_FILTERS = [
  { value: "", label: "All" },
  { value: "family", label: "Family" },
  { value: "friend", label: "Friends" },
  { value: "coworker", label: "Coworkers" },
  { value: "vendor", label: "Vendors" },
  { value: "acquaintance", label: "Acquaintances" },
];

function upcomingBirthdayLabel(birthday: string | null): string | null {
  if (!birthday) return null;
  const bday = new Date(birthday);
  const now = new Date();
  const thisYear = new Date(now.getFullYear(), bday.getMonth(), bday.getDate());
  const upcoming = thisYear >= now ? thisYear : new Date(now.getFullYear() + 1, bday.getMonth(), bday.getDate());
  const diffDays = Math.ceil((upcoming.getTime() - now.getTime()) / 86_400_000);
  if (diffDays <= 30) {
    return diffDays === 0 ? "Birthday today!" : `Birthday in ${diffDays}d`;
  }
  return null;
}

export default async function RolodexPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; type?: string }>;
}) {
  try {
    await ensureRolodexTables();
  } catch {
    // degrade gracefully — tables may not exist yet
  }

  const { q, type } = await searchParams;
  const userId = await resolveActiveUserId();

  const persons = await listPersons(userId, {
    search: q,
    relationshipType: type || undefined,
  }).catch(() => []);
  const unresolvedMentions = await listUnresolvedMentions(userId).catch(() => []);

  return (
    <div className="space-y-6">
      <header className="fade-in flex items-start justify-between gap-3">
        <h1
          className="text-[1.5rem] font-bold tracking-tight sm:text-[1.875rem]"
          style={{ color: "var(--text)", letterSpacing: "-0.025em" }}
        >
          Rolodex
        </h1>
        <Link
          href="/app/rolodex/new"
          className="btn-ghost shrink-0 px-3 py-1.5 text-[0.875rem] font-medium"
          style={{ color: "var(--accent)" }}
        >
          + Add person
        </Link>
      </header>

      {/* Search + filter */}
      <div className="fade-in-delay-1 space-y-3">
        <form method="GET" className="flex gap-2">
          <input
            name="q"
            type="search"
            defaultValue={q}
            placeholder="Search by name, org…"
            className="field flex-1 text-[0.875rem]"
          />
          <input type="hidden" name="type" value={type ?? ""} />
          <button type="submit" className="btn-ghost px-3 py-1.5 text-[0.875rem] font-medium" style={{ color: "var(--text-muted)" }}>
            Search
          </button>
        </form>

        <div className="flex flex-wrap gap-1.5">
          {RELATIONSHIP_FILTERS.map((filter) => {
            const active = (type ?? "") === filter.value;
            return (
              <Link
                key={filter.value}
                href={`/app/rolodex?${filter.value ? `type=${filter.value}` : ""}${q ? `&q=${q}` : ""}`}
                className="rounded-full px-2.5 py-0.5 text-[0.8125rem] font-medium transition-colors"
                style={{
                  background: active ? "var(--text)" : "var(--bg-tint)",
                  color: active ? "var(--bg-page)" : "var(--text-muted)",
                  border: "1px solid var(--border-faint)",
                }}
              >
                {filter.label}
              </Link>
            );
          })}
        </div>
      </div>

      {unresolvedMentions.length > 0 ? (
        <section
          className="fade-in-delay-2 rounded-xl p-4"
          style={{ background: "var(--bg-tint)", border: "1px solid var(--border-faint)" }}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-[0.9375rem] font-semibold" style={{ color: "var(--text)" }}>
                Unresolved @mentions
              </h2>
              <p className="mt-1 text-[0.8125rem]" style={{ color: "var(--text-muted)" }}>
                Link these notes to existing people or create new Rolodex entries.
              </p>
            </div>
            <span
              className="rounded-full px-2 py-0.5 text-[0.75rem] font-medium"
              style={{ background: "var(--bg-page)", color: "var(--text-muted)" }}
            >
              {unresolvedMentions.length}
            </span>
          </div>
          <div className="mt-4 space-y-3">
            {unresolvedMentions.slice(0, 8).map((mention) => (
              <div
                key={mention.id}
                className="rounded-lg p-3"
                style={{ background: "var(--bg-page)", border: "1px solid var(--border-faint)" }}
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-[0.9375rem] font-semibold" style={{ color: "var(--text)" }}>
                      @{mention.mentionedName}
                    </p>
                    <p className="text-[0.75rem]" style={{ color: "var(--text-muted)" }}>
                      From {mention.sourceTool}
                    </p>
                  </div>
                  <div className="flex flex-col gap-2 sm:min-w-[320px] sm:flex-row">
                    {persons.length > 0 ? (
                      <form action={resolveMentionFormAction} className="flex flex-1 gap-2">
                        <input type="hidden" name="mentionId" value={mention.id} />
                        <select name="personId" className="field min-w-0 flex-1 text-[0.8125rem]">
                          {persons.map((person) => (
                            <option key={person.id} value={person.id}>
                              {person.displayName}
                            </option>
                          ))}
                        </select>
                        <button type="submit" className="btn-ghost px-2.5 py-1 text-[0.8125rem]">
                          Link
                        </button>
                      </form>
                    ) : null}
                    <form action={createPersonFromMentionAction}>
                      <input type="hidden" name="mentionId" value={mention.id} />
                      <input type="hidden" name="displayName" value={mention.mentionedName} />
                      <button type="submit" className="btn-ink whitespace-nowrap px-2.5 py-1 text-[0.8125rem]">
                        Create person
                      </button>
                    </form>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {/* Person list */}
      <div className="fade-in-delay-3 space-y-2">
        {persons.length === 0 ? (
          <div
            className="rounded-xl p-8 text-center"
            style={{ background: "var(--bg-tint)", border: "1px solid var(--border-faint)" }}
          >
            <p className="text-[0.9375rem] font-medium" style={{ color: "var(--text-muted)" }}>
              {q || type ? "No contacts match your filter." : "Your Rolodex is empty — add someone to get started."}
            </p>
            {!q && !type && (
              <Link
                href="/app/rolodex/new"
                className="mt-3 inline-block text-[0.875rem] font-medium"
                style={{ color: "var(--accent)" }}
              >
                Add your first contact →
              </Link>
            )}
          </div>
        ) : (
          persons.map((person) => {
            const birthdayLabel = upcomingBirthdayLabel(person.birthday);
            return (
              <Link
                key={person.id}
                href={`/app/rolodex/${person.id}`}
                className="block rounded-lg px-4 py-3 transition-colors hover:bg-bg-hover"
                style={{ background: "var(--bg-tint)", border: "1px solid var(--border-faint)" }}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[0.9375rem] font-semibold"
                    style={{ background: "var(--border)", color: "var(--text-muted)" }}
                    aria-hidden
                  >
                    {person.displayName.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[0.9375rem] font-semibold" style={{ color: "var(--text)" }}>
                      {person.displayName}
                    </p>
                    <p className="truncate text-[0.8125rem]" style={{ color: "var(--text-muted)" }}>
                      {[person.relationshipType, person.organization].filter(Boolean).join(" · ") || " "}
                    </p>
                  </div>
                  {birthdayLabel && (
                    <span
                      className="shrink-0 rounded px-1.5 py-0.5 text-[0.75rem] font-medium"
                      style={{ background: "var(--accent-tint)", color: "var(--accent-strong)" }}
                    >
                      🎂 {birthdayLabel}
                    </span>
                  )}
                </div>
              </Link>
            );
          })
        )}
      </div>
    </div>
  );
}
