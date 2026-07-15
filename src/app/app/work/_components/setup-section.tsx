import Link from "next/link";
import type { RolodexPersonSummary } from "@/lib/services/rolodex";
import type { WorkWorkspaceSummary } from "@/lib/work";
import { createTaskAction, linkPersonAction, linkProjectAction } from "../actions";
import { WorkForm } from "./work-form";
import { Empty, Meta, Section } from "./ui";

/**
 * First-use state for an empty workspace: connect what already exists in the
 * rest of Aucosto instead of presenting seven empty tabs. Everything here
 * writes through the owning tools (Rolodex / Projects / Do).
 */
export function SetupSection({
  workspace,
  candidates,
  projectOptions,
}: {
  workspace: WorkWorkspaceSummary;
  candidates: RolodexPersonSummary[];
  projectOptions: Array<{ id: string; name: string }>;
}) {
  return (
    <div className="space-y-5">
      <p className="text-[0.8125rem]" style={{ color: "var(--text-muted)" }}>
        Nothing is connected to {workspace.name} yet. Work is a lens over the rest of
        Aucosto — start by pulling in what already exists, then add the rest from the tabs
        above.
      </p>

      <Section title={`Coworkers already in your Rolodex`}>
        {candidates.length === 0 ? (
          <Empty>
            No likely coworkers found. Add your manager and key collaborators from the{" "}
            <Link href="/app/work?tab=people" className="underline">
              People tab
            </Link>{" "}
            — they&apos;ll be saved to the Rolodex.
          </Empty>
        ) : (
          <ul>
            {candidates.slice(0, 8).map((candidate, i) => (
              <li
                key={candidate.id}
                className="flex items-baseline justify-between gap-2 px-3 py-2"
                style={
                  i === Math.min(candidates.length, 8) - 1
                    ? undefined
                    : { borderBottom: "1px solid var(--border-faint)" }
                }
              >
                <div className="flex min-w-0 flex-wrap items-baseline gap-x-2">
                  <span className="text-[0.875rem] font-medium" style={{ color: "var(--text)" }}>
                    {candidate.displayName}
                  </span>
                  {candidate.organization && <Meta>{candidate.organization}</Meta>}
                </div>
                <form action={linkPersonAction} className="shrink-0">
                  <input type="hidden" name="workspaceId" value={workspace.id} />
                  <input type="hidden" name="rolodexPersonId" value={candidate.id} />
                  <button type="submit" className="btn-ghost px-2.5 py-1 text-[0.75rem] font-medium">
                    Connect
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </Section>

      {projectOptions.length > 0 && (
        <Section title="Link an active project">
          <ul>
            {projectOptions.slice(0, 6).map((option, i) => (
              <li
                key={option.id}
                className="flex items-baseline justify-between gap-2 px-3 py-2"
                style={
                  i === Math.min(projectOptions.length, 6) - 1
                    ? undefined
                    : { borderBottom: "1px solid var(--border-faint)" }
                }
              >
                <span className="min-w-0 truncate text-[0.875rem] font-medium" style={{ color: "var(--text)" }}>
                  {option.name}
                </span>
                <form action={linkProjectAction} className="shrink-0">
                  <input type="hidden" name="workspaceId" value={workspace.id} />
                  <input type="hidden" name="projectId" value={option.id} />
                  <button type="submit" className="btn-ghost px-2.5 py-1 text-[0.75rem] font-medium">
                    Link
                  </button>
                </form>
              </li>
            ))}
          </ul>
        </Section>
      )}

      <Section title="First task">
        <div className="px-3 py-2.5">
          <WorkForm action={createTaskAction} submitLabel="Add task">
            <input type="hidden" name="workspaceId" value={workspace.id} />
            <input
              name="title"
              required
              maxLength={300}
              placeholder={`First thing to do at ${workspace.name}`}
              className="field"
            />
          </WorkForm>
          <p className="mt-1.5 text-[0.6875rem]" style={{ color: "var(--text-faint)" }}>
            Work tasks are real Do List items — they show up on /app/do and the Today hub.
          </p>
        </div>
      </Section>

      <p className="text-[0.75rem]" style={{ color: "var(--text-faint)" }}>
        Then set up{" "}
        <Link href="/app/work?tab=areas" className="underline">
          areas of responsibility
        </Link>{" "}
        and{" "}
        <Link href="/app/work?tab=meetings" className="underline">
          recurring meetings
        </Link>{" "}
        — meetings are saved to the calendar.
      </p>
    </div>
  );
}
