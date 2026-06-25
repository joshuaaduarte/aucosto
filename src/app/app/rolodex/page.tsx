import Link from "next/link";
import { resolveActiveUserId } from "@/lib/viewer-context";
import {
  ensureRolodexTables,
  listPersons,
  listUnresolvedMentions,
  listAllPendingFollowUps,
} from "@/lib/services/rolodex";
import { UnresolvedMentionsBanner } from "./unresolved-mentions";

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

function lastContactLabel(isoDate: string | null): string | null {
  if (!isoDate) return null;
  const then = new Date(isoDate);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - then.getTime()) / 86_400_000);
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)}mo ago`;
  return `${Math.floor(diffDays / 365)}y ago`;
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

  const [persons, unresolvedMentions, pendingFollowUps] = await Promise.all([
    listPersons(userId, { search: q, relationshipType: type || undefined }).catch(() => []),
    listUnresolvedMentions(userId).catch(() => []),
    listAllPendingFollowUps(userId).catch(() => []),
  ]);

  // Fetch full person list for "link to existing" only when there are unresolved mentions
  const allPersons =
    unresolvedMentions.length > 0 ? await listPersons(userId).catch(() => []) : [];

  const now = new Date();
  const sevenDaysLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const followUpStatus = new Map<string, "overdue" | "soon" | "pending">();
  for (const fu of pendingFollowUps) {
    let status: "overdue" | "soon" | "pending";
    if (!fu.followUpDate) {
      status = "pending";
    } else {
      const d = new Date(fu.followUpDate);
      if (d < now) status = "overdue";
      else if (d <= sevenDaysLater) status = "soon";
      else status = "pending";
    }
    const existing = followUpStatus.get(fu.personId);
    if (!existing || status === "overdue" || (status === "soon" && existing === "pending")) {
      followUpStatus.set(fu.personId, status);
    }
  }

  return (
    <div className="space-y-6">
      {unresolvedMentions.length > 0 && (
        <UnresolvedMentionsBanner mentions={unresolvedMentions} persons={allPersons} />
      )}

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

        <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 no-scrollbar sm:flex-wrap sm:overflow-x-visible sm:pb-0">
          {RELATIONSHIP_FILTERS.map((filter) => {
            const active = (type ?? "") === filter.value;
            return (
              <Link
                key={filter.value}
                href={`/app/rolodex?${filter.value ? `type=${filter.value}` : ""}${q ? `&q=${q}` : ""}`}
                className="shrink-0 whitespace-nowrap rounded-full px-2.5 py-1.5 text-[0.8125rem] font-medium transition-colors [@media(pointer:coarse)]:min-h-[2.75rem] [@media(pointer:coarse)]:inline-flex [@media(pointer:coarse)]:items-center"
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
            const fuStatus = followUpStatus.get(person.id);
            const contactAgo = lastContactLabel(person.lastInteractionAt);
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
                    <p className="truncate text-[0.75rem] sm:text-[0.8125rem]" style={{ color: "var(--text-muted)" }}>
                      {[person.relationshipType, person.organization].filter(Boolean).join(" · ") || " "}
                      {contactAgo ? (
                        <span style={{ color: "var(--text-faint)" }}> · {contactAgo}</span>
                      ) : null}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
                    {fuStatus && (
                      <span
                        className="rounded-full px-2 py-0.5 text-[0.625rem] font-medium sm:text-[0.75rem]"
                        style={{
                          background: "rgba(245, 158, 11, 0.15)",
                          color: fuStatus === "overdue" ? "#b45309" : "#d97706",
                        }}
                      >
                        {fuStatus === "overdue"
                          ? "Overdue"
                          : fuStatus === "soon"
                          ? "Follow-up soon"
                          : "Follow-up"}
                      </span>
                    )}
                    {birthdayLabel && (
                      <span
                        className="rounded px-1.5 py-0.5 text-[0.625rem] font-medium sm:text-[0.75rem]"
                        style={{ background: "var(--accent-tint)", color: "var(--accent-strong)" }}
                      >
                        🎂 {birthdayLabel}
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            );
          })
        )}
      </div>
    </div>
  );
}
