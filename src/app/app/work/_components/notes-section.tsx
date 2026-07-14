import type { WorkNoteSummary, WorkWorkspaceSummary } from "@/lib/work";
import { createNoteAction, deleteNoteAction, setNoteResolvedAction } from "../actions";
import { WorkForm } from "./work-form";
import { Disclosure, Empty, LinkSelects, Meta, Section, linkLabels, type WorkNameMaps } from "./ui";

function dayLabel(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export function NotesSection({
  workspace,
  notes,
  maps,
}: {
  workspace: WorkWorkspaceSummary;
  notes: WorkNoteSummary[];
  maps: WorkNameMaps;
}) {
  return (
    <div className="space-y-5">
      <Section title="Capture">
        <div className="px-3 py-2.5">
          <WorkForm action={createNoteAction} submitLabel="Save">
            <input type="hidden" name="workspaceId" value={workspace.id} />
            <div className="space-y-2">
              <div className="flex gap-2">
                <select name="kind" defaultValue="note" className="field" style={{ width: "8.5rem" }}>
                  <option value="note">Note</option>
                  <option value="decision">Decision</option>
                </select>
                <input
                  name="title"
                  maxLength={300}
                  placeholder="Title (optional)"
                  className="field"
                />
              </div>
              <textarea
                name="body"
                required
                rows={3}
                maxLength={20000}
                placeholder="Work log entry, context, or a decision and its rationale…"
                className="field"
              />
              <Disclosure summary="Link to area / project / person / meeting">
                <LinkSelects maps={maps} />
              </Disclosure>
            </div>
          </WorkForm>
        </div>
      </Section>

      <Section title={`Work log · ${notes.length}`}>
        {notes.length === 0 ? (
          <Empty>Nothing captured yet. The log is chronological — newest first.</Empty>
        ) : (
          <ul>
            {notes.map((note, i) => {
              const links = linkLabels(note, maps);
              const isOpenDecision = note.kind === "decision" && !note.resolved;
              return (
                <li
                  key={note.id}
                  className="px-3 py-2"
                  style={i === notes.length - 1 ? undefined : { borderBottom: "1px solid var(--border-faint)" }}
                >
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                    <Meta>{dayLabel(note.occurredAt)}</Meta>
                    {note.kind === "decision" && (
                      <span
                        className="pill text-[0.6875rem]"
                        style={
                          isOpenDecision
                            ? { background: "var(--accent-tint)", color: "var(--accent-strong)" }
                            : { background: "var(--bg-tint-strong)", color: "var(--text-muted)" }
                        }
                      >
                        {isOpenDecision ? "Decision · open" : "Decision · settled"}
                      </span>
                    )}
                    {note.title && (
                      <span className="text-[0.875rem] font-medium" style={{ color: "var(--text)" }}>
                        {note.title}
                      </span>
                    )}
                    {links.map((label) => (
                      <Meta key={label}>· {label}</Meta>
                    ))}
                  </div>
                  <p className="mt-0.5 whitespace-pre-line text-[0.8125rem]" style={{ color: "var(--text-muted)" }}>
                    {note.body}
                  </p>
                  <div className="mt-1 flex items-center gap-3">
                    {note.kind === "decision" && (
                      <form action={setNoteResolvedAction}>
                        <input type="hidden" name="id" value={note.id} />
                        <input type="hidden" name="resolved" value={note.resolved ? "false" : "true"} />
                        <button
                          type="submit"
                          className="text-[0.75rem] font-medium"
                          style={{ color: "var(--text-faint)" }}
                        >
                          {note.resolved ? "Reopen" : "Mark settled"}
                        </button>
                      </form>
                    )}
                    <form action={deleteNoteAction}>
                      <input type="hidden" name="id" value={note.id} />
                      <button
                        type="submit"
                        className="text-[0.75rem] font-medium"
                        style={{ color: "var(--text-ghost)" }}
                      >
                        Delete
                      </button>
                    </form>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Section>
    </div>
  );
}
