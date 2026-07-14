import {
  WORK_RELATIONSHIPS,
  type WorkPersonSummary,
  type WorkTaskSummary,
  type WorkWorkspaceSummary,
} from "@/lib/work";
import { createPersonAction, updatePersonAction } from "../actions";
import { WorkForm } from "./work-form";
import { Disclosure, Empty, FieldLabel, Meta, Section } from "./ui";

export function PeopleSection({
  workspace,
  people,
  tasks,
}: {
  workspace: WorkWorkspaceSummary;
  people: WorkPersonSummary[];
  tasks: WorkTaskSummary[];
}) {
  const openFollowUps = new Map<string, WorkTaskSummary[]>();
  for (const task of tasks) {
    if (task.status === "done" || !task.personId) continue;
    const list = openFollowUps.get(task.personId) ?? [];
    list.push(task);
    openFollowUps.set(task.personId, list);
  }

  return (
    <div className="space-y-5">
      <Section title={`People · ${people.length}`}>
        {people.length === 0 ? (
          <Empty>No one yet. Start with your manager and the people you meet weekly.</Empty>
        ) : (
          <ul>
            {people.map((person, i) => {
              const followUps = openFollowUps.get(person.id) ?? [];
              return (
                <li
                  key={person.id}
                  className="px-3 py-2"
                  style={i === people.length - 1 ? undefined : { borderBottom: "1px solid var(--border-faint)" }}
                >
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                    <span className="text-[0.875rem] font-medium" style={{ color: "var(--text)" }}>
                      {person.name}
                    </span>
                    {person.role && <Meta>{person.role}</Meta>}
                    {person.relationship && (
                      <span
                        className="pill text-[0.6875rem] capitalize"
                        style={{ background: "var(--bg-tint-strong)", color: "var(--text)" }}
                      >
                        {person.relationship}
                      </span>
                    )}
                    {person.team && <Meta>· {person.team}</Meta>}
                  </div>
                  {followUps.length > 0 && (
                    <ul className="mt-1 space-y-0.5">
                      {followUps.map((task) => (
                        <li key={task.id} className="text-[0.8125rem]" style={{ color: "var(--text-muted)" }}>
                          ↳ {task.title}
                          {task.status === "waiting" && (
                            <span style={{ color: "var(--text-faint)" }}> (waiting)</span>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                  {person.notes && (
                    <p className="mt-0.5 text-[0.75rem]" style={{ color: "var(--text-faint)" }}>
                      {person.notes}
                    </p>
                  )}
                  <div className="mt-1">
                    <Disclosure summary={person.oneOnOneNotes ? "1:1 notes & edit" : "Edit"}>
                      <WorkForm action={updatePersonAction} submitLabel="Save person">
                        <input type="hidden" name="id" value={person.id} />
                        <input type="hidden" name="workspaceId" value={workspace.id} />
                        <PersonFields person={person} />
                      </WorkForm>
                    </Disclosure>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Section>

      <Section title="Add person">
        <div className="px-3 py-2.5">
          <WorkForm action={createPersonAction} submitLabel="Add person">
            <input type="hidden" name="workspaceId" value={workspace.id} />
            <PersonFields />
          </WorkForm>
        </div>
      </Section>
    </div>
  );
}

function PersonFields({ person }: { person?: WorkPersonSummary }) {
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <input
          name="name"
          required
          maxLength={200}
          defaultValue={person?.name ?? ""}
          placeholder="Name"
          className="field col-span-2"
        />
        <input
          name="role"
          maxLength={200}
          defaultValue={person?.role ?? ""}
          placeholder="Role / title"
          className="field"
        />
        <label className="block">
          <select name="relationship" defaultValue={person?.relationship ?? ""} className="field">
            <option value="">Relationship…</option>
            {WORK_RELATIONSHIPS.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <input
        name="team"
        maxLength={200}
        defaultValue={person?.team ?? ""}
        placeholder="Team"
        className="field"
      />
      <label className="block">
        <FieldLabel>Relationship context</FieldLabel>
        <textarea
          name="notes"
          rows={2}
          maxLength={4000}
          defaultValue={person?.notes ?? ""}
          placeholder="How you work together, what they care about"
          className="field"
        />
      </label>
      <label className="block">
        <FieldLabel>1:1 notes</FieldLabel>
        <textarea
          name="oneOnOneNotes"
          rows={3}
          maxLength={8000}
          defaultValue={person?.oneOnOneNotes ?? ""}
          placeholder="Running 1:1 log — topics to raise, agreements, feedback"
          className="field"
        />
      </label>
    </div>
  );
}
