import {
  dueLabel,
  type WorkAreaSummary,
  type WorkNoteSummary,
  type WorkProjectSummary,
  type WorkReviewSummary,
  type WorkTaskSummary,
  type WorkWorkspaceSummary,
} from "@/lib/work";
import { saveWeeklyReviewAction } from "../actions";
import { WorkForm } from "./work-form";
import { Empty, FieldLabel, Meta, Section, StatusPill, type WorkNameMaps } from "./ui";

export function ReviewSection({
  workspace,
  areas,
  projects,
  tasks,
  notes,
  weekly,
  maps,
  today,
}: {
  workspace: WorkWorkspaceSummary;
  areas: WorkAreaSummary[];
  projects: WorkProjectSummary[];
  tasks: WorkTaskSummary[];
  notes: WorkNoteSummary[];
  weekly: WorkReviewSummary | null;
  maps: WorkNameMaps;
  today: Date;
}) {
  const activeProjects = projects.filter((p) => p.status !== "done");
  const openTasks = tasks.filter((t) => t.status !== "done");
  const waiting = openTasks.filter((t) => t.status === "waiting");
  const openDecisions = notes.filter((n) => n.kind === "decision" && !n.resolved);

  const horizon = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 14);
  const upcoming: Array<{ id: string; label: string; due: string; dueDate: Date }> = [];
  for (const project of activeProjects) {
    if (project.dueDate) {
      const d = new Date(project.dueDate);
      if (d <= horizon) upcoming.push({ id: `p-${project.id}`, label: project.name, due: dueLabel(project.dueDate, today) ?? "", dueDate: d });
    }
  }
  for (const task of openTasks) {
    if (task.dueDate) {
      const d = new Date(task.dueDate);
      if (d <= horizon) upcoming.push({ id: `t-${task.id}`, label: task.title, due: dueLabel(task.dueDate, today) ?? "", dueDate: d });
    }
  }
  upcoming.sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());

  const openLoopsByArea = areas
    .map((area) => ({
      area,
      count: openTasks.filter((t) => t.areaId === area.id).length,
    }))
    .filter((entry) => entry.count > 0);

  return (
    <div className="space-y-5">
      <Section title={`Active projects · ${activeProjects.length}`}>
        {activeProjects.length === 0 ? (
          <Empty>No active projects.</Empty>
        ) : (
          <ul>
            {activeProjects.map((project, i) => (
              <li
                key={project.id}
                className="flex flex-wrap items-baseline gap-x-2 px-3 py-1.5"
                style={i === activeProjects.length - 1 ? undefined : { borderBottom: "1px solid var(--border-faint)" }}
              >
                <span className="text-[0.875rem]" style={{ color: "var(--text)" }}>
                  {project.name}
                </span>
                <StatusPill status={project.status} />
                {project.nextAction && <Meta>→ {project.nextAction}</Meta>}
                {project.dueDate && <Meta>· due {dueLabel(project.dueDate, today)}</Meta>}
              </li>
            ))}
          </ul>
        )}
      </Section>

      <div className="grid gap-5 lg:grid-cols-2">
        <Section title="Open loops by area">
          {openLoopsByArea.length === 0 ? (
            <Empty>No area-linked open tasks.</Empty>
          ) : (
            <ul>
              {openLoopsByArea.map(({ area, count }, i) => (
                <li
                  key={area.id}
                  className="flex items-baseline justify-between px-3 py-1.5"
                  style={i === openLoopsByArea.length - 1 ? undefined : { borderBottom: "1px solid var(--border-faint)" }}
                >
                  <span className="text-[0.875rem]" style={{ color: "var(--text)" }}>
                    {area.name}
                  </span>
                  <Meta>
                    {count} open · {area.currentFocus ?? "no focus set"}
                  </Meta>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title={`Waiting on · ${waiting.length}`}>
          {waiting.length === 0 ? (
            <Empty>Not waiting on anyone.</Empty>
          ) : (
            <ul>
              {waiting.map((task, i) => (
                <li
                  key={task.id}
                  className="px-3 py-1.5 text-[0.875rem]"
                  style={{
                    color: "var(--text)",
                    ...(i === waiting.length - 1 ? {} : { borderBottom: "1px solid var(--border-faint)" }),
                  }}
                >
                  {task.title}
                  {task.waitingOn && <Meta> — {task.waitingOn}</Meta>}
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Section title={`Unresolved decisions · ${openDecisions.length}`}>
          {openDecisions.length === 0 ? (
            <Empty>No open decisions.</Empty>
          ) : (
            <ul>
              {openDecisions.map((note, i) => (
                <li
                  key={note.id}
                  className="px-3 py-1.5 text-[0.875rem]"
                  style={{
                    color: "var(--text)",
                    ...(i === openDecisions.length - 1 ? {} : { borderBottom: "1px solid var(--border-faint)" }),
                  }}
                >
                  {note.title ?? note.body.slice(0, 80)}
                  {(() => {
                    const context = note.projectId ? maps.projects.get(note.projectId) : note.areaId ? maps.areas.get(note.areaId) : null;
                    return context ? <Meta> · {context}</Meta> : null;
                  })()}
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title="Deadlines · next 2 weeks">
          {upcoming.length === 0 ? (
            <Empty>Nothing due in the next two weeks.</Empty>
          ) : (
            <ul>
              {upcoming.map((entry, i) => (
                <li
                  key={entry.id}
                  className="flex items-baseline justify-between gap-2 px-3 py-1.5"
                  style={i === upcoming.length - 1 ? undefined : { borderBottom: "1px solid var(--border-faint)" }}
                >
                  <span className="truncate text-[0.875rem]" style={{ color: "var(--text)" }}>
                    {entry.label}
                  </span>
                  <Meta>{entry.due}</Meta>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>

      <Section
        title="Weekly review"
        aside={weekly ? <Meta>Saved this week ✓</Meta> : <Meta>Week of {weeklyLabel(today)}</Meta>}
      >
        <div className="px-3 py-2.5">
          <WorkForm action={saveWeeklyReviewAction} submitLabel={weekly ? "Update review" : "Save review"}>
            <input type="hidden" name="workspaceId" value={workspace.id} />
            <div className="space-y-2">
              <label className="block">
                <FieldLabel>What moved this week</FieldLabel>
                <textarea name="wins" rows={2} maxLength={8000} defaultValue={weekly?.wins ?? ""} className="field" />
              </label>
              <label className="block">
                <FieldLabel>What was hard / draining</FieldLabel>
                <textarea name="challenges" rows={2} maxLength={8000} defaultValue={weekly?.challenges ?? ""} className="field" />
              </label>
              <label className="block">
                <FieldLabel>Next week&apos;s priorities</FieldLabel>
                <textarea name="nextPriorities" rows={2} maxLength={8000} defaultValue={weekly?.nextPriorities ?? ""} className="field" />
              </label>
              <label className="block" style={{ maxWidth: "10rem" }}>
                <FieldLabel>Energy (1–5)</FieldLabel>
                <select name="energy" defaultValue={weekly?.energy?.toString() ?? ""} className="field">
                  <option value="">—</option>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </WorkForm>
        </div>
      </Section>
    </div>
  );
}

function weeklyLabel(today: Date): string {
  const monday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  return monday.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
