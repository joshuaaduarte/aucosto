import type {
  WorkAreaSummary,
  WorkMeetingSummary,
  WorkPersonSummary,
  WorkProjectSummary,
} from "@/lib/work";

// Small server-side presentational pieces shared by the Work Hub sections.
// Dense, hairline-separated blocks — no decorative cards.

export function Section({
  title,
  aside,
  children,
}: {
  title: string;
  aside?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="fade-in">
      <div className="mb-1.5 flex items-baseline justify-between gap-2">
        <h2
          className="text-[0.6875rem] font-semibold uppercase tracking-wider"
          style={{ color: "var(--text-faint)" }}
        >
          {title}
        </h2>
        {aside}
      </div>
      <div className="rounded-lg" style={{ border: "1px solid var(--border-soft)" }}>
        {children}
      </div>
    </section>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return (
    <p className="px-3 py-2.5 text-[0.8125rem]" style={{ color: "var(--text-faint)" }}>
      {children}
    </p>
  );
}

export function Meta({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[0.6875rem]" style={{ color: "var(--text-faint)" }}>
      {children}
    </span>
  );
}

export function StatusPill({ status }: { status: string }) {
  const emphasized = status === "active" || status === "open";
  return (
    <span
      className="pill shrink-0 text-[0.6875rem] capitalize"
      style={
        emphasized
          ? { background: "var(--bg-tint-strong)", color: "var(--text)" }
          : { color: "var(--text-muted)" }
      }
    >
      {status}
    </span>
  );
}

export function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="mb-0.5 block text-[0.6875rem] font-medium uppercase tracking-wider"
      style={{ color: "var(--text-faint)" }}
    >
      {children}
    </span>
  );
}

/** Collapsed inline editor / creator — native <details>, no client JS. */
export function Disclosure({
  summary,
  children,
}: {
  summary: string;
  children: React.ReactNode;
}) {
  return (
    <details className="group">
      <summary
        className="cursor-pointer list-none text-[0.75rem] font-medium select-none"
        style={{ color: "var(--text-faint)" }}
      >
        {summary}
      </summary>
      <div
        className="mt-2 rounded-lg p-3"
        style={{ background: "var(--bg-tint)", border: "1px solid var(--border-faint)" }}
      >
        {children}
      </div>
    </details>
  );
}

// ── Name maps for rendering cross-object links ────────────────────────────

export interface WorkNameMaps {
  areas: Map<string, string>;
  projects: Map<string, string>;
  people: Map<string, string>;
  meetings: Map<string, string>;
}

export function buildNameMaps(
  areas: WorkAreaSummary[],
  projects: WorkProjectSummary[],
  people: WorkPersonSummary[],
  meetings: WorkMeetingSummary[],
): WorkNameMaps {
  return {
    areas: new Map(areas.map((a) => [a.id, a.name])),
    projects: new Map(projects.map((p) => [p.id, p.name])),
    people: new Map(people.map((p) => [p.id, p.name])),
    meetings: new Map(meetings.map((m) => [m.id, m.title])),
  };
}

export function linkLabels(
  refs: {
    areaId?: string | null;
    projectId?: string | null;
    personId?: string | null;
    meetingId?: string | null;
  },
  maps: WorkNameMaps,
): string[] {
  const out: string[] = [];
  if (refs.areaId && maps.areas.has(refs.areaId)) out.push(maps.areas.get(refs.areaId)!);
  if (refs.projectId && maps.projects.has(refs.projectId)) out.push(maps.projects.get(refs.projectId)!);
  if (refs.personId && maps.people.has(refs.personId)) out.push(maps.people.get(refs.personId)!);
  if (refs.meetingId && maps.meetings.has(refs.meetingId)) out.push(maps.meetings.get(refs.meetingId)!);
  return out;
}

/** Optional link selects (area / project / person / meeting) for task & note forms. */
export function LinkSelects({
  maps,
  defaults,
  include = ["area", "project", "person", "meeting"],
}: {
  maps: WorkNameMaps;
  defaults?: {
    areaId?: string | null;
    projectId?: string | null;
    personId?: string | null;
    meetingId?: string | null;
  };
  include?: Array<"area" | "project" | "person" | "meeting">;
}) {
  const groups: Array<{ key: "area" | "project" | "person" | "meeting"; name: string; label: string; map: Map<string, string>; value: string | null | undefined }> = [
    { key: "area", name: "areaId", label: "Area", map: maps.areas, value: defaults?.areaId },
    { key: "project", name: "projectId", label: "Project", map: maps.projects, value: defaults?.projectId },
    { key: "person", name: "personId", label: "Person", map: maps.people, value: defaults?.personId },
    { key: "meeting", name: "meetingId", label: "Meeting", map: maps.meetings, value: defaults?.meetingId },
  ];
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {groups
        .filter((g) => include.includes(g.key) && g.map.size > 0)
        .map((g) => (
          <label key={g.name} className="block">
            <FieldLabel>{g.label}</FieldLabel>
            <select name={g.name} defaultValue={g.value ?? ""} className="field">
              <option value="">—</option>
              {[...g.map.entries()].map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </select>
          </label>
        ))}
    </div>
  );
}
