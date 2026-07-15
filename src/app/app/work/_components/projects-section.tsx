import Link from "next/link";
import {
  dueLabel,
  WORK_PROJECT_STATUSES,
  type WorkAreaSummary,
  type WorkNoteSummary,
  type WorkProjectSummary,
  type WorkTaskSummary,
  type WorkWorkspaceSummary,
} from "@/lib/work";
import {
  createProjectAction,
  linkProjectAction,
  unlinkProjectAction,
  updateProjectAction,
} from "../actions";
import { WorkForm } from "./work-form";
import { Disclosure, Empty, FieldLabel, Meta, Section, StatusPill, type WorkNameMaps } from "./ui";

export function ProjectsSection({
  workspace,
  projects,
  areas,
  tasks,
  notes,
  maps,
  today,
  linkOptions,
}: {
  workspace: WorkWorkspaceSummary;
  projects: WorkProjectSummary[];
  areas: WorkAreaSummary[];
  tasks: WorkTaskSummary[];
  notes: WorkNoteSummary[];
  maps: WorkNameMaps;
  today: Date;
  /** Aucosto Projects not yet linked into this workspace. */
  linkOptions: Array<{ id: string; name: string }>;
}) {
  const openTaskCount = new Map<string, number>();
  for (const task of tasks) {
    if (task.status === "done" || !task.projectId) continue;
    openTaskCount.set(task.projectId, (openTaskCount.get(task.projectId) ?? 0) + 1);
  }
  const noteCount = new Map<string, number>();
  for (const note of notes) {
    if (!note.projectId) continue;
    noteCount.set(note.projectId, (noteCount.get(note.projectId) ?? 0) + 1);
  }

  return (
    <div className="space-y-5">
      <Section title={`Projects · ${projects.length}`}>
        {projects.length === 0 ? (
          <Empty>No projects yet. A project is a bounded effort with an outcome — the job itself stays broader.</Empty>
        ) : (
          <ul>
            {projects.map((project, i) => (
              <li
                key={project.id}
                className="px-3 py-2"
                style={i === projects.length - 1 ? undefined : { borderBottom: "1px solid var(--border-faint)" }}
              >
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                  {project.linkedProjectId ? (
                    <Link
                      href={`/app/projects/${project.linkedProjectId}`}
                      className="text-[0.875rem] font-medium hover:underline"
                      style={{ color: project.status === "done" ? "var(--text-faint)" : "var(--text)" }}
                    >
                      {project.name}
                    </Link>
                  ) : (
                    <span
                      className="text-[0.875rem] font-medium"
                      style={{ color: project.status === "done" ? "var(--text-faint)" : "var(--text)" }}
                    >
                      {project.name}
                    </span>
                  )}
                  <StatusPill status={project.status} />
                  {project.dueDate && <Meta>Due {dueLabel(project.dueDate, today)}</Meta>}
                  {project.areaId && maps.areas.has(project.areaId) && (
                    <Meta>· {maps.areas.get(project.areaId)}</Meta>
                  )}
                  {(openTaskCount.get(project.id) ?? 0) > 0 && (
                    <Meta>· {openTaskCount.get(project.id)} open task{openTaskCount.get(project.id) === 1 ? "" : "s"}</Meta>
                  )}
                  {(noteCount.get(project.id) ?? 0) > 0 && (
                    <Meta>· {noteCount.get(project.id)} note{noteCount.get(project.id) === 1 ? "" : "s"}</Meta>
                  )}
                </div>
                {project.nextAction && (
                  <p className="mt-0.5 text-[0.8125rem]" style={{ color: "var(--text-muted)" }}>
                    → {project.nextAction}
                  </p>
                )}
                {project.outcome && (
                  <p className="mt-0.5 text-[0.75rem]" style={{ color: "var(--text-faint)" }}>
                    Outcome: {project.outcome}
                  </p>
                )}
                <div className="mt-1 flex flex-wrap items-center gap-3">
                  <Disclosure summary="Edit">
                    <WorkForm action={updateProjectAction} submitLabel="Save project">
                      <input type="hidden" name="id" value={project.id} />
                      <input type="hidden" name="workspaceId" value={workspace.id} />
                      <ProjectFields areas={areas} project={project} />
                    </WorkForm>
                  </Disclosure>
                  {project.linkedProjectId && (
                    <form action={unlinkProjectAction}>
                      <input type="hidden" name="id" value={project.id} />
                      <button
                        type="submit"
                        className="text-[0.75rem] font-medium"
                        style={{ color: "var(--text-ghost)" }}
                        title="Remove from this workspace — the project itself stays in Projects."
                      >
                        Unlink
                      </button>
                    </form>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Section>

      {linkOptions.length > 0 && (
        <Section title="Link an existing project">
          <div className="px-3 py-2.5">
            <form action={linkProjectAction} className="flex flex-wrap items-end gap-2">
              <input type="hidden" name="workspaceId" value={workspace.id} />
              <label className="block min-w-[12rem] flex-1">
                <FieldLabel>Project</FieldLabel>
                <select name="projectId" required className="field" defaultValue="">
                  <option value="" disabled>
                    Choose a project…
                  </option>
                  {linkOptions.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.name}
                    </option>
                  ))}
                </select>
              </label>
              {areas.length > 0 && (
                <label className="block">
                  <FieldLabel>Area</FieldLabel>
                  <select name="areaId" defaultValue="" className="field">
                    <option value="">—</option>
                    {areas.map((area) => (
                      <option key={area.id} value={area.id}>
                        {area.name}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <button type="submit" className="btn-ink px-3 py-1.5 text-[0.8125rem] font-medium">
                Link to {workspace.name}
              </button>
            </form>
          </div>
        </Section>
      )}

      <Section title="New project">
        <div className="px-3 py-2.5">
          <WorkForm action={createProjectAction} submitLabel="Add project">
            <input type="hidden" name="workspaceId" value={workspace.id} />
            <ProjectFields areas={areas} />
          </WorkForm>
          <p className="mt-1.5 text-[0.6875rem]" style={{ color: "var(--text-faint)" }}>
            Also created in Projects, so time tracking and tasks work like any other project.
          </p>
        </div>
      </Section>
    </div>
  );
}

function ProjectFields({
  areas,
  project,
}: {
  areas: WorkAreaSummary[];
  project?: WorkProjectSummary;
}) {
  return (
    <div className="space-y-2">
      <input
        name="name"
        required
        maxLength={200}
        defaultValue={project?.name ?? ""}
        placeholder="Project name"
        className="field"
      />
      <input
        name="outcome"
        maxLength={1000}
        defaultValue={project?.outcome ?? ""}
        placeholder="What does done look like?"
        className="field"
      />
      <input
        name="nextAction"
        maxLength={300}
        defaultValue={project?.nextAction ?? ""}
        placeholder="Next action"
        className="field"
      />
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <label className="block">
          <FieldLabel>Status</FieldLabel>
          <select name="status" defaultValue={project?.status ?? "active"} className="field">
            {WORK_PROJECT_STATUSES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <FieldLabel>Due</FieldLabel>
          <input
            type="date"
            name="dueDate"
            defaultValue={project?.dueDate ? project.dueDate.slice(0, 10) : ""}
            className="field"
          />
        </label>
        {areas.length > 0 && (
          <label className="block">
            <FieldLabel>Area</FieldLabel>
            <select name="areaId" defaultValue={project?.areaId ?? ""} className="field">
              <option value="">—</option>
              {areas.map((area) => (
                <option key={area.id} value={area.id}>
                  {area.name}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
      <textarea
        name="notes"
        rows={2}
        maxLength={4000}
        defaultValue={project?.notes ?? ""}
        placeholder="Notes"
        className="field"
      />
    </div>
  );
}
