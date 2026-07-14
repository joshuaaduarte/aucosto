import type {
  WorkAreaSummary,
  WorkProjectSummary,
  WorkTaskSummary,
  WorkWorkspaceSummary,
} from "@/lib/work";
import { archiveAreaAction, createAreaAction, updateAreaAction } from "../actions";
import { WorkForm } from "./work-form";
import { Disclosure, Empty, FieldLabel, Meta, Section } from "./ui";

export function AreasSection({
  workspace,
  areas,
  projects,
  tasks,
}: {
  workspace: WorkWorkspaceSummary;
  areas: WorkAreaSummary[];
  projects: WorkProjectSummary[];
  tasks: WorkTaskSummary[];
}) {
  const openLoops = new Map<string, number>();
  for (const task of tasks) {
    if (task.status === "done" || !task.areaId) continue;
    openLoops.set(task.areaId, (openLoops.get(task.areaId) ?? 0) + 1);
  }
  const activeProjects = new Map<string, number>();
  for (const project of projects) {
    if (project.status === "done" || !project.areaId) continue;
    activeProjects.set(project.areaId, (activeProjects.get(project.areaId) ?? 0) + 1);
  }

  return (
    <div className="space-y-5">
      <Section title={`Areas of responsibility · ${areas.length}`}>
        {areas.length === 0 ? (
          <Empty>No areas yet. Areas are the ongoing parts of the job that never &ldquo;finish&rdquo; — on-call, planning, mentoring.</Empty>
        ) : (
          <ul>
            {areas.map((area, i) => (
              <li
                key={area.id}
                className="px-3 py-2"
                style={i === areas.length - 1 ? undefined : { borderBottom: "1px solid var(--border-faint)" }}
              >
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                  <span className="text-[0.875rem] font-medium" style={{ color: "var(--text)" }}>
                    {area.name}
                  </span>
                  {(openLoops.get(area.id) ?? 0) > 0 && (
                    <Meta>{openLoops.get(area.id)} open loop{openLoops.get(area.id) === 1 ? "" : "s"}</Meta>
                  )}
                  {(activeProjects.get(area.id) ?? 0) > 0 && (
                    <Meta>· {activeProjects.get(area.id)} active project{activeProjects.get(area.id) === 1 ? "" : "s"}</Meta>
                  )}
                </div>
                {area.currentFocus && (
                  <p className="mt-0.5 text-[0.8125rem]" style={{ color: "var(--text-muted)" }}>
                    Focus: {area.currentFocus}
                  </p>
                )}
                {area.description && (
                  <p className="mt-0.5 text-[0.75rem]" style={{ color: "var(--text-faint)" }}>
                    {area.description}
                  </p>
                )}
                <div className="mt-1 flex items-center gap-3">
                  <Disclosure summary="Edit">
                    <WorkForm action={updateAreaAction} submitLabel="Save area">
                      <input type="hidden" name="id" value={area.id} />
                      <input type="hidden" name="workspaceId" value={workspace.id} />
                      <AreaFields area={area} />
                    </WorkForm>
                  </Disclosure>
                  <form action={archiveAreaAction}>
                    <input type="hidden" name="id" value={area.id} />
                    <button
                      type="submit"
                      className="text-[0.75rem] font-medium"
                      style={{ color: "var(--text-ghost)" }}
                    >
                      Archive
                    </button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="New area">
        <div className="px-3 py-2.5">
          <WorkForm action={createAreaAction} submitLabel="Add area">
            <input type="hidden" name="workspaceId" value={workspace.id} />
            <AreaFields />
          </WorkForm>
        </div>
      </Section>
    </div>
  );
}

function AreaFields({ area }: { area?: WorkAreaSummary }) {
  return (
    <div className="space-y-2">
      <input
        name="name"
        required
        maxLength={200}
        defaultValue={area?.name ?? ""}
        placeholder="Area name (e.g. Release quality, Team rituals)"
        className="field"
      />
      <label className="block">
        <FieldLabel>Current focus</FieldLabel>
        <input
          name="currentFocus"
          maxLength={500}
          defaultValue={area?.currentFocus ?? ""}
          placeholder="What matters in this area right now"
          className="field"
        />
      </label>
      <textarea
        name="description"
        rows={2}
        maxLength={1000}
        defaultValue={area?.description ?? ""}
        placeholder="What this responsibility covers"
        className="field"
      />
    </div>
  );
}
